const {
  executeQuery,
  executeSP2,
  executeSP,
  runTransaction,
} = require("../../config/db");
const { v4: uuidv4 } = require("uuid");
const { CustomError } = require("../../middleware/errorHandler");
const Booking = require("../model/bookings.model");
const Servicio = require("../model/servicios.model");
const Hospedaje = require("../model/hospedajes.model");
const Item = require("../model/item.model");
const { Calculo, calcularNoches } = require("../../lib/utils/calculates");

/* =========================
 * UTILIDADES / HELPERS
 * ========================= */

function toNumber(n, def = NaN) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function hasPrecioChange(venta) {
  const before = toNumber(venta?.before?.total);
  const current = toNumber(venta?.current?.total);
  if (!Number.isFinite(before) || !Number.isFinite(current)) return false;
  return Math.abs(current - before) > 0.009;
}

function hasNochesChange(noches) {
  const before = toNumber(noches?.before);
  const current = toNumber(noches?.current);
  if (!Number.isFinite(before) || !Number.isFinite(current)) return false;
  return current !== before;
}

/* =========================
 * PAGOS
 * ========================= */

async function crear_pago_desde_wallet(connection, id_servicio, saldos_aplicados) {
  console.log("💳 [WALLET] Iniciando crear_pago_desde_wallet");

  if (!Array.isArray(saldos_aplicados) || saldos_aplicados.length === 0) {
    console.log("💳 [WALLET] No hay saldos_aplicados válidos. Se omite creación de pago.");
    return null;
  }

  const monto_total = saldos_aplicados.reduce(
    (acc, s) => acc + parseFloat(s?.saldo_usado || 0),
    0
  );

  if (monto_total <= 0) {
    console.log("💳 [WALLET] El monto_total de saldos_aplicados es <= 0. No se crea pago.");
    return null;
  }

  const primer = saldos_aplicados[0] || {};
  const id_saldo_principal = primer.id_saldos || null;
  const id_agente = primer.id_agente || null;
  const id_pago = `pag-${uuidv4()}`;
  const transaccion = id_pago;

  const insert = `
    INSERT INTO pagos (
      id_pago, id_servicio, total, concepto, metodo_de_pago, tipo_de_pago,
      id_saldo_a_favor, id_agente, estado, fecha_creacion, fecha_pago,
      transaccion, saldo_aplicado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)`;

  const params = [
    id_pago,
    id_servicio,
    monto_total,
    "Pago desde wallet",
    "wallet",
    "wallet",
    id_saldo_principal,
    id_agente,
    "completado",
    transaccion,
    monto_total,
  ];

  await connection.execute(insert, params);
  console.log(`💳 [WALLET] Pago creado exitosamente: ${id_pago} por ${monto_total}`);
  return id_pago;
}

/**
 * Inserta vínculos en items_pagos para una lista de items con su monto a asociar.
 * items_a_vincular: [{ id_item, monto }]
 */
async function asociar_items_a_pago(connection, id_hospedaje, id_pago, items_a_vincular) {
  if (!Array.isArray(items_a_vincular) || items_a_vincular.length === 0) {
    console.log("🔗 [ITEMS_PAGOS] No hay items_a_vincular. Se omite asociación.");
    return;
  }

  console.log(
    `🔗 [ITEMS_PAGOS] Vinculando ${items_a_vincular.length} items al pago ${id_pago}`
  );

  for (const item of items_a_vincular) {
    const monto = parseFloat(item.monto || 0);
    if (monto <= 0) continue;

    const [result] = await connection.execute(
      `INSERT INTO items_pagos (id_item, id_pago, monto, id_relacion) VALUES (?, ?, ?, ?)`,
      [item.id_item, id_pago, monto, id_hospedaje]
    );
    console.log(
      `🔗 [ITEMS_PAGOS] Vínculo creado para item ${item.id_item} por monto ${monto}. Info:`,
      result?.info || ""
    );
  }
}

/* =========================
 * QUERIES AUX
 * ========================= */

