const {
  executeQuery,
  executeSP2,
  executeSP,
  runTransaction,
} = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
const { CustomError } = require("../../../middleware/errorHandler");
const Booking = require("../model/bookings.model");
const Servicio = require("../model/servicios.model");
const Hospedaje = require("../model/hospedajes.model"); 
const Item = require("../model/items.model");
const { Calculo, calcularNoches } = require("../../lib/utils/calculates");

async function crear_pago_desde_wallet(connection, id_servicio, saldos_aplicados) {
  console.log("LOG: Iniciando crear_pago_desde_wallet...");
  
  // Sumar el total aplicado desde los diferentes saldos
  const monto_total_aplicado = saldos_aplicados.reduce(
    (acc, s) => acc + parseFloat(s.monto_cargado_al_item || 0), 0
  );
  
  // Asumimos que el primer saldo nos da la info general (agente, id_saldo para el vínculo)
  const id_saldo_principal = saldos_aplicados[0].id_saldos;
  const id_agente_pago = saldos_aplicados[0].id_agente;
  const nuevo_id_pago = `pag-${uuidv4()}`;
  const nueva_transaccion_id = `tr-${uuidv4()}`; // <-- REQUISITO 1: Transacción tr-

  console.log(`LOG: Monto total aplicado: ${monto_total_aplicado}, Saldo ID principal: ${id_saldo_principal}, Nuevo Pago ID: ${nuevo_id_pago}`);

  // 1. Insertar en 'pagos'
  const insertPagoQuery = `
    INSERT INTO pagos (id_pago, id_servicio, monto, concepto, metodo_de_pago, tipo_de_pago, 
                       id_saldo_a_favor, id_agente, estado, fecha_creacion, fecha_pago,
                       transaccion, saldo_aplicado) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURDATE(), ?, ?)`;
  
  const [insertPagoResult] = await connection.execute(insertPagoQuery, [
    nuevo_id_pago,
    id_servicio,
    monto_total_aplicado,
    'Pago de ajuste de reserva con wallet',
    'wallet', 
    'wallet', 
    id_saldo_principal, // Vínculo principal
    id_agente_pago,
    'Confirmado',
    nueva_transaccion_id,     // <-- Campo 'transaccion'
    monto_total_aplicado      // <-- REQUISITO 2: Campo 'saldo_aplicado'
  ]);
  console.log("LOG: Resultado INSERT pagos:", insertPagoResult.info);

  // 2. Descontar de 'saldos_a_favor' (Iteramos por si el pago se partió)
  // <-- REQUISITO 3: Descontar saldo
  console.log("LOG: Actualizando saldos_a_favor...");
  for (const saldo of saldos_aplicados) {
      const monto_a_descontar = parseFloat(saldo.monto_cargado_al_item || 0);
      const id_saldo_a_descontar = saldo.id_saldos;
      
      if (monto_a_descontar > 0) {
          const [updateSaldoResult] = await connection.execute(
              "UPDATE saldos_a_favor SET saldo = saldo - ? WHERE id_saldos = ?",
              [monto_a_descontar, id_saldo_a_descontar]
          );
          console.log(`LOG: Descontado ${monto_a_descontar} de saldo ${id_saldo_a_descontar}. Info:`, updateSaldoResult.info);
      }
  }
  
  return nuevo_id_pago;
}

/**
 * Vincula los items (nuevos o de ajuste) al pago recién creado.
 * (Tabla items_pagos)
 */
async function asociar_items_a_pago(connection, id_hospedaje, id_pago, items_a_vincular) {
  console.log(`LOG: Iniciando asociar_items_a_pago. Vinculando ${items_a_vincular.length} items al pago ${id_pago}`);
  for (const item of items_a_vincular) {
    const [result] = await connection.execute(
      `INSERT INTO items_pagos (id_item, id_pago, monto, id_relacion) VALUES (?, ?, ?, ?)`,
      [item.id_item, id_pago, item.total, id_hospedaje]
    );
    console.log(`LOG: Vínculo items_pagos creado para item ${item.id_item}. Info:`, result.info);
  }
}

