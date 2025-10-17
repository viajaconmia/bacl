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
const { Calculo } = require("../../lib/utils/calculates");

async function get_payment_type(id_solicitud, id_servicio) {
  const query_credito = `select case when id_credito is not null then 1 else 0 end as is_credito 
    from vw_reservas_client where id_solicitud = ?;`;

  const query_pago_directo = `Select case when id_saldo_a_favor is null then 1 else 0 end as is_pago_directo
    from servicios where id_servicio = ?`; // FIX: added missing FROM clause

  const query_wallet = `Select case when id_saldo_a_favor is not null then 1 else 0 end as is_wallet
    from servicios where id_servicio = ?`; // FIX: added missing FROM clause

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
async function has_invoiced_payment(params) {
  
}

async function agregar_items(check_in, check_out,id_hospedaje, total,is_ajuste){
  // esta funcion va a retornar la lista de items a insertar, los calculos
  // deben hacerse a partir de check_in, check_out y total
  // uno de los campos que debemos retornar es fecha_uso que debe llevar cada item
  // si es ajuste solo debe ser un item sin fecha de uso

}
async function desactivar_items(check_in, check_out,id_hospedaje, total,) {
  // debe primero buscar los items activos por id_hospedaje
  // luego a partir de check_in, check_out deben determianr cuales desactivar
}

async function asociar_factura_items(id_hospedaje,{facturas},{saldos}) {
/*
  Esto funciona de la siguiente manera 
  Esto es al pagar un ajuste de precio de la reserva (ya sea incremento de 
  noches o ajuste por item de ajuste)
  si el ajuste se paga con un pago facturado, los nuevos items que se generen 
  o el item de ajuste debe asociarse a la factura

  para eso debemos buscar el id que nos llegue en facturas_pagos_y_saldos
  agrupar el monto facturado para tener referencia de cuanto aplicar por item en 
  items_facturas
*/
  
}

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
    await caso_base(metadata.id_solicitud,metadata.id_servicio,metadata.id_hospedaje,metadata.id_booking,check_in,check_out,noches,estado_reserva,venta.current.total,id_viajero,acompanantes)
   // 2) obtenemos nuestros estatus para evaluar los fujos
   /*
      tipo_pago (ya tenemos la funcion)
      pago_facturado
      reserva_facturada
      cambian_noches
      cambia_precio_de_venta
   */
    const tipo_pago = await get_payment_type(metadata.id_solicitud, metadata.id_servicio);

  } catch (error) {
    
  }
}