async function get_payment_type(id_solicitud, id_servicio) {
  const query_credito = `select case when id_credito is not null then 1 else 0 end as is_credito 
    from vw_reservas_client where id_solicitud = ?;`;

  const query_pago_directo = `Select case when id_saldo_a_favor is null then 1 else 0 end as is_pago_directo
    from pagos where id_servicio = ?`;
  const query_wallet = `Select case when id_saldo_a_favor is not null then 1 else 0 end as is_wallet
    from pagos where id_servicio = ?`;

  let tipo_pago;
  const result_credito = await executeQuery(query_credito, [id_solicitud]);
  const result_pago_directo = await executeQuery(query_pago_directo, [id_servicio]);
  const result_wallet = await executeQuery(query_wallet, [id_servicio]);
  if (result_credito[0]?.is_credito) {
    tipo_pago = "credito";
  } else if (result_pago_directo[0]?.is_pago_directo) {
    tipo_pago = "pago_directo";
  } else if (result_wallet[0]?.is_wallet) {
    tipo_pago = "wallet";
  }
  console.log(`🧾 [TIPO_PAGO] id_servicio=${id_servicio} → tipo_pago_original=${tipo_pago}`);
  return tipo_pago;
}

async function is_invoiced_reservation(id_servicio) {
  const pagos_y_facturas = await executeSP("sp_get_facturas_pagos_by_id_servicio", [
    id_servicio,
  ]);
  console.log("🧾 [FISCAL] Estado fiscal (get_facturas_pagos_by_id_servicio) obtenido.");
  return pagos_y_facturas;
}

async function are_invoiced_payments({ saldos }) {
  if (!Array.isArray(saldos) || saldos.length === 0) return [];
  const ids = saldos.map((s) => s?.id_saldos).filter(Boolean);
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  const query = `SELECT id_saldos 
                 FROM saldos_a_favor 
                 WHERE id_saldos IN (${placeholders}) AND is_facturado = 1`;
  const result = await executeQuery(query, ids);
  const ids_facturados = result.map((r) => r.id_saldos);
  const filtrados = saldos.filter((s) => ids_facturados.includes(s.id_saldos));
  console.log(`🧾 [FISCAL] Saldos facturados usados: ${filtrados.length}/${saldos.length}`);
  return filtrados;
}

/* =========================
 * LÓGICA FISCAL
 * ========================= */

async function asociar_factura_items_logica(connection, id_hospedaje, items_a_vincular, facturas_disponibles) {
  console.log(`🧾 [FISCAL] Iniciando consumo fiscal para ${items_a_vincular.length} items.`);
  let facturas = JSON.parse(JSON.stringify(facturas_disponibles));
  if (!facturas || facturas.length === 0) {
    console.warn("🧾 [FISCAL] No hay facturas disponibles para herencia fiscal.");
    return;
  }

  let idx_factura_actual = 0;

  for (const item of items_a_vincular) {
    let monto_pendiente_item = parseFloat(item.total);

    while (monto_pendiente_item > 0.01) {
      if (idx_factura_actual >= facturas.length) {
        console.error(
          `🧾 [FISCAL][ERROR] No hay suficiente saldo facturado para cubrir el item ${item.id_item}. Faltan ${monto_pendiente_item}`
        );
        throw new Error("(revisar la data con finanzas)");
      }

      let factura_actual = facturas[idx_factura_actual];
      let saldo_factura = parseFloat(factura_actual.saldo_x_aplicar_items || 0);
      if (saldo_factura < 0.01) {
        idx_factura_actual++;
        continue;
      }

      const monto_a_aplicar = Math.min(monto_pendiente_item, saldo_factura);

      await connection.execute(
        `INSERT INTO items_facturas (id_item, id_factura, monto, id_relacion) 
         VALUES (?, ?, ?, ?)`,
        [item.id_item, factura_actual.id_factura, monto_a_aplicar, id_hospedaje]
      );

      await connection.execute(
        "UPDATE facturas SET saldo_x_aplicar_items = saldo_x_aplicar_items - ? WHERE id_factura = ?",
        [monto_a_aplicar, factura_actual.id_factura]
      );

      monto_pendiente_item -= monto_a_aplicar;
      factura_actual.saldo_x_aplicar_items = saldo_factura - monto_a_aplicar;

      console.log(
        `🧾 [FISCAL] Aplicados ${monto_a_aplicar} del item ${item.id_item} a factura ${factura_actual.id_factura}. Pendiente item: ${monto_pendiente_item}`
      );
    }
  }
}

