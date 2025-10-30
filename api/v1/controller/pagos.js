const {
  executeQuery,
  runTransaction,
  executeSP,
  executeSP2,
} = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
const model = require("../model/pagos");
const { CustomError, ShortError } = require("../../../middleware/errorHandler");

const { get } = require("../router/mia/reservasClient");

const { calcularPrecios } = require("../../../lib/utils/calculates");

const create = async (req, res) => {
  try {
    const response = await model.createPagos(req.body);
    res
      .status(201)
      .json({ message: "Pago creados correctamente", data: response });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

// const crearItemdeAjuste = async (req, res) => {
//   console.log("Solo queremos ver el body",req.body);
//   try {
//      const response = await runTransaction(async (connection) => {
//       try {
//         await connection.beginTransaction();

//         // 0) Preparar datos para item de ajuste
//         const id_item_ajuste = "ite-" + uuidv4();
//         const {
//           updatedItem,
//           updatedSaldos,
//           diferencia,
//           precioActualizado,
//           id_booking,
//           id_servicio,
//           hotel,
//           noches
//         } = req.body;

//         updatedItem.id_item = id_item_ajuste;

//         const query_insert_item = `INSERT INTO items (
//          id_item, id_catalogo_item, id_factura,
//          total, subtotal, impuestos, is_facturado,
//          fecha_uso, id_hospedaje,
//          created_at, updated_at,
//          costo_total, costo_subtotal, costo_impuestos,
//          saldo, costo_iva, is_ajuste
//        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//         // ramificammos validando la division entre la diferencia y elnume de

//          if(diferencia%hotel.precio !=0){ /*Es un aumento de noches*/

//         // 1) Insertar el item de ajuste
//         await connection.query(
//           `INSERT INTO items (
//          id_item, id_catalogo_item, id_factura,
//          total, subtotal, impuestos, is_facturado,
//          fecha_uso, id_hospedaje,
//          created_at, updated_at,
//          costo_total, costo_subtotal, costo_impuestos,
//          saldo, costo_iva, is_ajuste
//        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//           [
//             updatedItem.id_item,
//             updatedItem.id_catalogo_item,
//             updatedItem.id_factura,
//             updatedItem.total,
//             updatedItem.subtotal,
//             updatedItem.impuestos,
//             updatedItem.is_facturado,
//             updatedItem.fecha_uso,
//             updatedItem.id_hospedaje,
//             updatedItem.created_at,
//             updatedItem.updated_at,
//             updatedItem.costo_total,
//             updatedItem.costo_subtotal,
//             updatedItem.costo_impuestos,
//             updatedItem.saldo,
//             updatedItem.costo_iva,
//             updatedItem.is_ajuste,
//           ]
//         );

//         // 2) Actualizar servicios
//         await connection.query(
//           `UPDATE servicios
//          SET total     = total + ?,
//              impuestos = (total + ?) * 0.16,
//              subtotal  = (total + ?) - ((total + ?) * 0.16)
//        WHERE id_servicio = ?`,
//           [diferencia, diferencia, diferencia, diferencia, id_servicio]
//         );

//         // 3) Actualizar bookings
//         await connection.query(
//           `UPDATE bookings
//          SET total     = ?,
//              impuestos = ? * 0.16,
//              subtotal  = ? - (? * 0.16)
//        WHERE id_booking = ?`,
//           [
//             precioActualizado,
//             precioActualizado,
//             precioActualizado,
//             precioActualizado,
//             id_booking,
//           ]
//         );

//         // 4) Actualizar saldos a favor
//         for (const saldoObj of updatedSaldos) {
//           // parseo de fecha (ISO o YYYY-MM-DD)
//           const fechaCreacion =
//             saldoObj.fecha_creacion.length === 10
//               ? `${saldoObj.fecha_creacion} 00:00:00`
//               : new Date(saldoObj.fecha_creacion)
//                   .toISOString()
//                   .slice(0, 19)
//                   .replace("T", " ");

//           const activo = saldoObj.saldo <= 0 ? 0 : 1;

//           await connection.query(
//             `UPDATE saldos_a_favor
//            SET fecha_creacion = ?,
//                saldo          = ?,
//                activo         = ?
//          WHERE id_saldos = ?`,
//             [fechaCreacion, saldoObj.saldo, activo, saldoObj.id_saldos]
//           );
//         }

//         // 5) Registrar pagos e items_pagos
//         const idsPagos = [];
//         for (const saldoObj of updatedSaldos) {
//           const id_pago = "pag-" + uuidv4();
//           const transaccion= "tra-" + uuidv4();
//           idsPagos.push(id_pago);

//           // parseo de fecha de pago
//           const fechaPago =
//             saldoObj.fecha_pago.length === 10
//               ? `${saldoObj.fecha_pago} 00:00:00`
//               : new Date(saldoObj.fecha_pago)
//                   .toISOString()
//                   .slice(0, 19)
//                   .replace("T", " ");

//           // insertar en pagos
//           await connection.query(
//             `INSERT INTO pagos (
//            id_pago, id_servicio, id_saldo_a_favor, id_agente,
//            metodo_de_pago, fecha_pago, concepto, referencia,
//            currency, tipo_de_tarjeta, link_pago, last_digits, total,saldo_aplicado,transaccion,monto_transaccion
// const crearItemdeAjuste = async (req, res) => {
//   console.log("Solo queremos ver el body",req.body);
//   try {
//      const response = await runTransaction(async (connection) => {
//       try {
//         await connection.beginTransaction();

//         // 0) Preparar datos para item de ajuste
//         const id_item_ajuste = "ite-" + uuidv4();
//         const {
//           updatedItem,
//           updatedSaldos,
//           diferencia,
//           precioActualizado,
//           id_booking,
//           id_servicio,
//           hotel,
//           noches
//         } = req.body;

//         updatedItem.id_item = id_item_ajuste;

//         const query_insert_item = `INSERT INTO items (
//          id_item, id_catalogo_item, id_factura,
//          total, subtotal, impuestos, is_facturado,
//          fecha_uso, id_hospedaje,
//          created_at, updated_at,
//          costo_total, costo_subtotal, costo_impuestos,
//          saldo, costo_iva, is_ajuste
//        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//         // ramificammos validando la division entre la diferencia y elnume de

//          if(diferencia%hotel.precio !=0){ /*Es un aumento de noches*/

//         // 1) Insertar el item de ajuste
//         await connection.query(
//           `INSERT INTO items (
//          id_item, id_catalogo_item, id_factura,
//          total, subtotal, impuestos, is_facturado,
//          fecha_uso, id_hospedaje,
//          created_at, updated_at,
//          costo_total, costo_subtotal, costo_impuestos,
//          saldo, costo_iva, is_ajuste
//        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//           [
//             updatedItem.id_item,
//             updatedItem.id_catalogo_item,
//             updatedItem.id_factura,
//             updatedItem.total,
//             updatedItem.subtotal,
//             updatedItem.impuestos,
//             updatedItem.is_facturado,
//             updatedItem.fecha_uso,
//             updatedItem.id_hospedaje,
//             updatedItem.created_at,
//             updatedItem.updated_at,
//             updatedItem.costo_total,
//             updatedItem.costo_subtotal,
//             updatedItem.costo_impuestos,
//             updatedItem.saldo,
//             updatedItem.costo_iva,
//             updatedItem.is_ajuste,
//           ]
//         );

//         // 2) Actualizar servicios
//         await connection.query(
//           `UPDATE servicios
//          SET total     = total + ?,
//              impuestos = (total + ?) * 0.16,
//              subtotal  = (total + ?) - ((total + ?) * 0.16)
//        WHERE id_servicio = ?`,
//           [diferencia, diferencia, diferencia, diferencia, id_servicio]
//         );

//         // 3) Actualizar bookings
//         await connection.query(
//           `UPDATE bookings
//          SET total     = ?,
//              impuestos = ? * 0.16,
//              subtotal  = ? - (? * 0.16)
//        WHERE id_booking = ?`,
//           [
//             precioActualizado,
//             precioActualizado,
//             precioActualizado,
//             precioActualizado,
//             id_booking,
//           ]
//         );

//         // 4) Actualizar saldos a favor
//         for (const saldoObj of updatedSaldos) {
//           // parseo de fecha (ISO o YYYY-MM-DD)
//           const fechaCreacion =
//             saldoObj.fecha_creacion.length === 10
//               ? `${saldoObj.fecha_creacion} 00:00:00`
//               : new Date(saldoObj.fecha_creacion)
//                   .toISOString()
//                   .slice(0, 19)
//                   .replace("T", " ");

//           const activo = saldoObj.saldo <= 0 ? 0 : 1;

//           await connection.query(
//             `UPDATE saldos_a_favor
//            SET fecha_creacion = ?,
//                saldo          = ?,
//                activo         = ?
//          WHERE id_saldos = ?`,
//             [fechaCreacion, saldoObj.saldo, activo, saldoObj.id_saldos]
//           );
//         }

//         // 5) Registrar pagos e items_pagos
//         const idsPagos = [];
//         for (const saldoObj of updatedSaldos) {
//           const id_pago = "pag-" + uuidv4();
//           const transaccion= "tra-" + uuidv4();
//           idsPagos.push(id_pago);

//           // parseo de fecha de pago
//           const fechaPago =
//             saldoObj.fecha_pago.length === 10
//               ? `${saldoObj.fecha_pago} 00:00:00`
//               : new Date(saldoObj.fecha_pago)
//                   .toISOString()
//                   .slice(0, 19)
//                   .replace("T", " ");

//           // insertar en pagos
//           await connection.query(
//             `INSERT INTO pagos (
//            id_pago, id_servicio, id_saldo_a_favor, id_agente,
//            metodo_de_pago, fecha_pago, concepto, referencia,
//            currency, tipo_de_tarjeta, link_pago, last_digits, total,saldo_aplicado,transaccion,monto_transaccion
// const crearItemdeAjuste = async (req, res) => {
//   console.log("Solo queremos ver el body",req.body);
//   try {
//      const response = await runTransaction(async (connection) => {
//       try {
//         await connection.beginTransaction();

//         // 0) Preparar datos para item de ajuste
//         const id_item_ajuste = "ite-" + uuidv4();
//         const {
//           updatedItem,
//           updatedSaldos,
//           diferencia,
//           precioActualizado,
//           id_booking,
//           id_servicio,
//           hotel,
//           noches
//         } = req.body;

//         updatedItem.id_item = id_item_ajuste;

//         const query_insert_item = `INSERT INTO items (
//          id_item, id_catalogo_item, id_factura,
//          total, subtotal, impuestos, is_facturado,
//          fecha_uso, id_hospedaje,
//          created_at, updated_at,
//          costo_total, costo_subtotal, costo_impuestos,
//          saldo, costo_iva, is_ajuste
//        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//         // ramificammos validando la division entre la diferencia y elnume de

//          if(diferencia%hotel.precio !=0){ /*Es un aumento de noches*/

//         // 1) Insertar el item de ajuste
//         await connection.query(
//           `INSERT INTO items (
//          id_item, id_catalogo_item, id_factura,
//          total, subtotal, impuestos, is_facturado,
//          fecha_uso, id_hospedaje,
//          created_at, updated_at,
//          costo_total, costo_subtotal, costo_impuestos,
//          saldo, costo_iva, is_ajuste
//        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//           [
//             updatedItem.id_item,
//             updatedItem.id_catalogo_item,
//             updatedItem.id_factura,
//             updatedItem.total,
//             updatedItem.subtotal,
//             updatedItem.impuestos,
//             updatedItem.is_facturado,
//             updatedItem.fecha_uso,
//             updatedItem.id_hospedaje,
//             updatedItem.created_at,
//             updatedItem.updated_at,
//             updatedItem.costo_total,
//             updatedItem.costo_subtotal,
//             updatedItem.costo_impuestos,
//             updatedItem.saldo,
//             updatedItem.costo_iva,
//             updatedItem.is_ajuste,
//           ]
//         );

//         // 2) Actualizar servicios
//         await connection.query(
//           `UPDATE servicios
//          SET total     = total + ?,
//              impuestos = (total + ?) * 0.16,
//              subtotal  = (total + ?) - ((total + ?) * 0.16)
//        WHERE id_servicio = ?`,
//           [diferencia, diferencia, diferencia, diferencia, id_servicio]
//         );

//         // 3) Actualizar bookings
//         await connection.query(
//           `UPDATE bookings
//          SET total     = ?,
//              impuestos = ? * 0.16,
//              subtotal  = ? - (? * 0.16)
//        WHERE id_booking = ?`,
//           [
//             precioActualizado,
//             precioActualizado,
//             precioActualizado,
//             precioActualizado,
//             id_booking,
//           ]
//         );

//         // 4) Actualizar saldos a favor
//         for (const saldoObj of updatedSaldos) {
//           // parseo de fecha (ISO o YYYY-MM-DD)
//           const fechaCreacion =
//             saldoObj.fecha_creacion.length === 10
//               ? `${saldoObj.fecha_creacion} 00:00:00`
//               : new Date(saldoObj.fecha_creacion)
//                   .toISOString()
//                   .slice(0, 19)
//                   .replace("T", " ");

//           const activo = saldoObj.saldo <= 0 ? 0 : 1;

//           await connection.query(
//             `UPDATE saldos_a_favor
//            SET fecha_creacion = ?,
//                saldo          = ?,
//                activo         = ?
//          WHERE id_saldos = ?`,
//             [fechaCreacion, saldoObj.saldo, activo, saldoObj.id_saldos]
//           );
//         }

//         // 5) Registrar pagos e items_pagos
//         const idsPagos = [];
//         for (const saldoObj of updatedSaldos) {
//           const id_pago = "pag-" + uuidv4();
//           const transaccion= "tra-" + uuidv4();
//           idsPagos.push(id_pago);

//           // parseo de fecha de pago
//           const fechaPago =
//             saldoObj.fecha_pago.length === 10
//               ? `${saldoObj.fecha_pago} 00:00:00`
//               : new Date(saldoObj.fecha_pago)
//                   .toISOString()
//                   .slice(0, 19)
//                   .replace("T", " ");

//           // insertar en pagos
//           await connection.query(
//             `INSERT INTO pagos (
//            id_pago, id_servicio, id_saldo_a_favor, id_agente,
//            metodo_de_pago, fecha_pago, concepto, referencia,
//            currency, tipo_de_tarjeta, link_pago, last_digits, total,saldo_aplicado,transaccion,monto_transaccion
// asumo que tienes algo como: const { v4: uuidv4 } = require('uuid');

const crearItemdeAjuste = async (req, res) => {
  console.log("Solo queremos ver el body", req.body);

  // Helpers pequeños para parseo de fechas
  const toMysqlDateTime = (val) => {
    if (!val) return null;
    // si viene como 'YYYY-MM-DD'
    if (typeof val === 'string' && val.length === 10) return `${val} 00:00:00`;
    // intenta ISO -> MySQL DATETIME
    try {
      return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
    } catch {
      return null;
    }
  };

  try {
    const response = await runTransaction(async (connection) => {
      // Si tu runTransaction NO hace begin/commit/rollback por sí mismo,
      // deja estas 3 líneas. Si ya lo hace, quítalas.
      await connection.beginTransaction();

      // 0) Preparar datos para item de ajuste
      const id_item_ajuste = "ite-" + uuidv4();
      const {
        updatedItem = {},
        updatedSaldos = [],  // <- lo tratamos como ARRAY siempre
        diferencia = 0,
        precioActualizado,
        id_booking,
        id_servicio,
        hotel = {},
        noches = {},
      } = req.body;

      // Sanitiza/asegura flags clave
      const _updatedSaldos = Array.isArray(updatedSaldos) ? updatedSaldos : [];
      const precioUnitario = Number(hotel?.precio ?? 0);

      // item base a insertar cuando toque un solo ítem
      const baseItem = {
        ...updatedItem,
        id_item: id_item_ajuste,
        id_catalogo_item: updatedItem?.id_catalogo_item ?? null,
        id_factura: updatedItem?.id_factura ?? null,
        total: Number(updatedItem?.total ?? 0),
        subtotal: Number(updatedItem?.subtotal ?? 0),
        impuestos: Number(updatedItem?.impuestos ?? 0),
        is_facturado: updatedItem?.is_facturado ?? 0,
        fecha_uso: toMysqlDateTime(updatedItem?.fecha_uso),
        id_hospedaje: updatedItem?.id_hospedaje ?? null,
        created_at: toMysqlDateTime(updatedItem?.created_at) ?? toMysqlDateTime(new Date()),
        updated_at: toMysqlDateTime(updatedItem?.updated_at) ?? toMysqlDateTime(new Date()),
        costo_total: Number(updatedItem?.costo_total ?? 0),
        costo_subtotal: Number(updatedItem?.costo_subtotal ?? 0),
        costo_impuestos: Number(updatedItem?.costo_impuestos ?? 0),
        saldo: Number(updatedItem?.saldo ?? 0),
        costo_iva: Number(updatedItem?.costo_iva ?? 0),
        is_ajuste: updatedItem?.is_ajuste ?? 1, // asegúralo como ajuste
      };

      const query_insert_item = `
        INSERT INTO items (
          id_item, id_catalogo_item, id_factura,
          total, subtotal, impuestos, is_facturado,
          fecha_uso, id_hospedaje,
          created_at, updated_at,
          costo_total, costo_subtotal, costo_impuestos,
          saldo, costo_iva, is_ajuste
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // 🔴 IMPORTANTE: idsPagos debe existir en TODO el scope de la transacción
      const idsPagos = [];

      // Si diferencia no es múltiplo del precio por noche => un solo ítem de ajuste (cambio de precio)
      const esAjusteDePrecio =
        !precioUnitario || (Number(diferencia) % precioUnitario !== 0);

      if (esAjusteDePrecio) {
        // 1) Insertar el item de ajuste (un único ítem)
        await connection.query(
          query_insert_item,
          [
            baseItem.id_item,
            baseItem.id_catalogo_item,
            baseItem.id_factura,
            baseItem.total,
            baseItem.subtotal,
            baseItem.impuestos,
            baseItem.is_facturado,
            baseItem.fecha_uso,
            baseItem.id_hospedaje,
            baseItem.created_at,
            baseItem.updated_at,
            baseItem.costo_total,
            baseItem.costo_subtotal,
            baseItem.costo_impuestos,
            baseItem.saldo,
            baseItem.costo_iva,
            baseItem.is_ajuste,
          ]
        );

        // 2) Actualizar servicios
        // Nota: En MySQL, las asignaciones en SET se evalúan izq->der;
        // aquí usamos total actualizado para impuestos y subtotal.
        await connection.query(
          `
          UPDATE servicios
          SET total     = total + ?,
              impuestos = (total) * 0.16,
              subtotal  = (total) - ((total) * 0.16)
          WHERE id_servicio = ?
          `,
          [Number(diferencia), id_servicio]
        );

        // 3) Actualizar bookings al precioActualizado (si viene)
        if (precioActualizado != null) {
          const p = Number(precioActualizado);
          await connection.query(
            `
            UPDATE bookings
            SET total     = ?,
                impuestos = ? * 0.16,
                subtotal  = ? - (? * 0.16)
            WHERE id_booking = ?
            `,
            [p, p, p, p, id_booking]
          );
        }

        // 4) Actualizar saldos a favor (array)
        for (const saldoObj of _updatedSaldos) {
          const fechaCreacion = toMysqlDateTime(saldoObj?.fecha_creacion);
          const nuevoSaldo = Number(saldoObj?.saldo ?? 0);
          const activo = nuevoSaldo <= 0 ? 0 : 1;

          await connection.query(
            `
            UPDATE saldos_a_favor
            SET fecha_creacion = ?,
                saldo          = ?,
                activo         = ?
            WHERE id_saldos = ?
            `,
            [fechaCreacion, nuevoSaldo, activo, saldoObj?.id_saldos]
          );
        }

        // 5) Registrar pagos e items_pagos
        for (const saldoObj of _updatedSaldos) {
          const id_pago = "pag-" + uuidv4();
          const transaccion = "tra-" + uuidv4();
          idsPagos.push(id_pago);

          const fechaPago = toMysqlDateTime(saldoObj?.fecha_pago);
          const montoAsociado = Number(saldoObj?.monto_cargado_al_item ?? 0);
          const totalVenta = Number(precioActualizado ?? baseItem.total ?? 0);

          await connection.query(
            `
            INSERT INTO pagos (
              id_pago, id_servicio, id_saldo_a_favor, id_agente,
              metodo_de_pago, fecha_pago, concepto, referencia,
              currency, tipo_de_tarjeta, link_pago, last_digits, total,
              saldo_aplicado, transaccion, monto_transaccion
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              id_pago,
              id_servicio,
              saldoObj?.id_saldos ?? null,
              saldoObj?.id_agente ?? null,
              saldoObj?.metodo_pago ?? null,
              fechaPago,
              saldoObj?.concepto ?? null,
              saldoObj?.referencia ?? null,
              saldoObj?.currency ?? null,
              saldoObj?.tipo_tarjeta ?? null,
              saldoObj?.link_stripe ?? null,
              saldoObj?.ult_digits ?? null,
              totalVenta,              // total del pago (venta actualizada)
              montoAsociado,           // saldo aplicado a este item
              transaccion,
              montoAsociado,
            ]
          );

          // Relación pago-item (ajuste)
          await connection.query(
            `INSERT INTO items_pagos (id_pago, id_item, monto) VALUES (?, ?, ?)`,
            [id_pago, id_item_ajuste, montoAsociado]
          );
        }
      } else {
        // Es ajuste por número de noches (diferencia divisible) => varios ítems
        const nochesActuales = Number(noches?.current ?? 0);
        const nochesAntes = Number(noches?.before ?? 0);
        const items_a_crear = Math.abs(nochesActuales - nochesAntes) || 0;

        if (items_a_crear <= 0) {
          // Nada que crear; pero mantenemos coherencia de retorno
          await connection.commit();
          return {
            message: "No se crearon ítems (noches sin cambio).",
            item_creado: null,
            ids_pagos_creados: [],
          };
        }

        const total_por_item = Number(diferencia) / items_a_crear;

        for (let i = 0; i < items_a_crear; i++) {
          const id_item = "ite-" + uuidv4();
          const subtotal = +(total_por_item / 1.16).toFixed(2);
          const impuestos = +(total_por_item - subtotal).toFixed(2);

          await connection.query(
            query_insert_item,
            [
              id_item,
              null,                       // id_catalogo_item
              null,                       // id_factura (si necesitas ligar luego por facturas_items)
              total_por_item,
              subtotal,
              impuestos,
              null,                       // is_facturado -> lo manejará la facturación
              baseItem.fecha_uso,         // TODO: distribuir fecha_uso por noche si aplica
              baseItem.id_hospedaje,
              baseItem.created_at,
              baseItem.updated_at,
              baseItem.costo_total,
              baseItem.costo_subtotal,
              baseItem.costo_impuestos,
              0,                          // saldo: ya pagado
              baseItem.costo_iva,
              1,                          // is_ajuste
            ]
          );
        }
      }

      await connection.commit();

      // Devolver IDs de pagos creados (si hubo)
      return {
        message: "Item(s) de ajuste creado(s) correctamente",
        item_creado: id_item_ajuste,      // cuando fue un solo ítem
        ids_pagos_creados: idsPagos,      // <- ya no "undefined"
      };
    });

    // 200 con body (no uses 204 si envías JSON)
    return res.status(200).json({message: "Ajuste realizado correctamente", data: response });

  } catch (error) {
    console.error(error);
    return res.status(error?.statusCode || 500).json({
      message: error?.message || "Error desconocido al actualizar precio de crédito",
      error: error || "ERROR_BACK",
      data: null,
    });
  }
};


