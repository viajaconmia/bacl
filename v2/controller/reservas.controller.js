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
const { Calculo, calcularNoches } = require("../../lib/utils/calculates");

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
  const query = `select is_facturado from saldos_a_favor where id_saldos in (${placeholders})`;
  const result = await executeQuery(query, ids);
  return result;
}
async function cambios_noches(noches) {
  const cambian_noches = noches.curent-noches.before === 0 ? false : true;
  const delta_noches = noches.curent - noches.before;
  return {cambian_noches,delta_noches};
}
async function cambia_precio_de_venta(venta) {
  const cambia_precio_de_venta = venta.curent.total - venta.before.total === 0 ? false : true;
  const delta_precio_venta = venta.curent.total - venta.before.total;
  return {cambia_precio_de_venta,delta_precio_venta};
}

async function agregar_items(check_in, check_out,id_hospedaje, total,is_ajuste){

  Array(calcularNoches(check_in,check_out)).fill().map((_,index)=>{
    const fecha_uso = new Date(check_in);
    fecha_uso.setDate(fecha_uso.getDate()+index);
    return {
      id_hospedaje,
      fecha_uso,
      total: is_ajuste ? total : total/calcularNoches(check_in,check_out),
      tipo: is_ajuste ? 'ajuste' : 'normal'
    }
  })
  // esta funcion va a retornar la lista de items a insertar, los calculos
  // deben hacerse a partir de check_in, check_out y total
  // uno de los campos que debemos retornar es fecha_uso que debe llevar cada item
  // si es ajuste solo debe ser un item sin fecha de uso

}
async function desactivar_items(check_in, check_out,id_hospedaje, total,) {
  // debe primero buscar los items activos por id_hospedaje
  // luego a partir de check_in, check_out deben determianr cuales desactivar
}

async function asociar_factura_items(id_hospedaje,{facturas,saldos}) {
/*
  Esto funciona de la siguiente manera 
  Esto es al pagar un ajuste de precio de la reserva (ya sea incremento de 
  noches o ajuste por item de ajuste)
  si el ajuste se paga con un pago facturado, los nuevos items que se generen 
  o el item de ajuste debe asociarse a la factura (items_facturas)

  para eso debemos buscar el id que nos llegue en facturas_pagos_y_saldos
  agrupar el monto facturado para tener referencia de cuanto aplicar por item en 
  items_facturas
*/
  
}

const payload_prueba = {
  // --- Metadatos clave ---
  "metadata": {
    "id_agente": "a6cc4918-0ce0-416d-8ab6-ce157d9a708a",
    "id_servicio": "ser-f5d92776-94ad-417d-862f-30461d719d9b",
    "id_solicitud": "sol-339b5f0b-c591-43ef-adf7-5675c5763c40",
    "id_hospedaje": "hos-3e1e3a36-7404-4563-bb16-ef098a7726a0",
    "id_booking": "boo-9fb55fb6-c216-4047-9c07-19cdd1fe12b7",
    "id_hotel_reserva": "ade78b3e-2a81-11f0-aba2-0a2c204555ab",
    "id_viajero_reserva": "d80a7f6d-8891-4d0f-bf29-885204d34234",
    // ... (resto de metadata no usada directamente por el controller)
  },

  // --- Deltas de Precio y Noches (Núcleo del Paso 2) ---
  "venta": {
    "before": {
      "total": 3027.6,
      "subtotal": 2543.18,
      "impuestos": 484.41
    },
    "current": {
      "total": 6055.2,
      "subtotal": 5220,
      "impuestos": 835.2
    }
  },
  "noches": {
    "before": 2,
    "current": 4
  },
  "check_in": {
    "before": "2025-10-21",
    "current": "2025-10-21" // Check-in no cambió
  },
  "check_out": {
    "before": "2025-10-23",
    "current": "2025-10-25" // Check-out sí cambió
  },

  // --- Campos de Edición (Paso 1) ---
  "estado_reserva": {
    "before": null,
    "current": "Confirmada"
  },
  "codigo_reservacion_hotel": {
    "before": "CODIGO-VIEJO",
    "current": "lala" // (Coincide con tu Imagen 1)
  },
  "comments": {
    "before": "reserva de prueba",
    "current": "A ver que onda" // (Coincide con tu Imagen 1)
  },
  "nuevo_incluye_desayuno": true, // (Coincide con tu Imagen 1)

  // --- Sincronización de Viajeros (Paso 1) ---
  "viajero": {
    "before": {
      "id_viajero": "d80a7f6d-8891-4d0f-bf29-885204d34234",
      "nombre_completo": "Emiliano Ruiz oropeza"
    },
    "current": {
      "id_viajero": "via-e31c5251-d313-40a2-8cbf-81002429b7ec",
      "nombre_completo": "PATRICIA SILVA" // (Coincide con tu Imagen 1)
    }
  },
  "acompanantes": [], // (Coincide con tu Imagen 1, no hay acompañantes)

  // --- Info de Hotel/Habitación (Paso 1) ---
  "hotel": {
    "before": { "name": "BEST WESTERN TAXCO" },
    "current": { "name": "ONE CHIHUAHUA FASHION MALL" }
  },
  "habitacion": {
    "before": "DOBLE",
    "current": "SENCILLO $1513.80"
  },

  // --- Parámetros de Cálculo ---
  "impuestos": {
    "iva": 16,
    "ish": 3,
    "otros_impuestos": 0
  },
  
  // --- Simulación de Pago (Paso 2 - Imagen 2) ---
  // (Estos son los saldos usados para pagar el 'delta_precio_venta')
  "updatedSaldos": [
    {
      "id_saldos": 38,
      "id_agente": "a6cc4918-0ce0-416d-8ab6-ce157d9a708a",
      "saldo": "615476.90",
      "monto": "900000.00",
      "metodo_pago": "wallet",
      "is_facturado": 1, // Importante: simula pago con wallet facturado
      "monto_facturado": 900000.00,
      "monto_cargado_al_item": "3027.60" // El monto exacto del ajuste
    }
  ],
  
  // (Opcional: puedes incluir el item de ajuste pre-calculado, aunque tu lógica
  // 'generar_item_ajuste' ya lo hace, 'updatedItem' venía en tu payload)
  "updatedItem": {
    "total": "3027.60",
    "subtotal": "2610.00",
    "impuestos": "417.60",
    "is_ajuste": 1
  }
};