async function manejar_desactivacion_fiscal(connection, items_desactivados, facturas_reserva) {
  console.log("🧾 [FISCAL] Manejando desactivación fiscal (Regla Morada)...");
  if (items_desactivados.length === 0 || facturas_reserva.length === 0) return;

  const factura_principal = facturas_reserva[0];
  let monto_liberado_total = 0;
  const ids_desactivados = [];

  for (const item of items_desactivados) {
    const monto_facturado = parseFloat(item.monto_facturado_previo || 0);
    if (monto_facturado > 0) {
      monto_liberado_total += monto_facturado;
      ids_desactivados.push(item.id_item);
    }
  }

  if (monto_liberado_total > 0) {
    const placeholders = ids_desactivados.map(() => "?").join(",");
    await connection.execute(
      `UPDATE items_facturas SET monto = 0 WHERE id_item IN (${placeholders}) AND id_factura = ?`,
      [...ids_desactivados, factura_principal.id_factura]
    );

    await connection.execute(
      "UPDATE facturas SET saldo_x_aplicar_items = saldo_x_aplicar_items + ? WHERE id_factura = ?",
      [monto_liberado_total, factura_principal.id_factura]
    );

    console.log(`🧾 [FISCAL] Liberado ${monto_liberado_total} a saldo_x_aplicar_items en factura ${factura_principal.id_factura}`);
  }
}

async function manejar_reduccion_fiscal(connection, items_activos_post_split, facturas_reserva) {
  console.log("🧾 [FISCAL] Manejando reducción fiscal (Down-scale)...");
  if (facturas_reserva.length === 0) return;

  const factura_principal = facturas_reserva[0];

  const [rows] = await connection.execute(
    "SELECT saldo_x_aplicar_items, id_agente, total FROM facturas WHERE id_factura = ?",
    [factura_principal.id_factura]
  );

  if (!rows || rows.length === 0) return;

  let monto_liberado_reasignable = parseFloat(rows[0]?.saldo_x_aplicar_items || 0);
  const id_agente = rows[0]?.id_agente;
  const total_factura = parseFloat(rows[0]?.total || 0);

  if (monto_liberado_reasignable < 0 || monto_liberado_reasignable > total_factura) {
    console.error(
      `🧾 [FISCAL][ERROR] Factura ${factura_principal.id_factura} saldo inválido (${monto_liberado_reasignable}) vs total (${total_factura})`
    );
    throw new Error("(revisar la data con finanzas)");
  }

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

  if (monto_liberado_reasignable > 0) {
    console.log(`🧾 [FISCAL] Generando devolución no facturable por ${monto_liberado_reasignable}`);
    await connection.execute(
      `INSERT INTO saldos_a_favor (id_agente, monto, concepto, activo, is_facturable, is_devolucion, monto_facturado, fecha_creacion, fecha_pago) 
       VALUES (?, ?, ?, 1, 0, 1, 0, CURDATE(), CURDATE())`,
      [rows[0]?.id_agente, monto_liberado_reasignable, "Devolucion por ajuste de reserva"]
    );

    await connection.execute(
      "UPDATE facturas SET saldo_x_aplicar_items = 0 WHERE id_factura = ?",
      [factura_principal.id_factura]
    );
  }
}

/* =========================
 * CRÉDITO
 * ========================= */

async function actualizar_credito_existente(connection, id_servicio, delta_total) {
  console.log(`🏦 [CREDITO] Actualizando pagos_credito para ${id_servicio} por delta: ${delta_total}`);

  const findQuery = `SELECT id_credito FROM pagos_credito WHERE id_servicio = ? ORDER BY created_at DESC LIMIT 1`;
  const [rows] = await connection.execute(findQuery, [id_servicio]);

  if (!rows || rows.length === 0) {
    console.warn(
      `🏦 [CREDITO] No se encontró registro en pagos_credito para ${id_servicio}. No se pudo actualizar.`
    );
    return;
  }

  const id_credito_a_actualizar = rows[0].id_credito;
  const updateQuery = `
    UPDATE pagos_credito 
    SET 
      total = total + ?, 
      subtotal = (total + ?) / 1.16,
      impuestos = (total + ?) - ((total + ?) / 1.16),
      monto_a_credito = monto_a_credito + ?,
      pendiente_por_cobrar = pendiente_por_cobrar + ?
    WHERE id_credito = ?`;

  const [updateResult] = await connection.execute(updateQuery, [
    delta_total,
    delta_total,
    delta_total,
    delta_total,
    delta_total,
    delta_total,
    id_credito_a_actualizar,
  ]);
  console.log("🏦 [CREDITO] Resultado UPDATE pagos_credito:", updateResult?.info || "");
}