async function get_payment_type(id_solicitud, id_servicio) {
  const query_credito = `select case when id_credito is not null then 1 else 0 end as is_credito 
    from vw_reservas_client where id_solicitud = ?;`;

  const query_pago_directo = `Select case when id_saldo_a_favor is null then 1 else 0 end as is_pago_directo
    from servicios where id_servicio = ?`; 
  const query_wallet = `Select case when id_saldo_a_favor is not null then 1 else 0 end as is_wallet
    from servicios where id_servicio = ?`; 

  let tipo_pago;
  const result_credito = await executeQuery(query_credito, [id_solicitud]);
  const result_pago_directo = await executeQuery(query_pago_directo, [id_servicio]);
  const result_wallet = await executeQuery(query_wallet, [id_servicio]);
  if (result_credito[0]?.is_credito) {
    tipo_pago = 'credito';
  } else if (result_pago_directo[0]?.is_pago_directo) {
    tipo_pago = 'pago_directo';
  } else if (result_wallet[0]?.is_wallet) {
    tipo_pago = 'wallet';
  }
  return tipo_pago;
}

async function is_invoiced_reservation(id_servicio) {
  const pagos_y_facturas = await executeSP('sp_get_facturas_pagos_by_id_servicio',[id_servicio]);
  return pagos_y_facturas;
}

async function are_invoiced_payments({saldos}) {
  // saldos: array de objetos que contienen id_saldos
  if (!Array.isArray(saldos) || saldos.length === 0) return [];

  const ids = saldos.map(s => s?.id_saldos).filter(Boolean);
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  
  // Consultamos los IDs que SÍ están facturados
  const query = `SELECT id_saldos 
                 FROM saldos_a_favor 
                 WHERE id_saldos IN (${placeholders}) AND is_facturado = 1`;
  const result = await executeQuery(query, ids);
  
  // Extraemos solo los IDs
  const ids_facturados = result.map(r => r.id_saldos);
  
  // Filtramos el array de saldos original
  return saldos.filter(s => ids_facturados.includes(s.id_saldos));
}

async function asociar_factura_items_logica(connection, id_hospedaje, items_a_vincular, facturas_disponibles) {
  
  console.log(`LOG: Iniciando consumo fiscal para ${items_a_vincular.length} items.`);
  
  // Clonamos para no mutar el original
  let facturas = JSON.parse(JSON.stringify(facturas_disponibles)); 
  
  if (!facturas || facturas.length === 0) {
    console.warn("LOG: No hay facturas disponibles para la herencia fiscal.");
    return;
  }

  let idx_factura_actual = 0;

  for (const item of items_a_vincular) {
    let monto_pendiente_item = parseFloat(item.total); // ej. 1513.80

    while (monto_pendiente_item > 0.01) { // Evitar problemas de decimales
      
      if (idx_factura_actual >= facturas.length) {
        console.error(`¡Error fiscal! No hay suficiente saldo facturado para cubrir el item ${item.id_item}. Faltan ${monto_pendiente_item}`);
        throw new Error("(revisar la data con finanzas)");
      }

      let factura_actual = facturas[idx_factura_actual];
      let saldo_factura = parseFloat(factura_actual.saldo_x_aplicar_items || 0);

      if (saldo_factura < 0.01) {
        // Esta factura está agotada, pasar a la siguiente.
        idx_factura_actual++;
        continue; 
      }

      const monto_a_aplicar = Math.min(monto_pendiente_item, saldo_factura);
      
      // 1. Crear el vínculo fiscal (items_facturas)
      // (Tu tabla items_facturas no tiene tipo_relacion)
      await connection.execute(
          `INSERT INTO items_facturas (id_item, id_factura, monto, id_relacion) 
           VALUES (?, ?, ?, ?)`,
          [
            item.id_item,
            factura_actual.id_factura,
            monto_a_aplicar,
            id_hospedaje
          ]
      );
      
      // 2. Actualizar el saldo de la factura en la BD
      await connection.execute(
          "UPDATE facturas SET saldo_x_aplicar_items = saldo_x_aplicar_items - ? WHERE id_factura = ?",
          [monto_a_aplicar, factura_actual.id_factura]
      );
      
      // 3. Actualizar saldos en memoria
      monto_pendiente_item -= monto_a_aplicar;
      factura_actual.saldo_x_aplicar_items = saldo_factura - monto_a_aplicar;

      console.log(`LOG: Aplicados ${monto_a_aplicar} del item ${item.id_item} a la factura ${factura_actual.id_factura}. Pendiente item: ${monto_pendiente_item}`);
    }
  }
}
async function manejar_desactivacion_fiscal(connection, items_desactivados, facturas_reserva) {
  console.log("Manejando desactivación fiscal (Regla Morada)");
  if (items_desactivados.length === 0 || facturas_reserva.length === 0) return;

  const factura_principal = facturas_reserva[0]; // Asumir una factura
  let monto_liberado_total = 0;
  const ids_desactivados = [];

  for (const item of items_desactivados) {
      // El 'monto_facturado_previo' lo obtuvimos de Item.findActivos
      const monto_facturado = parseFloat(item.monto_facturado_previo || 0);
      if (monto_facturado > 0) {
          monto_liberado_total += monto_facturado;
          ids_desactivados.push(item.id_item);
      }
  }

  if (monto_liberado_total > 0) {
    // 1. Poner items_facturas.monto = 0 para esos ítems
    const placeholders = ids_desactivados.map(() => '?').join(',');
    await connection.execute(
      `UPDATE items_facturas SET monto = 0 WHERE id_item IN (${placeholders}) AND id_factura = ?`,
      [...ids_desactivados, factura_principal.id_factura]
    );
    
    // 2. Sumar lo liberado en facturas.saldo_x_aplicar_items
    await connection.execute(
      "UPDATE facturas SET saldo_x_aplicar_items = saldo_x_aplicar_items + ? WHERE id_factura = ?",
      [monto_liberado_total, factura_principal.id_factura]
    );
  }
}