const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;

const ymdFromInput = (d) => {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (typeof d === "string") {
    const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  return new Date(d).toISOString().slice(0, 10);
};

const addDaysYMD = (ymd, n) => {
  const dt = new Date(`${ymd}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + (Number(n) || 0));
  return dt.toISOString().slice(0, 10);
};

const parseDateTime = (d) =>
  d && typeof d === "string" && d.length >= 19
    ? d.replace("T", " ").slice(0, 19)
    : new Date(d || new Date()).toISOString().slice(0, 19).replace("T", " ");

const splitVenta = (total) => {
  const t = round2(+total || 0);
  const subtotal = round2(t / 1.16);
  const impuestos = round2(t - subtotal);
  return { total: t, subtotal, impuestos };
};

const normalizaSaldo = (s) => {
  const aplicado = s.monto_cargado_al_item ?? s.monto ?? 0;
  return {
    ...s,
    monto_aplicado: round2(aplicado),
    fecha_creacion_dt:
      s.fecha_creacion && s.fecha_creacion.length === 10
        ? `${s.fecha_creacion} 00:00:00`
        : parseDateTime(s.fecha_creacion),
    fecha_pago_dt:
      s.fecha_pago && s.fecha_pago.length === 10
        ? `${s.fecha_pago} 00:00:00`
        : parseDateTime(s.fecha_pago),
    nuevoSaldo: round2(+s.saldo || 0),
    activo: +s.saldo <= 0 ? 0 : 1,
  };
};

// ==== Controller ====
const aplicarCambioNochesOAjuste = async (req, res) => {
  try {
    const {
      id_booking,
      id_servicio,
      id_hospedaje,
      check_in,
      check_out, // informativo; validamos con check_in + conteo
      updatedItem = {},
      updatedSaldos = [],
      diferencia,
      precioActualizado,
      hotel = {}, // { precio, noches: { before, current } }
    } = req.body || {};

    if (!id_booking || !id_servicio || !id_hospedaje) {
      return res.status(400).json({
        ok: false,
        message: "Faltan IDs requeridos (booking/servicio/hospedaje).",
      });
    }
    if (typeof hotel?.precio !== "number" || hotel.precio <= 0) {
      return res
        .status(400)
        .json({ ok: false, message: "hotel.precio inválido." });
    }
    if (typeof precioActualizado !== "number") {
      return res
        .status(400)
        .json({ ok: false, message: "precioActualizado es requerido." });
    }

    // nightsDelta: si no vienen noches en payload => 0 (solo ajuste)
    const hasNoches = !!(
      hotel?.noches &&
      typeof hotel.noches.before === "number" &&
      typeof hotel.noches.current === "number"
    );
    const nightsDelta = hasNoches
      ? Number(hotel.noches.current) - Number(hotel.noches.before)
      : 0;

    const checkInYMD = ymdFromInput(check_in);

    const idsItemsCreados = [];
    const idsPagos = [];
    const itemsFacturas = [];

    await runTransaction(async (connection) => {
      await connection.beginTransaction();

      // === A) Incremento de noches ===
      if (nightsDelta > 0) {
        // Traer items activos para conocer cuántas noches ya hay y arrancar desde ahí
        const [activos] = await connection.query(
          `SELECT id_item, fecha_uso FROM items
            WHERE id_hospedaje = ? AND estado = 1
            ORDER BY fecha_uso ASC`,
          [id_hospedaje]
        );
        const yaActivas = Array.isArray(activos) ? activos.length : 0;

        const itemsACrear = nightsDelta;
        const totalEsperado =
          typeof diferencia === "number" && diferencia > 0
            ? diferencia
            : itemsACrear * hotel.precio;

        const base = round2(totalEsperado / itemsACrear);
        let acumulado = 0;

        for (let i = 0; i < itemsACrear; i++) {
          const id_item = "ite-" + uuidv4();
          const totalItem =
            i === itemsACrear - 1 ? round2(totalEsperado - acumulado) : base;
          acumulado = round2(acumulado + totalItem);

          const { total, subtotal, impuestos } = splitVenta(totalItem);
          // ✅ fecha_uso = check_in + (noches ya activas + i)
          const fecha_uso = addDaysYMD(checkInYMD, yaActivas + i);

          await connection.query(
            `INSERT INTO items (
              id_item, id_catalogo_item, id_factura,
              total, subtotal, impuestos, is_facturado,
              fecha_uso, id_hospedaje,
              created_at, updated_at,
              costo_total, costo_subtotal, costo_impuestos,
              saldo, costo_iva, is_ajuste, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id_item,
              null,
              null,
              total,
              subtotal,
              impuestos,
              null,
              fecha_uso,
              id_hospedaje,
              parseDateTime(updatedItem.created_at),
              parseDateTime(updatedItem.updated_at),
              updatedItem.costo_total ?? null,
              updatedItem.costo_subtotal ?? null,
              updatedItem.costo_impuestos ?? null,
              0,
              updatedItem.costo_iva ?? null,
              0, // is_ajuste
              1, // activo
            ]
          );

          idsItemsCreados.push(id_item);
        }

        // Totales globales
        await connection.query(
          `UPDATE servicios
             SET total = ?, impuestos = ROUND(? * 0.16, 2), subtotal = ROUND(? - (? * 0.16), 2)
           WHERE id_servicio = ?`,
          [
            precioActualizado,
            precioActualizado,
            precioActualizado,
            precioActualizado,
            id_servicio,
          ]
        );
        await connection.query(
          `UPDATE bookings
             SET total = ?, impuestos = ROUND(? * 0.16, 2), subtotal = ROUND(? - (? * 0.16), 2)
           WHERE id_booking = ?`,
          [
            precioActualizado,
            precioActualizado,
            precioActualizado,
            precioActualizado,
            id_booking,
          ]
        );

        // Aplicar saldos: pagos + items_pagos + items_facturas
        const saldos = updatedSaldos.map(normalizaSaldo);
        let idxItem = 0;

        for (const s of saldos) {
          const id_pago = "pag-" + uuidv4();
          const transaccion = "tra-" + uuidv4();
          idsPagos.push(id_pago);

          await connection.query(
            `UPDATE saldos_a_favor
               SET fecha_creacion = ?, saldo = ?, activo = ?
             WHERE id_saldos = ?`,
            [s.fecha_creacion_dt, s.nuevoSaldo, s.activo, s.id_saldos]
          );

          await connection.query(
            `INSERT INTO pagos (
              id_pago, id_servicio, id_saldo_a_favor, id_agente,
              metodo_de_pago, fecha_pago, concepto, referencia,
              currency, tipo_de_tarjeta, link_pago, last_digits,
              total, saldo_aplicado, transaccion, monto_transaccion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id_pago,
              id_servicio,
              s.id_saldos,
              s.id_agente,
              s.metodo_pago,
              s.fecha_pago_dt,
              s.concepto,
              s.referencia,
              s.currency,
              s.tipo_tarjeta,
              s.link_stripe,
              s.ult_digits,
              s.monto_aplicado,
              s.monto_aplicado,
              transaccion,
              s.monto_aplicado,
            ]
          );

          // Reparto simple: llenar items secuencialmente
          let porAplicar = s.monto_aplicado;
          while (porAplicar > 0 && idxItem < idsItemsCreados.length) {
            const id_item = idsItemsCreados[idxItem];
            const [rows] = await connection.query(
              `SELECT total FROM items WHERE id_item = ?`,
              [id_item]
            );
            if (!rows?.length) break;
            const totalItem = +rows[0].total;

            const aplicar = porAplicar >= totalItem ? totalItem : porAplicar;

            await connection.query(
              `INSERT INTO items_pagos (id_pago, id_item, monto) VALUES (?, ?, ?)`,
              [id_pago, id_item, aplicar]
            );

            if (s.id_factura) {
              await connection.query(
                `INSERT INTO items_facturas (id_item, id_factura, monto) VALUES (?, ?, ?)`,
                [id_item, s.id_factura, aplicar]
              );
              itemsFacturas.push({
                id_item,
                id_factura: s.id_factura,
                monto: aplicar,
              });
            }

            porAplicar = round2(porAplicar - aplicar);
            if (aplicar >= totalItem) idxItem += 1;
            else break;
          }
        }

        // === B) Solo ajuste de precio (sin cambio de noches) ===
      } else if (nightsDelta === 0) {
        if (!diferencia || +diferencia === 0) {
          await connection.rollback();
          return res
            .status(200)
            .json({ ok: true, message: "Sin cambios (ajuste en 0)." });
        }

        const id_item_ajuste = "ite-" + uuidv4();
        const { total, subtotal, impuestos } = splitVenta(+diferencia);

        await connection.query(
          `INSERT INTO items (
            id_item, id_catalogo_item, id_factura,
            total, subtotal, impuestos, is_facturado,
            fecha_uso, id_hospedaje,
            created_at, updated_at,
            costo_total, costo_subtotal, costo_impuestos,
            saldo, costo_iva, is_ajuste, estado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id_item_ajuste,
            updatedItem.id_catalogo_item ?? null,
            null,
            total,
            subtotal,
            impuestos,
            null,
            null, // ✅ item de ajuste SIN fecha_uso
            id_hospedaje,
            parseDateTime(updatedItem.created_at),
            parseDateTime(updatedItem.updated_at),
            updatedItem.costo_total ?? null,
            updatedItem.costo_subtotal ?? null,
            updatedItem.costo_impuestos ?? null,
            0,
            updatedItem.costo_iva ?? null,
            1, // ajuste
            1,
          ]
        );

        idsItemsCreados.push(id_item_ajuste);

        await connection.query(
          `UPDATE servicios
             SET total = ?, impuestos = ROUND(? * 0.16, 2), subtotal = ROUND(? - (? * 0.16), 2)
           WHERE id_servicio = ?`,
          [
            precioActualizado,
            precioActualizado,
            precioActualizado,
            precioActualizado,
            id_servicio,
          ]
        );
        await connection.query(
          `UPDATE bookings
             SET total = ?, impuestos = ROUND(? * 0.16, 2), subtotal = ROUND(? - (? * 0.16), 2)
           WHERE id_booking = ?`,
          [
            precioActualizado,
            precioActualizado,
            precioActualizado,
            precioActualizado,
            id_booking,
          ]
        );

        for (const s0 of updatedSaldos.map(normalizaSaldo)) {
          const id_pago = "pag-" + uuidv4();
          const transaccion = "tra-" + uuidv4();
          idsPagos.push(id_pago);

          await connection.query(
            `UPDATE saldos_a_favor
               SET fecha_creacion = ?, saldo = ?, activo = ?
             WHERE id_saldos = ?`,
            [s0.fecha_creacion_dt, s0.nuevoSaldo, s0.activo, s0.id_saldos]
          );

          await connection.query(
            `INSERT INTO pagos (
              id_pago, id_servicio, id_saldo_a_favor, id_agente,
              metodo_de_pago, fecha_pago, concepto, referencia,
              currency, tipo_de_tarjeta, link_pago, last_digits,
              total, saldo_aplicado, transaccion, monto_transaccion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id_pago,
              id_servicio,
              s0.id_saldos,
              s0.id_agente,
              s0.metodo_pago,
              s0.fecha_pago_dt,
              s0.concepto,
              s0.referencia,
              s0.currency,
              s0.tipo_tarjeta,
              s0.link_stripe,
              s0.ult_digits,
              s0.monto_aplicado,
              s0.monto_aplicado,
              transaccion,
              s0.monto_aplicado,
            ]
          );

          await connection.query(
            `INSERT INTO items_pagos (id_pago, id_item, monto) VALUES (?, ?, ?)`,
            [id_pago, id_item_ajuste, s0.monto_aplicado]
          );

          if (s0.id_factura) {
            await connection.query(
              `INSERT INTO items_facturas (id_item, id_factura, monto) VALUES (?, ?, ?)`,
              [id_item_ajuste, s0.id_factura, s0.monto_aplicado]
            );
            itemsFacturas.push({
              id_item: id_item_ajuste,
              id_factura: s0.id_factura,
              monto: s0.monto_aplicado,
            });
          }
        }

        // === C) Reducción de noches explícita (no soportada aquí) ===
      } else {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message: "Reducción de noches no soportada en este endpoint.",
        });
      }

      await connection.commit();
    });

    return res.status(200).json({
      message: "Cambio aplicado correctamente.",
      data: {
        ids_items_creados: idsItemsCreados,
        ids_pagos_creados: idsPagos,
        items_facturas: itemsFacturas,
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "Error aplicando cambios",
    });
  }
};
const read = async (req, res) => {
  try {
    const datosFiscales = await model.readPagos();
    res.status(200).json(datosFiscales);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getPagosAgente = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const pagos = await model.getPagos(id_agente);
    res.status(200).json(pagos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getAllPagos = async (req, res) => {
  try {
    const pagos = await model.getAllPagos();
    res.status(200).json(pagos);
    console.log("sirvo");
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const readConsultas = async (req, res) => {
  try {
    const { user_id } = req.query;
    let solicitudes = await model.getPagosConsultas(user_id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const getMetodosPago = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id)
      throw new CustomError("Falta el id de usuario", 400, "MISSING_ID", null);
    const agente = await executeQuery(
      `SELECT * FROM agentes WHERE id_agente = ?`,
      [id]
    );
    if (agente.length == 0)
      throw new CustomError("No se encontro el agente", 404, "NOT_FOUND", null);
    const saldos = await executeQuery(
      `select id_agente, SUM(saldo) as saldo 
      from saldos_a_favor
      where
        id_agente = ?
        and metodo_pago not in("tarjeta_de_credito","tarjeta_de_debito","")
        and activo = 1
      group by id_agente;`,
      [id]
    );

    console.log(saldos);

    res.status(200).json({
      message: "Saldos obtenidos con exito",
      data: {
        credito: agente[0].saldo,
        wallet: saldos.length == 0 ? 0 : saldos[0].saldo,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(error.statusCode || 500).json({
      message:
        error.response ||
        error.message ||
        "Error desconocido en verificar registro del usuario",
      error,
      data: null,
    });
  }
};

const getPendientesAgente = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const pagos = await model.getPendientes(id_agente);
    res.status(200).json(pagos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getAllPendientes = async (req, res) => {
  try {
    const pagos = await model.getAllPendientes();
    res.status(200).json(pagos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getEmpresaCredito = async (req, res) => {
  try {
    const response = await model.getCreditoEmpresa(req.query);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const getAgenteCredito = async (req, res) => {
  try {
    const response = await model.getCreditoAgente(req.query);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const getAgenteAgentesYEmpresas = async (req, res) => {
  try {
    const response = await model.getCreditoTodos();
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const updateCreditAgent = async (req, res) => {
  try {
    const response = await model.editCreditoAgente(req.body);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const updateCreditEmpresa = async (req, res) => {
  try {
    const response = await model.editCreditoEmpresa(req.body);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const pagoPorCredito = async (req, res) => {
  try {
    const response = await model.pagoConCredito(req.body);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const pagarCarritoConCredito = async (req, res) => {
  try {
    const { id_agente, monto, id_viajero, itemsCart } = req.body;

    if (!id_agente || !monto || !id_viajero) {
      throw new CustomError("Faltan parametros", 400, "MISSING_PARAMS", {
        id_agente,
        monto,
        id_viajero,
      });
    }

    //Obtenemos el cliente de stripe
    const rows = await executeQuery(
      "SELECT * FROM agentes WHERE id_agente = ?;",
      [id_agente]
    );
    if (rows.length === 0)
      throw new ShortError("No se encontro el agente", 404);

    let saldo_agente = rows[0].saldo;
    if (saldo_agente < monto)
      throw new ShortError("No se cuenta con credito suficiente", 402);
    /* TERMINA VALIDACION DE DATOS */

    /* INICIA TRANSACTION DE ACCIONES */
    const response = await runTransaction(async (conn) => {
      try {
        /* INICIA EL GUARDADO EN LA BASE DEDATOS Y LA ASIGNACIóN DE SERVICIO */
        const id_servicio = `ser-${uuidv4()}`;
        const precio_venta = calcularPrecios(monto);
        const query_create_service = `
    INSERT INTO servicios
    (id_servicio, id_agente, total, subtotal, impuestos) VALUES (?, ?, ?, ?,?)`;
        const params_create_service = [
          id_servicio,
          id_agente,
          precio_venta.total,
          precio_venta.subtotal,
          precio_venta.impuestos,
        ];
        await conn.execute(query_create_service, params_create_service);

        const id_credito = `cre-${uuidv4()}`;
        const query_agregar_credito_pago = `
      INSERT INTO pagos_credito
      (
        id_credito,
        id_servicio,
        responsable_pago_agente,
        fecha_creacion,
        monto_a_credito,
        pago_por_credito,
        pendiente_por_cobrar,
        total,
        subtotal,
        impuestos,
        usuario_generador,
        concepto
      ) 
      VALUES (?,?,?,NOW(),?,?,?,?,?,?,?,?)`;

        const params_agregar_pago_credito = [
          id_credito,
          id_servicio, // Requerido de la relación con servicios
          id_agente, // Requerido
          precio_venta.total || "0",
          precio_venta.total || "0",
          precio_venta.total || "0",
          precio_venta.total || "0",
          precio_venta.subtotal || "0",
          precio_venta.impuestos || "0",
          id_viajero,
          `Ejecución de pago a credito por los servicios con el id: ${
            id_servicio || "Error al obtener el id"
          }`,
        ];

        await conn.execute(
          query_agregar_credito_pago,
          params_agregar_pago_credito
        );

        const ids_solicitudes = itemsCart.map(
          (item) => item.details.id_solicitud
        );
        const ids_carrito = itemsCart.map((item) => item.id);

        await Promise.all(
          ids_solicitudes.map((id) =>
            conn.execute(
              `UPDATE solicitudes SET id_servicio = ? WHERE id_solicitud = ?`,
              [id_servicio, id]
            )
          )
        );
        await Promise.all(
          ids_carrito.map((id) =>
            conn.execute(`UPDATE cart SET active = 0 WHERE id = ?`, [id], [id])
          )
        );
        await conn.execute(`UPDATE agentes SET saldo = ? WHERE id_agente = ?`, [
          (Number(saldo_agente) - monto).toFixed(2),
          id_agente,
        ]);

        return { current_saldo: (Number(saldo_agente) - monto).toFixed(2) };
      } catch (error) {
        throw new CustomError(
          error.message || "Error al intentar hacer el pago",
          error.status || error.statusCode || 500,
          "CREATE_PAYMENT_ERROR",
          error
        );
      }
    });

    res.status(200).json({
      message: "Pago procesado exitosamente",
      data: response,
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Error desconocido al pagar a credito",
      error: error || "ERROR_BACK",
      data: null,
    });
  }
};

// Toma 'YYYY-MM-DD' si existe; si no, convierte a ISO y toma YYYY-MM-DD.
// Evita bugs de timezone al truncar directamente la fecha de entrada.

// Distribuye total entre n; el último absorbe residuo (2 decimales).
const distributeUniform = (n, totalTarget) => {
  const out = Array(n).fill(0);
  if (n <= 0) return out;
  const base = round2(totalTarget / n);
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    out[i] = base;
    acc = round2(acc + base);
  }
  out[n - 1] = round2(totalTarget - acc);
  return out;
};

// Group by
const groupBy = (rows, key) =>
  rows.reduce((m, r) => ((m[r[key]] = (m[r[key]] || []).concat(r)), m), {});

// Asigna pago total a items en orden, topeando por total del item
const allocatePaymentAcrossItems = (itemsOrdered, pagoTotal) => {
  let restante = round2(pagoTotal);
  const rows = [];
  for (const it of itemsOrdered) {
    if (restante <= 0) break;
    const aplicar = round2(Math.min(restante, +it.total || 0));
    if (aplicar > 0) {
      rows.push({ id_item: it.id_item, monto: aplicar });
      restante = round2(restante - aplicar);
    }
  }
  if (restante !== 0 && rows.length > 0) {
    rows[rows.length - 1].monto = round2(
      rows[rows.length - 1].monto - restante
    );
  }
  return rows;
};

// ===== Controller =====
const handlerPagoContadoRegresarSaldo = async (req, res) => {
  try {
    let {
      id_agente,
      diferencia, // negativa => rebaja
      id_servicio,
      id_hospedaje,
      id_booking,
      precio_actualizado, // nuevo total de la reserva
      id_pago, // para directos; para wallet se usan todos los pagos aplicados
      hotel, // { precio, noches: { before, current }, ... }
      check_in,
      check_out,
    } = req.body || {};

    // --- Validaciones base ---
    if (
      !id_agente ||
      diferencia === undefined ||
      diferencia === null ||
      !id_servicio ||
      !id_hospedaje ||
      !id_booking ||
      precio_actualizado === undefined ||
      precio_actualizado === null ||
      !hotel ||
      !hotel.noches ||
      !check_in
    ) {
      throw new CustomError("Faltan datos requeridos", 400, "ERROR_FRONT", {
        id_agente,
        diferencia,
        id_servicio,
        id_hospedaje,
        id_booking,
        precio_actualizado,
        id_pago,
        hotel,
        check_in,
      });
    }

    const refundSolicitado = round2(Math.max(0, -1 * Number(diferencia)));
    const nightsDelta = Number(hotel.noches.current) - Number(hotel.noches.before);
    const checkInYMD = ymdFromInput(check_in);

    const data = await runTransaction(async (conn) => {
      await conn.beginTransaction();
      const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");

      // 0) Items activos (antes)
      const [oldItems] = await conn.execute(
        `SELECT id_item, fecha_uso, total
           FROM items
          WHERE id_hospedaje = ? AND estado = 1
          ORDER BY fecha_uso ASC`,
        [id_hospedaje]
      );
      if (!oldItems || oldItems.length === 0) {
        throw new CustomError(
          `No hay items activos para el hospedaje ${id_hospedaje}`,
          404,
          "NO_ITEMS",
          { id_hospedaje }
        );
      }
      const oldItemIds = oldItems.map((r) => r.id_item);
      const T_old = new Map(
        oldItems.map((r) => [r.id_item, round2(+r.total || 0)])
      );

      // 1) Mapa de aplicaciones por (pago,item)
      let applied = [];
      if (oldItemIds.length) {
        const placeholders = oldItemIds.map(() => "?").join(",");
        const [rows] = await conn.execute(
          `SELECT ip.id_item, ip.id_pago, SUM(ip.monto) AS aplicado,
                  p.id_saldo_a_favor, p.metodo_de_pago,
                  p.id_agente, p.fecha_pago, p.currency, p.tipo_de_tarjeta, p.link_pago,
                  p.last_digits, p.concepto, p.referencia, p.autorizacion_stripe, p.banco, p.total AS pago_total
             FROM items_pagos ip
             JOIN pagos p ON p.id_pago = ip.id_pago
            WHERE ip.id_item IN (${placeholders})
            GROUP BY ip.id_item, ip.id_pago`,
          oldItemIds
        );
        applied = rows.map((r) => ({
          id_item: r.id_item,
          id_pago: r.id_pago,
          aplicado: round2(+r.aplicado || 0),
          id_saldo_a_favor: r.id_saldo_a_favor,
          metodo_de_pago: (r.metodo_de_pago || "").toLowerCase(),
          pago_info: {
            id_agente: r.id_agente,
            fecha_pago: r.fecha_pago,
            currency: r.currency,
            tipo_de_tarjeta: r.tipo_de_tarjeta,
            link_pago: r.link_pago,
            last_digits: r.last_digits,
            concepto: r.concepto,
            referencia: r.referencia,
            autorizacion_stripe: r.autorizacion_stripe,
            banco: r.banco,
            total: round2(+r.pago_total || 0),
          },
        }));
      }
      const aplicadoByItem = groupBy(applied, "id_item");
      const pagoInfo = {};
      for (const r of applied) {
        if (!pagoInfo[r.id_pago]) {
          pagoInfo[r.id_pago] = {
            id_saldo_a_favor: r.id_saldo_a_favor,
            metodo_de_pago: r.metodo_de_pago,
            ...r.pago_info,
          };
        }
      }

      // 2) Mutación de noches
      let itemsFinal = [...oldItems.map(o => ({ id_item: o.id_item, fecha_uso: o.fecha_uso, total: 0 }))];

      if (nightsDelta > 0) {
        // Crear N items nuevos con fecha_uso = check_in + (oldItems.length + i)
        for (let i = 0; i < nightsDelta; i++) {
          const id_item_new = "ite-" + uuidv4();
          const fechaUso = addDaysYMD(checkInYMD, oldItems.length + i);
          await conn.execute(
            `INSERT INTO items (
              id_item, id_catalogo_item, id_factura,
              total, subtotal, impuestos, is_facturado,
              fecha_uso, id_hospedaje,
              created_at, updated_at,
              costo_total, costo_subtotal, costo_impuestos,
              saldo, costo_iva, is_ajuste, estado
            ) VALUES (?, ?, ?, 0, 0, 0, NULL, ?, ?, ?, ?, NULL, NULL, NULL, 0, NULL, 0, 1)`,
            [id_item_new, null, null, fechaUso, id_hospedaje, nowStr, nowStr]
          );
          itemsFinal.push({
            id_item: id_item_new,
            fecha_uso: fechaUso,
            total: 0,
          });
        }
      } else if (nightsDelta < 0) {
        // LIFO: desactivar últimas |Δ| noches
        const toDeactivate = Math.min(Math.abs(nightsDelta), itemsFinal.length);
        const orderedDesc = [...itemsFinal].sort((a, b) =>
          a.fecha_uso > b.fecha_uso ? -1 : 1
        );
        const deactivate = orderedDesc.slice(0, toDeactivate);
        for (const it of deactivate) {
          await conn.execute(
            "UPDATE items SET estado = 0, updated_at = ? WHERE id_item = ?",
            [nowStr, it.id_item]
          );
        }
        const deactivateIds = new Set(deactivate.map((x) => x.id_item));
        itemsFinal = itemsFinal.filter((x) => !deactivateIds.has(x.id_item));
        if (itemsFinal.length === 0) {
          throw new CustomError(
            "No pueden quedar 0 items activos después de reducir noches.",
            409,
            "NO_ITEMS_AFTER_REDUCTION"
          );
        }
      }

      // 3) Reasignar fechas de uso secuenciales desde check_in
      itemsFinal.sort((a, b) => (a.fecha_uso < b.fecha_uso ? -1 : a.fecha_uso > b.fecha_uso ? 1 : 0));
      const nActivos = itemsFinal.length;
      const fechasUso = Array.from({ length: nActivos }, (_, i) =>
        addDaysYMD(checkInYMD, i)
      );

      // 4) Redistribuir montos a precio_actualizado y actualizar items
      const montos = distributeUniform(nActivos, Number(precio_actualizado));
      for (let i = 0; i < nActivos; i++) {
        const id_item = itemsFinal[i].id_item;
        const fecha_uso = fechasUso[i];
        const { total, subtotal, impuestos } = splitVenta(montos[i]);
        await conn.execute(
          `UPDATE items
             SET total = ?, subtotal = ?, impuestos = ?, fecha_uso = ?, updated_at = ?
           WHERE id_item = ?`,
          [total, subtotal, impuestos, fecha_uso, nowStr, id_item]
        );
        itemsFinal[i].total = total;
        itemsFinal[i].fecha_uso = fecha_uso;
      }

      const T_new = new Map(
        itemsFinal.map((r) => [r.id_item, round2(+r.total || 0)])
      );
      const activeNow = new Set(itemsFinal.map((r) => r.id_item));

      // 5) Delta por item → prorrateo a pagos
      const refundByPago = {};
      for (const it of oldItems) {
        const oldT = T_old.get(it.id_item) || 0;
        const newT = activeNow.has(it.id_item) ? T_new.get(it.id_item) || 0 : 0;
        const deltaItem = round2(Math.max(0, oldT - newT));
        if (deltaItem === 0) continue;

        const dist = aplicadoByItem[it.id_item] || [];
        if (!dist.length) continue;

        const sumAplicado = dist.reduce((s, r) => round2(s + r.aplicado), 0);
        const devolverEnItem = round2(Math.min(deltaItem, sumAplicado));

        let acumulado = 0;
        for (let i = 0; i < dist.length; i++) {
          const { id_pago: pid, aplicado } = dist[i];
          let r = 0;
          if (sumAplicado > 0)
            r = round2((aplicado / sumAplicado) * devolverEnItem);
          if (i === dist.length - 1) r = round2(devolverEnItem - acumulado);
          r = Math.min(r, aplicado);

          const nuevoAplicado = round2(aplicado - r);
          if (nuevoAplicado > 0) {
            await conn.execute(
              `UPDATE items_pagos SET monto = ? WHERE id_item = ? AND id_pago = ?`,
              [nuevoAplicado, it.id_item, pid]
            );
          } else {
            await conn.execute(
              `DELETE FROM items_pagos WHERE id_item = ? AND id_pago = ?`,
              [it.id_item, pid]
            );
          }

          refundByPago[pid] = round2((refundByPago[pid] || 0) + r);
          acumulado = round2(acumulado + r);
        }
      }

      // 6) Aplicar devolución por pago (wallet/directo) + registrar en wallet_devoluciones
      for (const pid of Object.keys(refundByPago)) {
        const delta = refundByPago[pid];
        if (delta <= 0) continue;

        let info = pagoInfo[pid];
        if (!info) {
          const [[p]] = await conn.execute(
            `SELECT * FROM pagos WHERE id_pago = ?`,
            [pid]
          );
          if (!p) continue;
          info = pagoInfo[pid] = {
            id_saldo_a_favor: p.id_saldo_a_favor,
            metodo_de_pago: (p.metodo_de_pago || "").toLowerCase(),
            id_agente: p.id_agente,
            fecha_pago: p.fecha_pago,
            currency: p.currency,
            tipo_de_tarjeta: p.tipo_de_tarjeta,
            link_pago: p.link_pago,
            last_digits: p.last_digits,
            concepto: p.concepto,
            referencia: p.referencia,
            autorizacion_stripe: p.autorizacion_stripe,
            banco: p.banco,
            total: round2(+p.total || 0),
          };
        }

        const isWallet =
          info.id_saldo_a_favor != null ||
          info.metodo_de_pago === "wallet" ||
          info.metodo_de_pago === "saldo_a_favor";

        if (isWallet) {
          // 6.A) Regreso a mismo saldo
          const sid = info.id_saldo_a_favor;
          if (sid != null) {
            const [[s]] = await conn.execute(
              `SELECT saldo, monto FROM saldos_a_favor WHERE id_saldos = ? FOR UPDATE`,
              [sid]
            );
            if (s) {
              const saldoAntes = round2(+s.saldo || 0);
              const newSaldo = Math.min(+s.monto, round2(saldoAntes + delta));
              await conn.execute(
                `UPDATE saldos_a_favor SET saldo = ?, activo = ? WHERE id_saldos = ?`,
                [newSaldo, newSaldo > 0 ? 1 : 0, sid]
              );
            }
          }
          const [[p]] = await conn.execute(
            `SELECT total FROM pagos WHERE id_pago = ? FOR UPDATE`,
            [pid]
          );
          const newPagoTotal = Math.max(0, round2((+p.total || 0) - delta));
          const sub = round2(newPagoTotal / 1.16);
          const iva = round2(newPagoTotal - sub);
          await conn.execute(
            `UPDATE pagos SET total = ?, subtotal = ?, impuestos = ? WHERE id_pago = ?`,
            [newPagoTotal, sub, iva, pid]
          );
        } else {
          // 6.B) Directo -> crear wallet y amarrarlo
          const oldPagoTotal = round2(info.total || 0);
          if (delta > oldPagoTotal) {
            throw new CustomError(
              "El monto a devolver excede el pago registrado.",
              400,
              "REFUND_EXCEEDS_PAYMENT",
              { id_pago: pid, delta, oldPagoTotal }
            );
          }
          const newPagoTotal = round2(oldPagoTotal - delta);

          const [result] = await conn.execute(
            `INSERT INTO saldos_a_favor (
              id_agente, fecha_creacion, saldo, monto, metodo_pago,
              fecha_pago, concepto, referencia, currency, tipo_tarjeta,
              comentario, link_stripe, is_facturable, is_descuento,
              comprobante, activo, ult_digits, numero_autorizacion, banco_tarjeta
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              info.id_agente || id_agente,
              new Date(),
              delta,
              oldPagoTotal,
              "transferencia",
              info.fecha_pago || null,
              info.concepto || "Devolución por ajuste de venta",
              info.referencia || null,
              (info.currency || "MXN").toUpperCase(),
              info.tipo_de_tarjeta === "credit"
                ? "credito"
                : info.tipo_de_tarjeta === "debit"
                ? "debito"
                : null,
              null,
              info.link_pago || null,
              1,
              0,
              null,
              1,
              info.last_digits ? parseInt(info.last_digits) : null,
              info.autorizacion_stripe || null,
              info.banco || null,
            ]
          );
          const id_saldo_creado = result.insertId;

          const nv = splitVenta(newPagoTotal);
          await conn.execute(
            `UPDATE pagos
               SET id_saldo_a_favor = ?, total = ?, subtotal = ?, impuestos = ?
             WHERE id_pago = ?`,
            [id_saldo_creado, nv.total, nv.subtotal, nv.impuestos, pid]
          );

          try {
            await conn.execute(
              `UPDATE facturas_pagos_y_saldos SET id_saldo_a_favor = ? WHERE id_pago = ?`,
              [id_saldo_creado, pid]
            );
          } catch (e) {
            /* vista no actualizable, ignorar */
          }
        }
      }

      // 7) Recalcular servicio / booking a precio_actualizado
      {
        const { total, subtotal, impuestos } = splitVenta(
          Number(precio_actualizado)
        );
        await conn.execute(
          `UPDATE servicios SET total = ?, subtotal = ?, impuestos = ? WHERE id_servicio = ?`,
          [total, subtotal, impuestos, id_servicio]
        );
        await conn.execute(
          `UPDATE bookings  SET total = ?, subtotal = ?, impuestos = ? WHERE id_booking  = ?`,
          [total, subtotal, impuestos, id_booking]
        );
      }

      await conn.commit();

      return {
        nightsDelta,
        refund_teorico: refundSolicitado,
        items_finales: itemsFinal.map(({ id_item, total, fecha_uso }) => ({
          id_item,
          total,
          fecha_uso,
        })),
      };
    });

    return res.status(200).json({
      ok: true,
      
      message: "Rebaja aplicada correctamente (wallet/directo) con fechas por noche desde check-in.",
      data
    });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "Error aplicando rebaja",
      error: error || "ERROR_BACK",
      data: null,
    });
  }
};
const pagoPorSaldoAFavor = async (req, res) => {
  try {
    const { SaldoAFavor, items_seleccionados } = req.body;
    if (!SaldoAFavor || !Array.isArray(items_seleccionados)) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    // 1️⃣ Un pago por servicio
    const pagosPorServicio = {};
    items_seleccionados.forEach((item) => {
      if (!pagosPorServicio[item.id_servicio]) {
        pagosPorServicio[item.id_servicio] = `pag-${uuidv4()}`;
      }
    });

    // 2️⃣ Inyectar id_pago en cada item
    const itemsConPago = items_seleccionados.map((item) => ({
      ...item,
      id_pago: pagosPorServicio[item.id_servicio],
    }));

    // 3️⃣ Montos para la respuesta
    const montoAplicado = itemsConPago.reduce(
      (sum, it) => sum + (it.saldo - it.saldonuevo),
      0
    );
    const nuevoSaldo = SaldoAFavor.saldo;

    // 4️⃣ Llamada al SP (12 parámetros)
    await executeSP("sp_asignar_saldosAF_a_pagos", [
      SaldoAFavor.id_saldos, // 1
      SaldoAFavor.id_agente, // 2
      SaldoAFavor.metodo_pago, // 3
      SaldoAFavor.fecha_pago, // 4
      SaldoAFavor.concepto, // 5
      SaldoAFavor.referencia, // 6
      SaldoAFavor.currency, // 7
      SaldoAFavor.tipo_tarjeta, // 8
      SaldoAFavor.link_stripe, // 9
      SaldoAFavor.ult_digits ?? null, // 10
      JSON.stringify(itemsConPago), // 11 p_items_json
      nuevoSaldo, // 12 p_nuevo_saldo
    ]);

    res.json({
      success: true,
      ids_pagos: Object.values(pagosPorServicio),
      monto_aplicado: montoAplicado,
      nuevo_saldo: nuevoSaldo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error al aplicar pagos",
      error: err.message,
    });
  }
};