async function crear_nuevo_pago_credito(connection, id_servicio, delta_total, id_agente, id_empresa) {
  console.log(`🏦 [CREDITO] Creando NUEVO pagos_credito para ${id_servicio} por delta: ${delta_total}`);

  const nuevo_id_credito = `cred-${uuidv4()}`;
  const { subtotal, impuestos } = Calculo.precio({ total: delta_total });

  const insertQuery = `
    INSERT INTO pagos_credito 
      (id_credito, id_servicio, monto_a_credito, total, subtotal, impuestos, 
       pendiente_por_cobrar, pago_por_credito, fecha_creacion, concepto, 
       responsable_pago_agente)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURDATE(), ?, ?)`;

  const [insertResult] = await connection.execute(insertQuery, [
    nuevo_id_credito,
    id_servicio,
    delta_total,
    delta_total,
    subtotal,
    impuestos,
    delta_total,
    "Ajuste de precio en reserva (crédito)",
    id_agente,
  ]);
  console.log("🏦 [CREDITO] Resultado INSERT pagos_credito:", insertResult?.info || "");
  return nuevo_id_credito;
}

async function obtener_total_pagado_credito(connection, id_servicio) {
  console.log(`🏦 [CREDITO] Obteniendo total pagado para servicio (crédito) ${id_servicio}`);
  const query = `
        SELECT SUM(pago_por_credito) as total_pagado 
        FROM pagos_credito 
        WHERE id_servicio = ?`;
  const [rows] = await connection.execute(query, [id_servicio]);
  const total_pagado = parseFloat(rows[0]?.total_pagado || 0);
  console.log(`🏦 [CREDITO] Total pagado (crédito) encontrado: ${total_pagado}`);
  return total_pagado;
}

/* =========================
 * CASO BASE TOLERANTE
 * ========================= */