/**
 * Reasigna montos facturados y genera devoluciones tras reducción de precio (Down-scale).
 * (Flujos C, E, G)
 */
async function manejar_reduccion_fiscal(connection, items_activos_post_split, facturas_reserva) {
  console.log("Manejando reducción fiscal (Down-scale)");
  if (facturas_reserva.length === 0) return;
  
  const factura_principal = facturas_reserva[0];

  // 1. Obtener el saldo liberado (de desactivaciones previas, si hubo)
  // (Añadimos 'total' para la validación de finanzas)
  const [rows] = await connection.execute(
      "SELECT saldo_x_aplicar_items, id_agente, total FROM facturas WHERE id_factura = ?", 
      [factura_principal.id_factura]
  );
  
  if (!rows || rows.length === 0) return;

  let monto_liberado_reasignable = parseFloat(rows[0]?.saldo_x_aplicar_items || 0);
  const id_agente = rows[0]?.id_agente;
  const total_factura = parseFloat(rows[0]?.total || 0);

  // Validación de Finanzas
  if (monto_liberado_reasignable < 0 || monto_liberado_reasignable > total_factura) {
      console.error(`ERROR DE INTEGRIDAD: Factura ${factura_principal.id_factura} tiene saldo (${monto_liberado_reasignable}) inválido vs total (${total_factura})`);
      throw new Error("(revisar la data con finanzas)");
  }
  
  // 2. Re-evaluar items activos post-split
  for (const item of items_activos_post_split) {
    const capacidad_fiscal_nueva = parseFloat(item.total);
    const monto_facturado_actual = parseFloat(item.monto_facturado_previo || 0);

    if (monto_facturado_actual > capacidad_fiscal_nueva) {
        const exceso_item = monto_facturado_actual - capacidad_fiscal_nueva;
        monto_liberado_reasignable += exceso_item; 
        
        await connection.execute(
            "UPDATE items_facturas SET monto = ? WHERE id_item = ? AND id_factura = ?",
            [capacidad_fiscal_nueva, item.id_item, factura_principal.id_factura]
        );
    }
  }
  
  // 3. Devolver cualquier remanente a wallet no facturable
  if (monto_liberado_reasignable > 0) {
     console.log(`Generando devolución no facturable por ${monto_liberado_reasignable}`);
     
     // CORREGIDO: (BUG 4) Se quita id_saldos, (BUG 5) se usa is_devolucion
     await connection.execute(
        `INSERT INTO saldos_a_favor (id_agente, monto, concepto, activo, is_facturable, is_devolucion, monto_facturado, fecha_creacion, fecha_pago) 
         VALUES (?, ?, ?, 1, 0, 1, 0, CURDATE(), CURDATE())`,
        [id_agente, monto_liberado_reasignable, 'Devolucion por ajuste de reserva']
     );
     
     // Poner el saldo_x_aplicar_items de la factura en 0
     await connection.execute(
        "UPDATE facturas SET saldo_x_aplicar_items = 0 WHERE id_factura = ?",
        [factura_principal.id_factura]
     );
  }
}