const hasKey = (obj, key) =>
  obj && Object.prototype.hasOwnProperty.call(obj, key);

async function caso_base({ id_solicitud, id_servicio, id_hospedaje, id_booking, check_in, check_out, noches, estado, total, id_viajero, acompanantes }) {
  const response_caso_base = await runTransaction(async (connection) => {
    const [servicio, response_servicio] = await Servicio.update(connection, Calculo.cleanEmpty({ id_servicio, total }));
    console.log("UPDATE SERVICIO", servicio, response_servicio);

    const [booking, response_booking] = await Booking.update(connection, Calculo.cleanEmpty({ id_booking, estado }));
    console.log("UPDATE BOOKING", booking, response_booking);

    const [hospedaje, response_hospedaje] = await Hospedaje.update(connection, Calculo.cleanEmpty({ id_hospedaje, check_in, check_out, noches }));
    console.log("UPDATE HOSPEDAJE", hospedaje, response_hospedaje);

    // 4) Viajeros/acompañantes: (esta logica viene reciclada de un contoller anterior hay que ajustarla que funcione en este contexto)
    // Solo tocamos este bloque si el payload INCLUYE al menos una de estas llaves.
    // FIX: req.body, viajero, metadata are undefined in this context. You need to pass them as parameters or refactor.
    // For now, commenting out the block that uses undefined variables.

    /*
    const includesViajeroKey = hasKey(req.body, 'viajero');
    const includesAcompKey = hasKey(req.body, 'acompanantes');

    const idHosp = metadata?.id_hospedaje;
    if (!idHosp) {
      return res.status(400).json({ error: "metadata.id_hospedaje es requerido" });
    }

    const idViajeroPrincipal =
      viajero?.current?.id_viajero ??
      metadata?.id_viajero_reserva ??
      null;

    const acompList = includesAcompKey && Array.isArray(acompanantes) ? acompanantes : null;
    const shouldUpdateTravelers = includesViajeroKey || includesAcompKey;

    const result = await runTransaction(async (connection) => {
      await connection.execute("CALL sp_editar_reserva_procesada(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", params);

      let viajerosTx = { inserted: 0, deleted: 0, updated: 0, skipped: true };

      if (shouldUpdateTravelers) {
        const [viajerosActualesRows] = await connection.execute(
          `SELECT id_viajero, is_principal FROM viajeros_hospedajes WHERE id_hospedaje = ?`,
          [idHosp]
        );
        const viajerosActuales = Array.isArray(viajerosActualesRows) ? viajerosActualesRows : [];

        const nuevosViajeros = [];

        if (includesViajeroKey && idViajeroPrincipal) {
          nuevosViajeros.push({ id_viajero: idViajeroPrincipal, is_principal: 1 });
        } else {
          const principalActual = viajerosActuales.find(v => v.is_principal === 1)?.id_viajero
            ?? idViajeroPrincipal;
          if (principalActual) {
            nuevosViajeros.push({ id_viajero: principalActual, is_principal: 1 });
          }
        }

        if (includesAcompKey) {
          const acompIds = (acompList || [])
            .map(a => a?.id_viajero)
            .filter(Boolean);

          const principalId = nuevosViajeros.find(v => v.is_principal === 1)?.id_viajero;
          const acompUnique = [...new Set(acompIds)].filter(idv => idv !== principalId);

          for (const idv of acompUnique) {
            nuevosViajeros.push({ id_viajero: idv, is_principal: 0 });
          }
        } else {
          for (const v of viajerosActuales) {
            if (v.is_principal === 0) {
              nuevosViajeros.push({ id_viajero: v.id_viajero, is_principal: 0 });
            }
          }
        }

        const nuevosIds = nuevosViajeros.map(v => v.id_viajero);
        const actualesIds = viajerosActuales.map(v => v.id_viajero);

        const idsAEliminar = actualesIds.filter(idv => !nuevosIds.includes(idv));
        const idsAInsertar = nuevosIds.filter(idv => !actualesIds.includes(idv));
        const idsAActualizar = nuevosIds.filter(idv => actualesIds.includes(idv));

        if (idsAEliminar.length > 0) {
          const placeholders = idsAEliminar.map(() => '?').join(',');
          await connection.execute(
            `DELETE FROM viajeros_hospedajes WHERE id_hospedaje = ? AND id_viajero IN (${placeholders})`,
            [idHosp, ...idsAEliminar]
          );
          viajerosTx.deleted = idsAEliminar.length;
        }

        for (const v of nuevosViajeros.filter(v => idsAInsertar.includes(v.id_viajero))) {
          await connection.execute(
            `INSERT INTO viajeros_hospedajes (id_viajero, id_hospedaje, is_principal) VALUES (?, ?, ?)`,
            [v.id_viajero, idHosp, v.is_principal]
          );
          viajerosTx.inserted += 1;
        }

        for (const v of nuevosViajeros.filter(v => idsAActualizar.includes(v.id_viajero))) {
          const previo = viajerosActuales.find(x => x.id_viajero === v.id_viajero);
          if (!previo || previo.is_principal !== v.is_principal) {
            await connection.execute(
              `UPDATE viajeros_hospedajes SET is_principal = ? WHERE id_hospedaje = ? AND id_viajero = ?`,
              [v.is_principal, idHosp, v.id_viajero]
            );
            viajerosTx.updated += 1;
          }
        }

        viajerosTx.skipped = false;
      }

      return {
        viajeros: viajerosTx,
      };
    });
    */
  });
}