async function caso_base_tolerante({
  id_servicio,
  id_hospedaje,
  id_booking,
  total,
  estado,
  check_in,
  check_out,
  noches,
  id_viajero_principal,
  acompanantes,
  codigo_reservacion_hotel,
  comments,
  hotel,
  habitacion,
  nuevo_incluye_desayuno,
}) {
  return await runTransaction(async (connection) => {
    console.log("🧱 [CASO_BASE] Iniciando caso_base_tolerante...");

    // 1) Servicio (solo si viene total numérico)
    if (Number.isFinite(total)) {
      const { subtotal, impuestos } = Calculo.precio({ total });
      await Servicio.update(
        connection,
        Calculo.cleanEmpty({
          id_servicio,
          total,
          subtotal,
          impuestos,
        })
      );
      console.log("🧱 [CASO_BASE] Servicio.update aplicado con total:", total);
    }

    // 2) Booking
    const updatesBooking = Calculo.cleanEmpty({
      id_booking,
      estado,
      ...(check_in?.current ? { check_in: check_in.current } : {}),
      ...(check_out?.current ? { check_out: check_out.current } : {}),
    });

    if (Number.isFinite(total)) {
      const { subtotal, impuestos } = Calculo.precio({ total });
      Object.assign(updatesBooking, { total, subtotal, impuestos });
    }

    if (Object.keys(updatesBooking).length > 1) {
      await Booking.update(connection, updatesBooking);
      console.log("🧱 [CASO_BASE] Booking.update aplicado:", updatesBooking);
    } else {
      console.log("🧱 [CASO_BASE] Booking.update omitido (sin cambios).");
    }

    // 3) Hospedaje
    const updatesHosp = Calculo.cleanEmpty({
      id_hospedaje,
      ...(Number.isFinite(noches?.current) ? { noches: noches.current } : {}),
      ...(codigo_reservacion_hotel?.current
        ? { codigo_reservacion_hotel: codigo_reservacion_hotel.current }
        : {}),
      ...(comments?.current ? { comments: comments.current } : {}),
      ...(hotel?.current?.name ? { nombre_hotel: hotel.current.name } : {}),
      ...(habitacion?.current ? { tipo_cuarto: habitacion.current } : {}),
      ...(typeof nuevo_incluye_desayuno !== "undefined" ? { nuevo_incluye_desayuno } : {}),
    });

    if (Object.keys(updatesHosp).length > 1) {
      await Hospedaje.update(connection, updatesHosp);
      console.log("🧱 [CASO_BASE] Hospedaje.update aplicado:", updatesHosp);
    } else {
      console.log("🧱 [CASO_BASE] Hospedaje.update omitido (sin cambios).");
    }

    // 4) Viajeros
    const debeActualizarViajeros = id_viajero_principal || Array.isArray(acompanantes);
    if (debeActualizarViajeros && id_hospedaje) {
      const [viajerosActualesRows] = await connection.execute(
        `SELECT id_viajero, is_principal FROM viajeros_hospedajes WHERE id_hospedaje = ?`,
        [id_hospedaje]
      );

      const actuales = new Map(viajerosActualesRows.map((r) => [String(r.id_viajero), r]));

      // principal
      if (id_viajero_principal) {
        const idP = String(id_viajero_principal);
        const yaP = viajerosActualesRows.find((r) => r.is_principal === 1);
        if (!yaP || String(yaP.id_viajero) !== idP) {
          await connection.execute(
            `DELETE FROM viajeros_hospedajes WHERE id_hospedaje = ? AND is_principal = 1`,
            [id_hospedaje]
          );
          await connection.execute(
            `INSERT INTO viajeros_hospedajes (id_hospedaje, id_viajero, is_principal) VALUES (?, ?, 1)`,
            [id_hospedaje, idP]
          );
          console.log("🧱 [CASO_BASE] Principal actualizado a:", idP);
        }
      }

      // acompañantes (no principal)
      const nuevosAcomp = new Set(
        (acompanantes || []).map((a) => String(a.id_viajero)).filter(Boolean)
      );

      const paraEliminar = [];
      for (const r of viajerosActualesRows) {
        if (r.is_principal) continue;
        if (!nuevosAcomp.has(String(r.id_viajero))) paraEliminar.push(String(r.id_viajero));
      }
      if (paraEliminar.length) {
        const ph = paraEliminar.map(() => "?").join(",");
        await connection.execute(
          `DELETE FROM viajeros_hospedajes WHERE id_hospedaje = ? AND is_principal = 0 AND id_viajero IN (${ph})`,
          [id_hospedaje, ...paraEliminar]
        );
        console.log("🧱 [CASO_BASE] Acompañantes removidos:", paraEliminar);
      }
      for (const id of nuevosAcomp) {
        if (!actuales.has(id)) {
          await connection.execute(
            `INSERT INTO viajeros_hospedajes (id_hospedaje, id_viajero, is_principal) VALUES (?, ?, 0)`,
            [id_hospedaje, id]
          );
          console.log("🧱 [CASO_BASE] Acompañante agregado:", id);
        } else {
          const r = actuales.get(id);
          if (r.is_principal) {
            await connection.execute(
              `UPDATE viajeros_hospedajes SET is_principal = 0 WHERE id_hospedaje = ? AND id_viajero = ?`,
              [id_hospedaje, id]
            );
            console.log("🧱 [CASO_BASE] Acompañante corregido de principal→0:", id);
          }
        }
      }
    }

    return { ok: true };
  });
}

/* =========================
 * CONTROLADOR PRINCIPAL
 * ========================= */