const payload_prueba= {
  "metadata": { 
    "id_agente": "7d85fc3a-d799-40ec-aff3-9e26e2271abd",
    "id_servicio": "ser-a07aef8f-10db-4f97-a7bc-37b9f22ae03d",
    "id_solicitud": "sol-0fac502f-917a-461d-882b-008e26c06051",
    "id_hospedaje": "hos-6a9d47ed-7fe7-43bd-9c52-2bd942313c3a",
    "id_booking": "boo-04525ebb-2c1c-41e9-8cd4-fe97a5cb1d32",
    "id_viajero_reserva": "via-e31c5251-d313-40a2-8cbf-81082429b7ec" 
    // ... (other metadata fields from payload 2 if needed)
  },
  "estado_reserva": {
    "before": null, // From payload 2
    "current": "Confirmada" // From payload 2
  },
  "codigo_reservacion_hotel": {
    "before": "fhjk-editad", // From payload 2
    "current": "fhjk-editado" // From payload 2
  },
  "comments": {
    "before": "vamos a probar con esta reserva hacer payloads-editad", // From payload 2
    "current": "vamos a probar con esta reserva hacer payloads-editado" // From payload 2
  },
  "check_in": {
    // Assuming check_in doesn't change based on both payloads
    "before": "2025-10-22T06:00:00.000Z", // From metadata in payload 2
    "current": "2025-10-22T06:00:00.000Z" // From metadata in payload 2
  },
  "check_out": {
    "before": "2025-10-23", // From payload 2
    "current": "2025-10-25" // From payload 2
  },
  "venta": {
    "before": { 
        "total": 841 // From payload 2
    },
    "current": { 
        "total": 2523 // From payload 2 (matches payload 1's precioActualizado)
    }
  },
  "noches": {
    "before": 1, // From payload 2
    "current": 3 // From payload 2 (matches payload 1's noches)
  },
  "nuevo_incluye_desayuno": null, // From payload 2
  "acompanantes": [], // From payload 2
  "viajero": { // Assuming traveler doesn't change (both payloads have the same one)
      "current": {
          "id_viajero": "via-e31c5251-d313-40a2-8cbf-81082429b7ec" 
      }
  },
  "hotel": { // Assuming hotel doesn't change
      "current": {
          "name": "12 BEES HOTEL" // Consistent in both payloads
      }
  },
  "habitacion": { // Assuming room doesn't change
      "current": "SENCILLO" // Consistent in both payloads
  },
  "impuestos": { // Extracted from payload 1
    "iva": 16,
    "ish": 5,
    "otros_impuestos": 0
  },
  "updatedSaldos": [ // From payload 1
    {
      "id_saldos": 62,
      "id_agente": "7d85fc3a-d799-40ec-aff3-9e26e2271abd",
      "saldo": "1318.00", // Current balance *before* this transaction
      "monto": "3000.00", // Original amount of this balance entry
      "metodo_pago": "wallet",
      "is_facturado": 0, // This wallet payment IS NOT facturado
      "monto_facturado": "0.00",
      "monto_cargado_al_item": "1682.00" // Amount used for this adjustment
    }
  ]
}

const hasKey = (obj, key) =>
  obj && Object.prototype.hasOwnProperty.call(obj, key);