const getAllPagosPrepago = async (req, res) => {
  try {
    const pagos = await executeQuery(
      `SELECT *
FROM vw_pagos_prepago_facturables;`
    );
    const balance = await executeQuery(
      `SELECT * FROM vw_balance_pagos_facturas;`
    );

    res.status(200).json({
      message: "Pagos de prepago obtenidos correctamente",
      data: pagos,
      balance: balance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al obtener los pagos de prepago",
      error: error.message || "Error desconocido",
    });
  }
};

const getDetallesConexionesPagos = async (req, res) => {
  const { id_agente, id_raw } = req.query;
  try {
    const [facturas = [], reservas = []] = await executeSP2(
      "sp_get_detalles_conexion_pagos",
      [id_agente, id_raw],
      { allSets: true }
    );
    if (facturas.length === 0 && reservas.length === 0) {
      throw new CustomError(
        "No se encontraron detalles para el pago especificado",
        404,
        "NOT_FOUND",
        { id_agente, id_raw }
      );
    }
    res.status(200).json({
      message: "Detalles obtenidos correctamente",
      data: { facturas: facturas || [], reservas: reservas || [] },
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message:
        error.message || "Error desconocido al obtener detalles de conexiones",
      error: error || "ERROR_BACK",
      data: null,
    });
  }
};