const editar_reserva_definitivo = async (req, res) => {
const {metadata} = req.body;
  const {
    viajero,                   
    check_in,                  
    check_out,                 
    venta,                     
    estado_reserva,            
    proveedor,                 
    hotel,                     
    codigo_reservacion_hotel,  
    habitacion,                
    noches,                    
    comments,                  
    items,                     
    impuestos,                 
    nuevo_incluye_desayuno,    
    acompanantes        // suele venir, pero defensivo
  } = req.body || {};
  try {
    // 1) aplicamos caso base (Servicio, Booking, Hospedaje y Viajeros))
    await caso_base(metadata.id_solicitud,metadata.id_servicio,metadata.id_hospedaje,metadata.id_booking,check_in,check_out,noches,estado_reserva,venta.current.total,viajero.current.id_viajero,acompanantes)
   // 2) obtenemos nuestros estatus para evaluar los flujos
   /*
      tipo_pago (ya tenemos la funcion)
      reserva_facturada
      pagos_facturados => para cuando va a pagar ajustes y debemos propagar las facturas a los items nuevos
      cambian_noches
      cambia_precio_de_venta
   */
    const tipo_pago = await get_payment_type(metadata.id_solicitud, metadata.id_servicio);
    const reserva_facturada = await is_invoiced_reservation(metadata.id_servicio);
    const {cambian_noches,delta_noches} = await cambios_noches(noches);
    const {cambia_precio_de_venta,delta_precio_venta} = await cambia_precio_de_venta(venta);



  } catch (error) {
    
  }
}