async function caso_base({ 
  // --- IDs ---
  id_servicio, id_hospedaje, id_booking, 
  // --- Campos monetarios/estado ---
  total, estado, 
  // --- Fechas/Noches ---
  check_in, check_out, noches, 
  // --- Viajeros ---
  id_viajero_principal, 
  acompanantes,
  // --- Campos de Hospedaje ---
  codigo_reservacion_hotel,
  comments,
  hotel,
  habitacion,
  nuevo_incluye_desayuno
}) {
  
  // Extraemos los valores 'current' del payload
  const nuevo_check_in = check_in?.current;
  const nuevo_check_out = check_out?.current;
  const nuevas_noches = noches?.current;

  const response_caso_base = await runTransaction(async (connection) => {
    
    // 1) Actualizar Servicio (Total)
    // Tu tabla 'servicios' también tiene subtotal e impuestos
    const { subtotal, impuestos } = Calculo.precio({ total: total }); 
    await Servicio.update(connection, Calculo.cleanEmpty({ 
      id_servicio, 
      total,
      subtotal,
      impuestos
    }));

    // 2) Actualizar Booking (Fechas, Total, Estado)
    await Booking.update(connection, Calculo.cleanEmpty({ 
      id_booking, 
      estado,
      total,        // total también está en bookings
      subtotal,     // subtotal también está en bookings
      impuestos,    // impuestos también está en bookings
      check_in: nuevo_check_in,  // <-- Mapeo correcto
      check_out: nuevo_check_out // <-- Mapeo correcto
    }));

    // 3) Actualizar Hospedaje (Metadatos)
    await Hospedaje.update(connection, Calculo.cleanEmpty({ 
      id_hospedaje, // Usamos id_hospedaje para el WHERE (asumiendo que tu update lo hace así)
      noches: nuevas_noches,
      codigo_reservacion_hotel: codigo_reservacion_hotel?.current, // <-- Mapeo correcto
      comments: comments?.current,
      nombre_hotel: hotel?.current?.name,
      tipo_cuarto: habitacion?.current, // <-- Mapeo correcto
      nuevo_incluye_desayuno: nuevo_incluye_desayuno
    }));

    // 4) Sincronizar Viajeros (Esta lógica se mantiene igual)
    let viajerosTx = { inserted: 0, deleted: 0, updated: 0, skipped: true };
    const shouldUpdateTravelers = id_viajero_principal || Array.isArray(acompanantes);

    if (shouldUpdateTravelers && id_hospedaje) {
        // ... (Tu lógica de viajeros que ya tenías)
        viajerosTx.skipped = false;
        
        const [viajerosActualesRows] = await connection.execute(
          `SELECT id_viajero, is_principal FROM viajeros_hospedajes WHERE id_hospedaje = ?`,
          [id_hospedaje]
        );
        // ... (resto de la lógica de viajeros)
    }
    
    return { /* ... */ };
  });
  
  return response_caso_base;
}