const editar_reserva_definitivo = async (req, res) => {
  console.log("🚀 [EDITAR_RESERVA] Iniciando editar_reserva_definitivo. 🧱 caso_base safe");

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
    saldos,
    restante,
  } = req.body;

  try {
    // IDs mínimos
    if (!metadata?.id_servicio || !metadata?.id_hospedaje || !metadata?.id_booking) {
      console.warn("⚠️ [EDITAR_RESERVA] Faltan IDs clave:", {
        hasServicio: !!metadata?.id_servicio,
        hasHospedaje: !!metadata?.id_hospedaje,
        hasBooking: !!metadata?.id_booking,
      });
      return res
        .status(400)
        .json({ error: "Faltan IDs clave (id_servicio, id_hospedaje, id_booking)." });
    }

    const hayCambioPrecio = hasPrecioChange(venta);
    const hayCambioNoches = hasNochesChange(noches);
    const haySaldos = Array.isArray(saldos) && saldos.length > 0;

    // Normaliza "restante" (puede venir string/undefined)
    const restanteNum = toNumber(restante, NaN);

    // Decide si se debe ejecutar el PASO 2 monetario
    const debeProcesarMonetario = (
      hayCambioPrecio || hayCambioNoches || haySaldos || Number.isFinite(restanteNum)
    );

    console.log("🔎 [EDITAR_RESERVA] Flags:", {
      hayCambioPrecio,
      hayCambioNoches,
      haySaldos,
      restanteNum,
      debeProcesarMonetario
    });

    // Validaciones estrictas cuando hay cambios monetarios
    if (hayCambioPrecio && !Number.isFinite(venta?.current?.total)) {
      return res
        .status(400)
        .json({ error: "Cambio de precio detectado, pero falta venta.current.total." });
    }
    if (hayCambioNoches && !Number.isFinite(noches?.current)) {
      return res
        .status(400)
        .json({ error: "Cambio de noches detectado, pero falta noches.current." });
    }

    // Camino caso base Only
    if (!debeProcesarMonetario) {
      const respBase = await caso_base_tolerante({
        id_servicio: metadata.id_servicio,
        id_hospedaje: metadata.id_hospedaje,
        id_booking: metadata.id_booking,
        total: undefined,
        estado: estado_reserva?.current,
        check_in,
        check_out,
        noches,
        id_viajero_principal: viajero?.current?.id_viajero,
        acompanantes,
        codigo_reservacion_hotel,
        comments,
        hotel,
        habitacion,
        nuevo_incluye_desayuno,
      });

      console.log("✅ [EDITAR_RESERVA] Caso base aplicado sin cambios monetarios.");
      return res.status(200).json({
        message: "Caso base aplicado sin cambios monetarios",
        resultado_paso_1: respBase,
        modo: "caso_base_only",
      });
    }

    // --- PASO 1: CASO BASE (si hay cambios monetarios se refleja total) ---
    const totalNuevo = Number.isFinite(venta?.current?.total) ? venta.current.total : undefined;
    const respBase = await caso_base_tolerante({
      id_servicio: metadata.id_servicio,
      id_hospedaje: metadata.id_hospedaje,
      id_booking: metadata.id_booking,
      total: totalNuevo,
      estado: estado_reserva?.current,
      check_in,
      check_out,
      noches,
      id_viajero_principal: viajero?.current?.id_viajero,
      acompanantes,
      codigo_reservacion_hotel,
      comments,
      hotel,
      habitacion,
      nuevo_incluye_desayuno,
    });

    console.log("🧱 [EDITAR_RESERVA] Caso base aplicado (con/para cambios monetarios).");

    // --- PASO 2: MONETARIO ---
    if (debeProcesarMonetario) {
      const TASA_IVA_DECIMAL = (impuestos?.iva / 100.0) || 0.16;

      const { cambian_noches, delta_noches } = Calculo.cambian_noches(noches);
      let { cambia_precio_de_venta, delta_precio_venta } = Calculo.cambia_precio_de_venta(venta);
      delta_precio_venta = toNumber(delta_precio_venta, 0);

      console.log("🔔 [MONETARIO] Cambia precio de venta:", {
        cambia_precio_de_venta,
        delta_precio_venta,
        cambian_noches,
        delta_noches,
        TASA_IVA_DECIMAL
      });

      const tipo_pago_original = await get_payment_type(
        metadata.id_solicitud,
        metadata.id_servicio
      );

      const estado_fiscal = await is_invoiced_reservation(metadata.id_servicio);

      const saldos_aplicados = Array.isArray(saldos)
        ? saldos.filter((s) => s.usado === true && parseFloat(s.saldo_usado || 0) > 0)
        : [];

      const saldos_facturados_usados = await are_invoiced_payments({
        saldos: saldos_aplicados,
      });

      const monto_restante_a_credito = Number.isFinite(restanteNum) ? Math.max(restanteNum, 0) : 0;
      console.log("💰 [MONETARIO] saldos_aplicados:", saldos_aplicados.length, "restanteNum:", restanteNum, "monto_restante_a_credito:", monto_restante_a_credito);

      await runTransaction(async (connection) => {
        console.log("🧾 [TX] Iniciando transacción monetaria...");
        let items_activos_originales = await Item.findActivos(
          connection,
          metadata.id_hospedaje,
          "ASC"
        );

        let items_nuevos = [];
        let item_ajuste = null;
        let items_activos_actuales;

        // --- 1) ITEMS ---
        if (tipo_pago_original === "credito" && (delta_precio_venta < 0 || delta_noches < 0)) {
          console.log("🧾 [ITEMS] Modo crédito decremental.");
          await actualizar_credito_existente(connection, metadata.id_servicio, delta_precio_venta);

          // TODO: lógica específica si se requiere recrear items
          items_activos_actuales = await Item.findActivos(
            connection,
            metadata.id_hospedaje,
            "ASC"
          );
        } else {
          // estándar
          items_activos_actuales = [...items_activos_originales];

          // A) ΔNoches
          if (delta_noches > 0) {
            const fecha_ultima =
              items_activos_actuales.length > 0
                ? items_activos_actuales[items_activos_actuales.length - 1].fecha_uso
                : check_in?.current;

            const noches_finales = toNumber(noches?.current, 0);
            const precio_noche_std = noches_finales > 0 ? venta.current.total / noches_finales : 0;

            // Crea nuevas noches con saldo 0
            items_nuevos = await Item.agregar_nuevas_noches(
              connection,
              metadata.id_hospedaje,
              fecha_ultima,
              delta_noches,
              precio_noche_std
            );
            console.log("🧾 [ITEMS] Nuevas noches creadas:", items_nuevos.length);
          } else if (delta_noches < 0) {
            const items_desactivados = await Item.desactivar_noches_lifo(
              connection,
              metadata.id_hospedaje,
              Math.abs(delta_noches)
            );
            console.log("🧾 [ITEMS] Noches desactivadas (LIFO):", items_desactivados.length);
            if (estado_fiscal.es_facturada && items_desactivados.length > 0) {
              await manejar_desactivacion_fiscal(connection, items_desactivados, estado_fiscal.facturas);
            }
          }

          items_activos_actuales = await Item.findActivos(
            connection,
            metadata.id_hospedaje,
            "ASC"
          );

          // B) ΔPrecio
          const nuevo_total_venta = venta?.current?.total ?? venta?.before?.total;
          if (delta_precio_venta > 0) {
            const costo_noches_nuevas = items_nuevos.reduce(
              (sum, it) => sum + parseFloat(it.total || 0),
              0
            );
            const delta_residual = delta_precio_venta - costo_noches_nuevas;
            if (delta_residual > 0.01) {
              item_ajuste = await Item.crear_item_ajuste(
                connection,
                metadata.id_hospedaje,
                delta_residual,
                TASA_IVA_DECIMAL
              );
              console.log("🧾 [ITEMS] Item de ajuste creado por delta residual:", delta_residual, "id_item:", item_ajuste?.id_item);
            }
          } else if (delta_precio_venta < 0) {
            await Item.aplicar_split_precio(
              connection,
              items_activos_actuales,
              nuevo_total_venta,
              TASA_IVA_DECIMAL
            );
            console.log("🧾 [ITEMS] Split de precio aplicado para bajar al nuevo_total_venta:", nuevo_total_venta);
            if (estado_fiscal.es_facturada) {
              await manejar_reduccion_fiscal(
                connection,
                items_activos_actuales,
                estado_fiscal.facturas
              );
            }
          } else if (delta_precio_venta === 0 && cambian_noches) {
            await Item.aplicar_split_precio(
              connection,
              items_activos_actuales,
              nuevo_total_venta,
              TASA_IVA_DECIMAL
            );
            console.log("🧾 [ITEMS] Split de precio aplicado por cambio de noches con delta_precio_venta=0.");
          }
        }

        // --- 2) PAGOS – WALLET / CRÉDITO ---
        if (delta_precio_venta > 0 || (saldos_aplicados.length > 0) || (monto_restante_a_credito > 0)) {
          let monto_total_a_cubrir = Math.max(delta_precio_venta, 0);
          const items_a_pagar = [];

          if (item_ajuste) items_a_pagar.push({ id_item: item_ajuste.id_item, total: parseFloat(item_ajuste.total) });
          for (const it of items_nuevos) {
            items_a_pagar.push({ id_item: it.id_item, total: parseFloat(it.total) });
          }

          console.log("💳 [PAGOS] Items a pagar (ajuste+nuevos):", items_a_pagar.length, "monto_total_a_cubrir:", monto_total_a_cubrir);

          // 2.1 WALLET -> split a items_pagos (aunque los items tengan saldo=0)
          if (saldos_aplicados.length > 0) {
            const walletDisponible = saldos_aplicados.reduce(
              (acc, s) => acc + parseFloat(s.saldo_usado || 0),
              0
            );

            let restanteWallet = Math.min(walletDisponible, monto_total_a_cubrir || walletDisponible);
            const asociacionesWallet = [];

            for (const it of items_a_pagar) {
              if (restanteWallet <= 0) break;
              const asignar = Math.min(it.total, restanteWallet);
              if (asignar > 0.001) {
                asociacionesWallet.push({ id_item: it.id_item, monto: asignar });
                restanteWallet -= asignar;
              }
            }

            if (asociacionesWallet.length > 0) {
              const id_pago_wallet = await crear_pago_desde_wallet(
                connection,
                metadata.id_servicio,
                saldos_aplicados
              );
              if (id_pago_wallet) {
                await asociar_items_a_pago(
                  connection,
                  metadata.id_hospedaje,
                  id_pago_wallet,
                  asociacionesWallet
                );
                console.log("💳 [PAGOS] asociacionesWallet realizadas:", asociacionesWallet.length, "id_pago:", id_pago_wallet);
              }
            }

            if (monto_total_a_cubrir > 0) {
              const cubiertoWallet = walletDisponible - Math.max(restanteWallet, 0);
              monto_total_a_cubrir -= cubiertoWallet;
              console.log("💳 [PAGOS] Wallet cubrió:", cubiertoWallet, "pendiente por cubrir:", monto_total_a_cubrir);
            }
          }

          // 2.2 CRÉDITO (si queda pendiente)
          if (monto_restante_a_credito > 0 && (monto_total_a_cubrir || 0) > 0.01) {
            const aplicarCredito = Math.min(monto_total_a_cubrir, monto_restante_a_credito);
            await crear_nuevo_pago_credito(
              connection,
              metadata.id_servicio,
              aplicarCredito,
              metadata.id_agente,
              metadata.id_empresa
            );
            await connection.execute(
              "UPDATE agentes SET saldo = saldo - ? WHERE id_agente = ?",
              [aplicarCredito, metadata.id_agente]
            );
            console.log("🏦 [CREDITO] Aplicado a servicio:", aplicarCredito, "agente:", metadata.id_agente);

            // (Opcional) distribuir crédito a items_pagos si tu modelo lo requiere
          }
        }

        // 2.3 Devoluciones por ajuste negativo (restante < 0)
        console.log("🔄 [DEVOLUCION] Checando devolución por ajuste negativo...", { cambia_precio_de_venta, delta_precio_venta, restanteNum });
        if (cambia_precio_de_venta && delta_precio_venta < 0 && Number.isFinite(restanteNum) && restanteNum < 0) {
          const monto_devolucion = Math.abs(restanteNum);
          const concepto = `Devolucion por ajuste de reserva en ${metadata.id_hotel ?? ''}`;
          if (!metadata?.id_agente) {
            console.warn("🔄 [DEVOLUCION] No hay id_agente en metadata; no se inserta saldo_a_favor de devolución.");
          } else {
            await connection.execute(
              `INSERT INTO saldos_a_favor (id_agente, monto, saldo, concepto, activo, is_facturable, is_devolucion, monto_facturado, fecha_creacion, fecha_pago) 
               VALUES (?, ?, ?, ?, 1, 0, 1, 0, NOW(), NOW())`,
              [metadata.id_agente, monto_devolucion, monto_devolucion, concepto]
            );
            console.log("🔄 [DEVOLUCION] Devolución creada en saldos_a_favor por:", monto_devolucion, "concepto:", concepto);
          }
        }

        console.log("🧾 [TX] --- FIN PASO 2: TRANSACCION MONETARIA COMPLETA (COMMIT) ---");
      });
    }

    console.log("✅ [EDITAR_RESERVA] Reserva actualizada exitosamente.");
    return res.status(200).json({
      message: "Reserva actualizada exitosamente",
      resultado_paso_1: respBase,
    });
  } catch (error) {
    console.error("💥 [EDITAR_RESERVA][ERROR] Capturado en el controlador:", error);
    if (error?.message === "(revisar la data con finanzas)") {
      return res.status(409).json({
        error: "Conflicto de integridad de datos.",
        detalle: error.message,
      });
    }
    return res.status(500).json({
      error: "Ocurrió un error al procesar la edición.",
      detalle: error?.message,
    });
  }
};

module.exports = { editar_reserva_definitivo };