const get_pagos_prepago_by_ID = async (req, res) => {
  try {
    const id_agente =
      req.params.id_agente ??
      req.params.id ??
      req.query.id_agente ??
      req.body.id_agente ??
      "";
    if (!id_agente) throw new ShortError("No existe id_agente", 404);

    const sql = "CALL sp_get_pagos_prepago(?)";
    const result = await executeQuery(sql, [id_agente]);

    console.log(result);

    const data =
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;

    return res.status(200).json({
      message: "Datos obtenidos con exito",
      data: { pagos: data, count: Array.isArray(data) ? data.length : 0 },
    });
  } catch (error) {
    console.error("Error en get_pagos_prepago_by_ID:", error);
    return res.status(500).json({
      error: error,
      message: error.message || "Error al obtener pagos de prepago",
      data: null,
    });
  }
};

module.exports = {
  get_pagos_prepago_by_ID,
  create,
  read,
  getAgenteCredito,
  getEmpresaCredito,
  getAgenteAgentesYEmpresas,
  updateCreditAgent,
  updateCreditEmpresa,
  pagoPorCredito,
  getPagosAgente,
  getPendientesAgente,
  getAllPendientes,
  getAllPagos,
  readConsultas,
  handlerPagoContadoRegresarSaldo,
  pagoPorSaldoAFavor,
  crearItemdeAjuste,
  getAllPagosPrepago,
  getMetodosPago,
  pagarCarritoConCredito,
  getDetallesConexionesPagos,
  aplicarCambioNochesOAjuste,
};