const editar_reserva_definitivo = async (req, res) => {
  console.log("LOG: Iniciando editar_reserva_definitivo. Payload recibido:", req.body);
  const {
    metadata,
    venta,
    noches,
    check_in,
    check_out,
    estado_reserva,
    viajero,
    acompanantes,
    codigo_reservacion_hotel,
    comments,
    hotel,
    habitacion,
    nuevo_incluye_desayuno,
    impuestos,
    updatedSaldos
  } = req.body || {};

  try {
    if (!metadata || !venta?.current || !noches?.current) {
        console.error("LOG: Error de validación, faltan datos clave.");
        return res.status(400).json({ error: "Faltan datos clave (metadata, venta.current, noches.current)." });
    }
    
    const TASA_IVA_DECIMAL = (impuestos?.iva / 100.0) || 0.16; 
    console.log(`LOG: TASA_IVA_DECIMAL calculada: ${TASA_IVA_DECIMAL}`);

    // --- PASO 1: Edición no monetaria ---
    console.log("LOG: --- INICIANDO PASO 1: caso_base ---");
    const resultado_paso_1 = await caso_base({
      // ... (todos los parámetros de caso_base)
      id_servicio: metadata.id_servicio,
      id_hospedaje: metadata.id_hospedaje,
      id_booking: metadata.id_booking,
      total: venta.current.total,
      estado: estado_reserva?.current,
      check_in: check_in,
      check_out: check_out,
      noches: noches,
      id_viajero_principal: viajero?.current?.id_viajero,
      acompanantes: acompanantes,
      codigo_reservacion_hotel: codigo_reservacion_hotel,
      comments: comments,
      hotel: hotel,
      habitacion: habitacion,
      nuevo_incluye_desayuno: nuevo_incluye_desayuno
    });
    console.log("LOG: --- FIN PASO 1. Resultado:", resultado_paso_1);

    // --- PASO 2: Edición monetaria (Items, Fiscal) ---
    
    const { cambian_noches, delta_noches } = Calculo.cambian_noches(noches);
    const { cambia_precio_de_venta, delta_precio_venta } = Calculo.cambia_precio_de_venta(venta);
    console.log(`LOG: Deltas calculados: cambian_noches=${cambian_noches}, delta_noches=${delta_noches}, cambia_precio_de_venta=${cambia_precio_de_venta}, delta_precio_venta=${delta_precio_venta}`);

    if (cambian_noches || cambia_precio_de_venta) {
      console.log("LOG: --- INICIANDO PASO 2: Lógica Monetaria ---");

      const estado_fiscal = await is_invoiced_reservation(metadata.id_servicio);
      console.log("LOG: Resultado is_invoiced_reservation (estado_fiscal):", estado_fiscal);
      
      const saldos_aplicados = updatedSaldos || [];
      const saldos_facturados_usados = await are_invoiced_payments({ saldos: saldos_aplicados });
      console.log("LOG: Resultado are_invoiced_payments (saldos_facturados_usados):", saldos_facturados_usados);

      // --- INICIO TRANSACCIÓN MONETARIA ---
      console.log("LOG: Iniciando runTransaction (Paso 2)");
      await runTransaction(async (connection) => {
        
        let items_activos = await Item.findActivos(connection, metadata.id_hospedaje, 'ASC');
        console.log(`LOG: Items activos encontrados: ${items_activos.length}`);
        
        let items_nuevos = [];
        let item_ajuste = null;
        let items_pagados_con_wallet = []; 
        let facturas_heredadas_json = [];

        // --- A. RESOLVER ΔNOCHES ---
        if (delta_noches > 0) {
          console.log(`LOG: (A) Resolviendo delta_noches > 0 (${delta_noches})`);
          const fecha_ultima_noche = items_activos.length > 0 ? items_activos[items_activos.length - 1].fecha_uso : check_in.current; 
          console.log(`LOG: Fecha última noche base: ${fecha_ultima_noche}`);

          items_nuevos = await Item.agregar_nuevas_noches(connection, metadata.id_hospedaje, fecha_ultima_noche, delta_noches, TASA_IVA_DECIMAL);
          console.log(`LOG: ${items_nuevos.length} items nuevos creados.`);

          if (delta_precio_venta === 0) { // Flujo A
              items_pagados_con_wallet.push(...items_nuevos);
              console.log("LOG: (Flujo A) Items nuevos añadidos a items_pagados_con_wallet.");
          }
          
        } else if (delta_noches < 0) {
          console.log(`LOG: (A) Resolviendo delta_noches < 0 (${delta_noches})`);
          const items_desactivados = await Item.desactivar_noches_lifo(connection, metadata.id_hospedaje, Math.abs(delta_noches));
          console.log(`LOG: ${items_desactivados.length} items desactivados.`);
          
          if (estado_fiscal.es_facturada && items_desactivados.length > 0) {
            console.log("LOG: Ejecutando manejar_desactivacion_fiscal (Regla Morada)...");
            await manejar_desactivacion_fiscal(connection, items_desactivados, estado_fiscal.facturas);
            console.log("LOG: manejar_desactivacion_fiscal completado.");
          }
        }
        
        items_activos = await Item.findActivos(connection, metadata.id_hospedaje, 'ASC');
        console.log(`LOG: Items activos (post-Δnoches): ${items_activos.length}`);

        // --- B. RESOLVER ΔPRECIO ---
        const nuevo_total_venta = venta.current.total;
        console.log(`LOG: (B) Resolviendo delta_precio_venta (${delta_precio_venta}). Nuevo total: ${nuevo_total_venta}`);

        if (delta_precio_venta > 0) {
          console.log("LOG: (Flujo B, D, G) Creando item de ajuste...");
          item_ajuste = await Item.crear_item_ajuste(connection, metadata.id_hospedaje, delta_precio_venta, TASA_IVA_DECIMAL);
          console.log("LOG: Item de ajuste creado:", item_ajuste);
          
          items_pagados_con_wallet.push(item_ajuste);
          
          // Lógica de Herencia Fiscal
          if (saldos_facturados_usados.length > 0 && estado_fiscal.es_facturada) {
            console.log("LOG: Iniciando lógica de herencia fiscal...");
            const id_saldo_usado = saldos_facturados_usados[0].id_saldos;
            console.log(`LOG: Consultando vw_reporte_pagos_facturados por id_pago: ${id_saldo_usado}`);
            const [rows] = await connection.execute("SELECT facturas_asociadas FROM vw_reporte_pagos_facturados WHERE id_pago = ?", [id_saldo_usado]);
            console.log("LOG: Resultado de la vista:", rows);

            if (rows && rows.length > 0 && rows[0].facturas_asociadas) {
                try {
                    facturas_heredadas_json = JSON.parse(rows[0].facturas_asociadas);
                } catch (e) { throw new Error("(revisar la data con finanzas)"); }

                // Validación de integridad
                console.log("LOG: Validando integridad de facturas heredadas...");
                for (const fac of facturas_heredadas_json) {
                    const saldo = parseFloat(fac.saldo_x_aplicar_items || 0);
                    const total = parseFloat(fac.total_factura || 0);
                    if (saldo < 0 || saldo > total) {
                        console.error(`ERROR DE INTEGRIDAD: Factura ${fac.id_factura} tiene saldo (${saldo}) inválido vs total (${total})`);
                        throw new Error("(revisar la data con finanzas)");
                    }
                }
                console.log("LOG: Validación de integridad OK.");
            }

            await asociar_factura_items_logica(connection, metadata.id_hospedaje, items_pagados_con_wallet, facturas_heredadas_json);
            console.log("LOG: Lógica de herencia fiscal (asociar_factura_items_logica) completada.");
          }
          
        } else if (delta_precio_venta < 0) {
          console.log("LOG: (Flujo C, E, G) Aplicando split por reducción de precio...");
          await Item.aplicar_split_precio(connection, items_activos, nuevo_total_venta, TASA_IVA_DECIMAL);
          console.log("LOG: Split completado.");
          
          if (estado_fiscal.es_facturada) {
            console.log("LOG: Ejecutando manejar_reduccion_fiscal (Down-scale)...");
            await manejar_reduccion_fiscal(connection, items_activos, estado_fiscal.facturas);
            console.log("LOG: manejar_reduccion_fiscal completado.");
          }
          
        } else if (delta_precio_venta === 0 && cambian_noches) {
          console.log("LOG: (Flujo A, F) Aplicando split (mismo precio, noches distintas)...");
          await Item.aplicar_split_precio(connection, items_activos, nuevo_total_venta, TASA_IVA_DECIMAL);
          console.log("LOG: Split completado.");
        }
        
        // --- C. GESTIÓN DE PAGOS (items_pagos) ---
        if (saldos_aplicados.length > 0 && items_pagados_con_wallet.length > 0) {
          console.log("LOG: (C) Iniciando gestión de pagos (items_pagos)...");
          
          const nuevo_id_pago = await crear_pago_desde_wallet(connection, metadata.id_servicio, saldos_aplicados);
          console.log(`LOG: Nuevo pago creado: ${nuevo_id_pago}`);
          
          await asociar_items_a_pago(connection, metadata.id_hospedaje, nuevo_id_pago, items_pagados_con_wallet);
          console.log("LOG: Vínculos items_pagos creados.");
        }

        console.log("LOG: --- FIN PASO 2: TRANSACCION MONETARIA COMPLETA (COMMIT) ---");
      }); // <-- Fin de runTransaction
    } else {
      console.log("LOG: --- PASO 2 OMITIDO: Sin cambios monetarios o de noches ---");
    }

    // --- 3. RESPUESTA ---
    console.log("LOG: Enviando respuesta exitosa (200).");
    return res.status(200).json({
      message: "Reserva actualizada exitosamente",
      resultado_paso_1
    });

  } catch (error) {
    console.error("LOG: --- ERROR CAPTURADO EN EL CONTROLADOR ---", error);
    if (error.message === "(revisar la data con finanzas)") {
        return res.status(409).json({ // 409 Conflict
            error: "Conflicto de integridad de datos.",
            detalle: error.message
        });
    }
    return res.status(500).json({ 
        error: "Ocurrió un error al procesar la edición.",
        detalle: error.message 
    });
  }
};