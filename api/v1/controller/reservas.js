const model = require("../model/reservas");
const {
  executeQuery,
  executeSP2,
  executeSP,
  runTransaction,
} = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
const { CustomError } = require("../../../middleware/errorHandler");

const create = async (req, res) => {
  //revisemos el body
  console.log(req.body);

  const { reserva } = req.body;
  const { estado_reserva, solicitud } = reserva;
  if (estado_reserva === "Cancelada") {
    //SI AL PROCESAR LA SOLICITUD SE SETEA COMO CANCELADA, SE CANCELA LA SOLICITUD Y NO SE CREA LA RESERVA
    try {
      await executeQuery(
        `UPDATE solicitudes 
           SET status = 'Canceled' 
         WHERE id_solicitud = ?`,
        [solicitud.id_solicitud]
      );
      return res
        .status(200)
        .json({ message: "Solicitud cancelada correctamente" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: "Error interno al cancelar solicitud",
        details: error.message,
      });
    }
  }
  try {
    let response = await model.insertarReserva(req.body);
    res
      .status(201)
      .json({ message: "Solicitud created successfully", data: response });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// const updateReserva = async (req, res) => {
//   try {
//     let response = await model.editarReserva(req.body, req.query.id);
//     res
//       .status(201)
//       .json({ message: "Solicitud created successfully", data: response });
//   } catch (error) {
//     console.error(error);
//     res
//       .status(500)
//       .json({ error: "Internal Server Error", details: error.message });
//   }
// };

/*const updateReserva2 = async (req, res) => {
  console.log("Llegando al endpoint de updateReserva2");
  const { id } = req.query;
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
    acompanantes,
    metadata,
  } = req.body;

  console.log(id);
  console.log("Revisando el body ⚠️⚠️⚠️⚠️", req.body);

  try {
    // 1) Generar id_item para cada ítem nuevo
    const itemsConIds = (items?.current || []).map((item) => ({
      ...item,
      id_item: item.id_item || `ite-${uuidv4()}`,
    }));

    console.log("Checando que trae este rollo");
    console.log(itemsConIds);

    // 2) Serializar JSON
    const itemsJson = JSON.stringify(itemsConIds);
    const impuestosJson = JSON.stringify(impuestos?.current || []);

    // 3) Array de **20** parámetros para el SP
    const params = [
      id, // 1) p_id_booking
      viajero?.current?.id_viajero ?? null, // 2) p_id_viajero
      check_in?.current ?? null, // 3) p_check_in
      check_out?.current ?? null, // 4) p_check_out
      // venta?.current?.total ?? null,             // 5) p_total (si tu SP lo pide, descomenta 5-7 y ajusta placeholders)
      // venta?.current?.subtotal ?? null,          // 6) p_subtotal
      // venta?.current?.impuestos ?? null,         // 7) p_impuestos
      estado_reserva?.current ?? null, // 8) p_estado_reserva
      proveedor?.current?.total ?? null, // 9) p_costo_total
      proveedor?.current?.subtotal ?? null, // 10) p_costo_subtotal
      proveedor?.current?.impuestos ?? null, // 11) p_costo_impuestos
      hotel?.current?.content?.nombre_hotel ?? null, // 12) p_nombre_hotel
      hotel?.current?.content?.id_hotel ?? null, // 13) p_id_hotel
      codigo_reservacion_hotel?.current ?? null, // 14) p_codigo_reservacion_hotel
      habitacion?.current ?? null, // 15) p_tipo_cuarto
      noches?.current ?? null, // 16) p_noches
      comments?.current ?? null, // 17) p_comments
      itemsJson, // 18) p_items_json
      impuestosJson, // 19) p_impuestos_json
      nuevo_incluye_desayuno ?? null, // 20) p_nuevo_incluye_desayuno
    ];

    console.log("por entrar al sp");
    // Verificamos primero el total de items de la reserva
   
const infoItems = req.body.items.current || [];
const nochesBefore = noches.before || 0;
const nochesActual = noches.current || 0;
const query_insert_items = `insert into items (id_item,total,subtotal,impuestos,is_facturado,fecha_uso,id_hospedaje,costo_total,costo_subtotal,costo_impuestos,saldo,costo_iva,is_ajuste)
    values (?,?,?,?,?,?,?,?,?,?,?,?,?)`;

// Si hay cambio en el número de noches
if (nochesBefore !== nochesActual) {
  if (nochesActual > nochesBefore) {
    // Caso 1: Se aumentaron noches - agregar nuevos items
    const itemTemplate = itemsConIds[0]; // Tomamos el primer item como template
    const nuevosItems = [];
    
    for (let i = nochesBefore; i < nochesActual; i++) {
      const nuevoItem = {
        ...itemTemplate,
        noche: i + 1,
        id_item: `ite-${uuidv4()}`
      };
      nuevosItems.push(nuevoItem);
      
      // Insertar el nuevo item
      await executeQuery(query_insert_items, [
        nuevoItem.id_item,
        nuevoItem.venta.total,
        nuevoItem.venta.subtotal,
        nuevoItem.venta.impuestos,
        0, // is_facturado
        new Date(),
        metadata.id_hospedaje, // id_hospedaje
        nuevoItem.costo.total,
        nuevoItem.costo.subtotal,
        nuevoItem.costo.impuestos,
        metadata.id_credito != null ? nuevoItem.venta.total :0,  // saldo
        nuevoItem.impuestos[1]?.importe || 0, // costo_iva
        0 // is_ajuste
      ]);
    }
  } else {
    // Caso 2: Se redujeron noches - desactivar items sobrantes
    const itemsADesactivar = nochesActual - nochesBefore;
    if (itemsADesactivar > 0) {
      await executeQuery(
        `UPDATE items 
         SET estado = 0 
         WHERE id_hospedaje = ? 
         AND estado = 1
         ORDER BY created_at ASC 
         LIMIT ?`,
        [metadata.id_hospedaje, itemsADesactivar]
      );
    }
  }
}
console
    // 4) Llamar al SP
    // const result = await executeSP("sp_editar_reserva_procesada", params);

    // Prepara acompañantes
    const idHosp = metadata?.id_hospedaje;
    if (!idHosp) {
      return res
        .status(400)
        .json({ error: "metadata.id_hospedaje es requerido" });
    }
    const idViajeroPrincipal =
      viajero?.current?.id_viajero ?? metadata?.id_viajero_reserva ?? null;

    const acompList = Array.isArray(acompanantes) ? acompanantes : [];
    const acompFiltrados = acompList
      .map((a) => a?.id_viajero)
      .filter((idv) => idv && idv !== idViajeroPrincipal);

    // 4) Ejecuta TODO dentro de una sola transacción
    const result = await runTransaction(async (connection) => {
      // 4.1 SP (ajusta los ? al número real de parámetros del SP)
      await connection.execute(
        "CALL sp_editar_reserva_procesada(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params
      );

      // 4.2 Borra acompañantes (no-principal)
      await connection.execute(
        `DELETE FROM viajeros_hospedajes
          WHERE id_hospedaje = ?
            AND (is_principal = 0 OR is_principal IS NULL)`,
        [idHosp]
      );

      // 4.3 Inserta acompañantes del payload (si hay)
      if (acompFiltrados.length > 0) {
        const values = acompFiltrados.map(() => "(?,?,0)").join(",");
        const paramsIns = acompFiltrados.flatMap((idv) => [idv, idHosp]);

        await connection.execute(
          `INSERT INTO viajeros_hospedajes (id_viajero, id_hospedaje, is_principal)
           VALUES ${values}`,
          paramsIns
        );
      }

      // Opcional: devolver algo desde la TX
      return { inserted: acompFiltrados.length };
    });

    // 5) Responder
    return res.status(200).json({
      ok: true,
      message: "Reserva actualizada correctamente",
      data: {
        id_booking: id,
        items: itemsConIds,
        impuestos: impuestos?.current || [],
        tx: result,
      },
    });
  } catch (error) {
    console.error("Error en updateReserva2:", error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};*/
// Asegúrate de tener importado uuidv4 en tu archivo:
// const { v4: uuidv4 } = require('uuid');

// const { v4: uuidv4 } = require('uuid');
// const { v4: uuidv4 } = require('uuid');

const hasKey = (obj, key) =>
  obj && Object.prototype.hasOwnProperty.call(obj, key);

const toMysqlDateTime = (val) => {
  if (!val) return null;
  if (typeof val === "string" && val.length === 10) return `${val} 00:00:00`;
  try {
    return new Date(val).toISOString().slice(0, 19).replace("T", " ");
  } catch {
    return null;
  }
};

const updateReserva2 = async (req, res) => {
  console.log("Llegando al endpoint de updateReserva2");
  const { id } = req.query;

  // Toma solo lo que venga; todo es opcional
  const {
    viajero, // puede no venir
    check_in, // puede no venir
    check_out, // puede no venir
    venta, // puede no venir
    estado_reserva, // puede no venir
    proveedor, // puede no venir
    hotel, // puede no venir
    codigo_reservacion_hotel, // puede no venir
    habitacion, // puede no venir
    noches, // puede no venir
    comments, // puede no venir
    items, // puede no venir
    impuestos, // puede no venir
    nuevo_incluye_desayuno, // puede no venir
    acompanantes, // puede no venir
    metadata = {}, // suele venir, pero defensivo
  } = req.body || {};

  console.log("Revisando el body ⚠️⚠️⚠️⚠️", req.body);

  try {
    // 1) Items: genera IDs solo si items.current viene
    const itemsConIds = Array.isArray(items?.current)
      ? items.current.map((item) => ({
          ...item,
          id_item: item.id_item || `ite-${uuidv4()}`,
        }))
      : [];

    // 2) Serializar JSON (aunque vengan vacíos)
    const itemsJson = JSON.stringify(itemsConIds);
    const impuestosJson = JSON.stringify(
      Array.isArray(impuestos?.current) ? impuestos.current : []
    );

    // 3) Parámetros del SP (si lo vas a llamar). Coloca null si no viene.
    //    Ajusta la firma real de tu SP si cambió.
    const params = [
      id, // 1) p_id_booking
      viajero?.current?.id_viajero ?? null, // 2) p_id_viajero
      check_in?.current ?? null, // 3) p_check_in
      check_out?.current ?? null, // 4) p_check_out
      // venta?.current?.total ?? null,             // 5) p_total (si aplica)
      // venta?.current?.subtotal ?? null,          // 6) p_subtotal
      // venta?.current?.impuestos ?? null,         // 7) p_impuestos
      estado_reserva?.current ?? null, // 8) p_estado_reserva
      proveedor?.current?.total ?? null, // 9) p_costo_total
      proveedor?.current?.subtotal ?? null, // 10) p_costo_subtotal
      proveedor?.current?.impuestos ?? null, // 11) p_costo_impuestos
      hotel?.current?.content?.nombre_hotel ?? null, // 12) p_nombre_hotel
      hotel?.current?.content?.id_hotel ?? null, // 13) p_id_hotel
      codigo_reservacion_hotel?.current ?? null, // 14) p_codigo_reservacion_hotel
      habitacion?.current ?? null, // 15) p_tipo_cuarto
      noches?.current ?? null, // 16) p_noches
      comments?.current ?? null, // 17) p_comments
      itemsJson, // 18) p_items_json
      impuestosJson, // 19) p_impuestos_json
      hasKey(req.body, "nuevo_incluye_desayuno")
        ? nuevo_incluye_desayuno
        : null, // 20) p_nuevo_incluye_desayuno solo si llegó
    ];

    // 4) Viajeros/acompañantes:
    //    Solo tocamos este bloque si el payload INCLUYE al menos una de estas llaves.
    const includesViajeroKey = hasKey(req.body, "viajero");
    const includesAcompKey = hasKey(req.body, "acompanantes");

    const idHosp = metadata?.id_hospedaje;
    if (!idHosp) {
      return res
        .status(400)
        .json({ error: "metadata.id_hospedaje es requerido" });
    }

    // Fallback para principal si no mandan 'viajero'
    const idViajeroPrincipal =
      viajero?.current?.id_viajero ?? metadata?.id_viajero_reserva ?? null;

    // Normaliza acompañantes si vinieron; si no, no tocamos acompañantes
    const acompList =
      includesAcompKey && Array.isArray(acompanantes) ? acompanantes : null;

    // Construye lista final de viajeros solo si debemos actualizar viajeros
    const shouldUpdateTravelers = includesViajeroKey || includesAcompKey;

    const result = await runTransaction(async (connection) => {
      // [Opcional] si vas a llamar SP, descomenta y ajusta:
      await connection.execute(
        "CALL sp_editar_reserva_procesada(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params
      );

      let viajerosTx = { inserted: 0, deleted: 0, updated: 0, skipped: true };

      if (shouldUpdateTravelers) {
        // Leemos estado actual
        const [viajerosActualesRows] = await connection.execute(
          `SELECT id_viajero, is_principal FROM viajeros_hospedajes WHERE id_hospedaje = ?`,
          [idHosp]
        );
        const viajerosActuales = Array.isArray(viajerosActualesRows)
          ? viajerosActualesRows
          : [];

        // Construimos nuevosViajeros únicamente con lo que vino:
        // - Si vino 'viajero', definimos/el reafirmamos el principal.
        // - Si vino 'acompanantes', definimos el set de acompañantes actual.
        const nuevosViajeros = [];

        if (includesViajeroKey && idViajeroPrincipal) {
          nuevosViajeros.push({
            id_viajero: idViajeroPrincipal,
            is_principal: 1,
          });
        } else {
          // Si NO vino 'viajero' pero sí queremos tocar viajeros (por acompañantes),
          // mantenemos/el preservamos el principal actual si existía, o si no, el metadata.
          const principalActual =
            viajerosActuales.find((v) => v.is_principal === 1)?.id_viajero ??
            idViajeroPrincipal;
          if (principalActual) {
            nuevosViajeros.push({
              id_viajero: principalActual,
              is_principal: 1,
            });
          }
        }

        if (includesAcompKey) {
          const acompIds = (acompList || [])
            .map((a) => a?.id_viajero)
            .filter(Boolean);

          // Quita al principal si por error viene en acompañantes
          const principalId = nuevosViajeros.find(
            (v) => v.is_principal === 1
          )?.id_viajero;
          const acompUnique = [...new Set(acompIds)].filter(
            (idv) => idv !== principalId
          );

          for (const idv of acompUnique) {
            nuevosViajeros.push({ id_viajero: idv, is_principal: 0 });
          }
        } else {
          // No vinieron acompañantes en payload: preserva los acompañantes actuales
          // (no tocar acompañantes en absoluto)
          for (const v of viajerosActuales) {
            if (v.is_principal === 0) {
              nuevosViajeros.push({
                id_viajero: v.id_viajero,
                is_principal: 0,
              });
            }
          }
        }

        // Calcula diffs
        const nuevosIds = nuevosViajeros.map((v) => v.id_viajero);
        const actualesIds = viajerosActuales.map((v) => v.id_viajero);

        const idsAEliminar = actualesIds.filter(
          (idv) => !nuevosIds.includes(idv)
        );
        const idsAInsertar = nuevosIds.filter(
          (idv) => !actualesIds.includes(idv)
        );
        const idsAActualizar = nuevosIds.filter((idv) =>
          actualesIds.includes(idv)
        );

        // DELETE
        if (idsAEliminar.length > 0) {
          const placeholders = idsAEliminar.map(() => "?").join(",");
          await connection.execute(
            `DELETE FROM viajeros_hospedajes WHERE id_hospedaje = ? AND id_viajero IN (${placeholders})`,
            [idHosp, ...idsAEliminar]
          );
          viajerosTx.deleted = idsAEliminar.length;
        }

        // INSERT nuevos
        for (const v of nuevosViajeros.filter((v) =>
          idsAInsertar.includes(v.id_viajero)
        )) {
          await connection.execute(
            `INSERT INTO viajeros_hospedajes (id_viajero, id_hospedaje, is_principal) VALUES (?, ?, ?)`,
            [v.id_viajero, idHosp, v.is_principal]
          );
          viajerosTx.inserted += 1;
        }

        // UPDATE flags (principal/no principal) donde aplique
        for (const v of nuevosViajeros.filter((v) =>
          idsAActualizar.includes(v.id_viajero)
        )) {
          const previo = viajerosActuales.find(
            (x) => x.id_viajero === v.id_viajero
          );
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

      // Puedes añadir aquí más updates parciales (estado_reserva, fechas, etc.) usando solo lo que venga

      return {
        viajeros: viajerosTx,
        // podrías regresar también lo que hiciste con items/impuestos si aplicó
      };
    });

    return res.status(200).json({
      message: "Reserva actualizada correctamente",
      data: {
        id_booking: id,
        items: itemsConIds, // si no vinieron, []
        impuestos: Array.isArray(impuestos?.current) ? impuestos.current : [],
        viajeros_tx: result.viajeros,
      },
    });
  } catch (error) {
    console.error("Error en updateReserva2:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error?.message || String(error),
    });
  }
};

// const updateReserva2 = async (req, res) => {
//   console.log("Llegando al endpoint de updateReserva2, viendo el body",req.body);

//   const { id } = req.query;
//   const { metadata } = req.body;

//   const {
//     viajero,
//     check_in,
//     check_out,
//     estado_reserva,
//     proveedor,
//     hotel,
//     codigo_reservacion_hotel,
//     habitacion,
//     noches,
//     comments,
//     items,
//     impuestos,
//     nuevo_incluye_desayuno
//   } = req.body;

//   console.log("id booking:", id);
//   console.log("Revisando el body ⚠️", JSON.stringify(req.body, null, 2));

//   // Helper de logging
//   const planned = [];
//   const logExec = (type, sql, params) => {
//     planned.push({ type, sql, params });
//     console.log(`\n[EXEC] ${type}\nSQL:\n${sql}\nPARAMS:`);
//     console.dir(params, { depth: null });
//   };

//   // Asegurar ids en items entrantes (plantilla para inserts)
//   const itemsConIds = (items?.current || []).map((item) => ({
//     ...item,
//     id_item: item.id_item || `ite-${uuidv4()}`,
//   }));

//   // JSON para SP
//   const itemsJson = JSON.stringify(itemsConIds);
//   const impuestosJson = JSON.stringify(impuestos?.current || []);

//   // Parámetros del SP (19, manteniendo los comentados fuera)
//   const spParams = [
//     id, // 1) p_id_booking
//     viajero?.current?.id_viajero ?? null, // 2) p_id_viajero
//     check_in?.current ?? null, // 3) p_check_in
//     check_out?.current ?? null, // 4) p_check_out
//     // venta?.current?.total ?? null, // 5) p_total
//     // venta?.current?.subtotal ?? null, // 6) p_subtotal
//     // venta?.current?.impuestos ?? null, // 7) p_impuestos
//     estado_reserva?.current ?? null, // 8) p_estado_reserva
//     proveedor?.current?.total ?? null, // 9) p_costo_total
//     proveedor?.current?.subtotal ?? null, // 10) p_costo_subtotal
//     proveedor?.current?.impuestos ?? null, // 11) p_costo_impuestos
//     hotel?.current?.content?.nombre_hotel ?? null, // 12) p_nombre_hotel
//     hotel?.current?.content?.id_hotel ?? null, // 13) p_id_hotel
//     codigo_reservacion_hotel?.current ?? null, // 14) p_codigo_reservacion_hotel
//     habitacion?.current ?? null, // 15) p_tipo_cuarto
//     noches?.current ?? null, // 16) p_noches
//     comments?.current ?? null, // 17) p_comments
//     itemsJson, // 18) p_items_json
//     impuestosJson, // 19) p_impuestos_json
//   ];

//   const nochesBefore = noches?.before || 0;
//   const nochesActual = noches?.current || 0;

//   const sqlInsertItem = `
//     INSERT INTO items (
//       id_item, total, subtotal, impuestos, is_facturado, fecha_uso, id_hospedaje,
//       costo_total, costo_subtotal, costo_impuestos, saldo, costo_iva, is_ajuste
//     )
//     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
//   `.trim();

//   try {
//     await runTransaction(async (connection) => {
//       // (A) Si aumentan noches → insertar nuevos items clonando del primero
//       if (nochesActual > nochesBefore) {
//         const itemTemplate = itemsConIds[0];
//         if (!itemTemplate) {
//           console.warn(
//             "No hay item template disponible para crear nuevas noches."
//           );
//         } else {
//           const cantidad = nochesActual - nochesBefore;
//           for (let i = 0; i < cantidad; i++) {
//             const nuevoItem = {
//               ...itemTemplate,
//               id_item: `ite-${uuidv4()}`,
//             };

//             const ivaCosto =
//               (nuevoItem.impuestos || []).find(
//                 (x) => (x.name || "").toLowerCase() === "iva"
//               )?.total || 0;

//             const paramsInsert = [
//               nuevoItem.id_item,
//               nuevoItem.venta.total,
//               nuevoItem.venta.subtotal,
//               nuevoItem.venta.impuestos,
//               0, // is_facturado
//               new Date(), // fecha_uso
//               metadata.id_hospedaje,
//               nuevoItem.costo.total,
//               nuevoItem.costo.subtotal,
//               nuevoItem.costo.impuestos,
//               metadata.id_credito != null ? nuevoItem.venta.total : 0, // saldo
//               ivaCosto, // costo_iva
//               0, // is_ajuste
//             ];

//             logExec("INSERT items (+noche)", sqlInsertItem, paramsInsert);
//             // await connection.execute(sqlInsertItem, paramsInsert);
//           }
//         }
//       }

//       // (B) Si reducen noches → desactivar los más recientes (LIFO)
//       if (nochesActual < nochesBefore) {
//         const itemsADesactivar = Math.max(0, (nochesBefore - nochesActual) | 0);

//         if (itemsADesactivar > 0) {
//           // 👇 Sanitiza el límite como entero literal (sin placeholder)
//           const limit =
//             Number.isFinite(itemsADesactivar) && itemsADesactivar > 0
//               ? Math.floor(itemsADesactivar)
//               : 0; // LIMIT 0 devuelve 0 filas (seguro)

//           // 1) Seleccionar ids más recientes (sin `?` en LIMIT)
//           const sqlSelectIds = `
//       SELECT id_item
//       FROM items
//       WHERE id_hospedaje = ?
//         AND estado = 1
//       ORDER BY created_at DESC
//       LIMIT ${limit}
//     `.trim();

//           const selectParams = [metadata.id_hospedaje];
//           console.log(
//             "[EXEC] SELECT ids LIFO para desactivar\nSQL:\n",
//             sqlSelectIds,
//             "\nPARAMS:\n",
//             selectParams
//           );
//           const [rows] = await connection.execute(sqlSelectIds, selectParams);
//           const ids = rows.map((r) => r.id_item);

//           // 2) UPDATE por IN (...)
//           if (ids.length > 0) {
//             const placeholders = ids.map(() => "?").join(",");
//             const sqlUpdate = `
//         UPDATE items
//         SET estado = 0
//         WHERE id_item IN (${placeholders})
//       `.trim();

//             console.log(
//               "[EXEC] UPDATE items (desactivar LIFO)\nSQL:\n",
//               sqlUpdate,
//               "\nPARAMS:\n",
//               ids
//             );
//             // await connection.execute(sqlUpdate, ids);
//           } else {
//             console.warn("No se encontraron items activos para desactivar.");
//           }
//         }
//       }

//       // (C) Llamar al SP
//       const spName = "sp_editar_reserva_procesada";
//       const spPlaceholders = Array(spParams.length).fill("?").join(",");
//       const sqlCall = `CALL ${spName}(${spPlaceholders})`;

//       logExec(`CALL ${spName}`, sqlCall, spParams);
//       await connection.query(sqlCall, spParams); // query() se lleva mejor con CALL y múltiples resultsets
//     });

//     // Si todo fue bien, responde OK
//     return res.status(200).json({
//       message: "Reserva actualizada correctamente",
//       data: {
//         id_booking: id,
//         items: itemsConIds,
//         impuestos: impuestos?.current || [],
//         planned,
//         meta: { nochesBefore, nochesActual },
//       },
//     });
//   } catch (error) {
//     console.error("Error en updateReserva2 (runTransaction):", error);
//     return res
//       .status(error.statusCode || 500)
//       .json({ error: "Internal Server Error", details: error.message });
//   }
// };

const actualizarViajerosHospedaje = async (
  id_hospedaje,
  viajeroPrincipal,
  acompanantes = []
) => {
  // 1. Obtener viajeros actuales
  const viajerosActuales = await executeQuery(
    `SELECT id_viajero, is_principal FROM viajeros_hospedajes WHERE id_hospedaje = ?`,
    [id_hospedaje]
  );

  // 2. Construir lista de viajeros nuevos
  const nuevosViajeros = [
    { ...viajeroPrincipal, is_principal: 1 },
    ...acompanantes.map((a) => ({ ...a, is_principal: 0 })),
  ];

  // 3. Eliminar los que ya no estén
  const nuevosIds = nuevosViajeros.map((v) => v.id_viajero);
  const idsAEliminar = viajerosActuales
    .filter((v) => !nuevosIds.includes(v.id_viajero))
    .map((v) => v.id_viajero);

  if (idsAEliminar.length > 0) {
    await executeQuery(
      `DELETE FROM viajeros_hospedajes WHERE id_hospedaje = ? AND id_viajero IN (${idsAEliminar
        .map(() => "?")
        .join(",")})`,
      [id_hospedaje, ...idsAEliminar]
    );
  }

  // 4. Insertar o actualizar los nuevos viajeros
  for (const viajero of nuevosViajeros) {
    // Si ya existe, actualiza is_principal, si no, inserta
    const existe = viajerosActuales.find(
      (v) => v.id_viajero === viajero.id_viajero
    );
    if (existe) {
      await executeQuery(
        `UPDATE viajeros_hospedajes SET is_principal = ? WHERE id_hospedaje = ? AND id_viajero = ?`,
        [viajero.is_principal, id_hospedaje, viajero.id_viajero]
      );
    } else {
      await executeQuery(
        `INSERT INTO viajeros_hospedajes (id_viajero, id_hospedaje, is_principal) VALUES (?, ?, ?)`,
        [viajero.id_viajero, id_hospedaje, viajero.is_principal]
      );
    }
  }
};

// controllers/updateReserva3.js
// Reglas aplicadas:
// - SIN notas de crédito.
// - Si hay items facturados => NO permitir edición (409).
// - Cambio de noches => gestionar items (agregar/quitar) y fechas de uso INCLUSIVAS.
// - Cambio de precio directo (sin cambio de noches) => crear UN item de ajuste (is_ajuste=1).
// - Caso mixto => primero noches, luego ajuste residual.
// - Redondeo a 2 decimales.
// - Reducir noches => "apagar" items (activo = 1), NO borrar.
// Requiere una función global `executeQuery(sql, params)` (mysql2/promise style).

// controllers/updateReserva3.js
// Fixes:
// - estado (1=activo, 0=inactivo) reemplaza por completo cualquier uso de "activo"
// - Solo agrego/apago la diferencia de noches respecto a lo que YA hay en DB
// - Bandera: 1=wallet, 2=crédito, 3=guardar sin alterar precio (no crea ajuste)

async function updateReserva3(req, res) {
  const body = req.body;
  const { id } = req.query; // id_booking opcional por query

  // ===== Logger estilo updateReserva2 =====
  const planned = [];
  const logExec = (type, sql, params) => {
    planned.push({ type, sql, params });
    console.log(`\n[EXEC] ${type}\nSQL:\n${sql}\nPARAMS:`);
    console.dir(params, { depth: null });
  };

  // ===== Helpers =====
  const r2 = (n) =>
    Number.parseFloat(
      (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2)
    );
  const get = (obj, path, dflt) => {
    if (!obj) return dflt;
    const v = path
      .split(".")
      .reduce(
        (o, k) =>
          o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined,
        obj
      );
    return v === undefined || v === null ? dflt : v;
  };
  const toDateOnly = (isoOrDateStr) => {
    if (!isoOrDateStr) return null;
    const d = new Date(isoOrDateStr);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const addDays = (yyyy_mm_dd, inc) => {
    const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    base.setUTCDate(base.getUTCDate() + inc);
    const y2 = base.getUTCFullYear();
    const m2 = String(base.getUTCMonth() + 1).padStart(2, "0");
    const d2 = String(base.getUTCDate()).padStart(2, "0");
    return `${y2}-${m2}-${d2}`;
  };
  const buildInclusiveDates = (startYmd, nights) => {
    const out = [];
    for (let i = 0; i < nights; i++) out.push(addDays(startYmd, i)); // INCLUSIVO
    return out;
  };
  const breakdownByRates = (
    delta,
    { ivaPct = 0, ishPct = 0, otrosPct = 0, otrosMonto = 0 }
  ) => {
    const sumPct = Number(ivaPct) + Number(ishPct) + Number(otrosPct);
    if (sumPct <= 0) return { sub: r2(delta * 0.86), imp: r2(delta * 0.14) }; // fallback si no hay tasas
    const sub = (Number(delta) - Number(otrosMonto || 0)) / (1 + sumPct / 100);
    const imp = Number(delta) - sub;
    return { sub: r2(sub), imp: r2(imp) };
  };

  // ===== SQL =====
  const SQL_SELECT_ITEMS_ASC = `
    SELECT id_item, fecha_uso, total, subtotal, impuestos,
           costo_total, costo_subtotal, costo_impuestos,
           is_facturado, is_ajuste, estado
      FROM items
     WHERE id_hospedaje = ?
     ORDER BY fecha_uso ASC, id_item ASC
  `.trim();

  const SQL_UPDATE_HOSPEDAJES = (fields) =>
    `
    UPDATE hospedajes
       SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id_hospedaje = ?
  `.trim();

  const SQL_UPDATE_BOOKINGS = (fields) =>
    `
    UPDATE bookings
       SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id_booking = ?
  `.trim();

  const SQL_INSERT_ITEM = `
    INSERT INTO items (
      id_item, total, subtotal, impuestos, is_facturado, fecha_uso, id_hospedaje,
      costo_total, costo_subtotal, costo_impuestos, saldo, costo_iva,
      is_ajuste, estado, created_at, updated_at
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())
  `.trim();

  const SQL_DEACTIVATE_BY_IDS = (placeholders) =>
    `
    UPDATE items
       SET estado = 0, updated_at = NOW()
     WHERE id_hospedaje = ? AND id_item IN (${placeholders})
  `.trim();

  const SQL_SUM_ITEMS_ACTIVOS = `
    SELECT
      ROUND(COALESCE(SUM(CASE WHEN estado = 1 THEN total          ELSE 0 END),0),2) AS total,
      ROUND(COALESCE(SUM(CASE WHEN estado = 1 THEN subtotal       ELSE 0 END),0),2) AS subtotal,
      ROUND(COALESCE(SUM(CASE WHEN estado = 1 THEN impuestos      ELSE 0 END),0),2) AS impuestos,
      ROUND(COALESCE(SUM(CASE WHEN estado = 1 THEN costo_total    ELSE 0 END),0),2) AS c_total,
      ROUND(COALESCE(SUM(CASE WHEN estado = 1 THEN costo_subtotal ELSE 0 END),0),2) AS c_subtotal,
      ROUND(COALESCE(SUM(CASE WHEN estado = 1 THEN costo_impuestos ELSE 0 END),0),2) AS c_impuestos
    FROM items
    WHERE id_hospedaje = ?
  `.trim();

  const SQL_UPDATE_SALDO_WALLET = `
    UPDATE saldos
       SET saldo = ROUND(saldo - ?, 2), updated_at = NOW()
     WHERE id_saldos = ?
  `.trim();

  const SQL_INSERT_ITEMS_PAGOS = `
    INSERT INTO items_pagos (id_pago, id_item, monto, created_at, updated_at)
    VALUES (?, ?, ?, NOW(), NOW())
  `.trim();

  // ===== Fuente (form > updatedItem > body) =====
  const src = body.form || body.updatedItem || body;

  // IDs
  const id_booking =
    id || get(src, "solicitud.id_booking") || get(body, "id_booking");
  const id_hospedaje =
    get(src, "solicitud.id_hospedaje") || get(body, "metadata.id_hospedaje");
  const id_servicio =
    get(src, "solicitud.id_servicio") || get(body, "id_servicio");
  const bandera = Number(
    get(body, "bandera") ??
      get(body, "updatedItem.bandera") ??
      get(body, "form.bandera") ??
      0
  );

  if (!id_booking || !id_hospedaje) {
    return res.status(400).json({
      ok: false,
      message: "Faltan id_booking o id_hospedaje en el payload.",
    });
  }

  // Datos de negocio
  const estadoTarget = get(
    src,
    "estado_reserva",
    get(body, "estado_reserva.current", "Confirmada")
  );
  const checkInYmd = toDateOnly(
    get(src, "check_in") ||
      get(src, "solicitud.check_in") ||
      get(body, "metadata.check_in")
  );
  const checkOutYmd = toDateOnly(
    get(src, "check_out") ||
      get(src, "solicitud.check_out") ||
      get(body, "metadata.check_out")
  );
  const nochesTarget = Number(get(src, "noches")) || 0;

  const ventaTotalTarget = Number(get(src, "venta.total"));

  // Tasas para desglose
  const tasasObj =
    get(src, "impuestos") || get(body, "updatedItem.impuestos") || {};
  const ivaPct = Number(tasasObj.iva || 0);
  const ishPct = Number(tasasObj.ish || 0);
  const otrosPct = Number(tasasObj.otros_impuestos_porcentaje || 0);
  const otrosMonto = Number(tasasObj.otros_impuestos || 0);

  // Catálogo hotel -> plantilla
  const hotel = get(src, "hotel");
  const habitacion = get(src, "habitacion");
  const pickMoldeFromHotel = () => {
    const tipos = get(hotel, "content.tipos_cuartos", []);
    const match = tipos.find(
      (t) =>
        (t.nombre_tipo_cuarto || "").toUpperCase() ===
        String(habitacion || "").toUpperCase()
    );
    if (!match) return null;
    const vTotal = Number(match.precio || 0);
    const cTotal = Number(match.costo || 0);
    const sumPct = ivaPct + ishPct + otrosPct;
    let vSub = vTotal,
      vImp = 0;
    if (sumPct > 0) {
      vSub = vTotal / (1 + sumPct / 100);
      vImp = vTotal - vSub;
    }
    return {
      venta: { total: r2(vTotal), subtotal: r2(vSub), impuestos: r2(vImp) },
      costo: { total: r2(cTotal), subtotal: r2(cTotal), impuestos: 0 },
    };
  };
  const moldePreferido = pickMoldeFromHotel();

  // Viajeros
  const viajeroPrincipal =
    get(src, "viajero") || get(body, "viajero.current") || null;
  const acompanantes =
    get(src, "acompanantes") ||
    get(body, "acompanantes") ||
    get(body, "acompañantes") ||
    [];

  try {
    await runTransaction(async (connection) => {
      const exec = async (label, sql, params = []) => {
        logExec(label, sql, params);
        return connection.execute(sql, params);
      };
      const query = async (label, sql, params = []) => {
        logExec(label, sql, params);
        return connection.query(sql, params);
      };

      // === Viajeros TX ===
      const actualizarViajerosHospedajeTx = async (
        id_hospedaje,
        viajeroPrincipal,
        acompanantes = []
      ) => {
        const [viajerosActuales] = await exec(
          "VH: select actuales",
          `SELECT id_viajero, is_principal FROM viajeros_hospedajes WHERE id_hospedaje = ?`,
          [id_hospedaje]
        );

        const nuevosViajeros = [];
        if (viajeroPrincipal?.id_viajero) {
          nuevosViajeros.push({ ...viajeroPrincipal, is_principal: 1 });
        }
        for (const a of acompanantes || []) {
          if (a?.id_viajero) nuevosViajeros.push({ ...a, is_principal: 0 });
        }

        const nuevosIds = nuevosViajeros.map((v) => v.id_viajero);
        const idsAEliminar = (viajerosActuales || [])
          .filter((v) => !nuevosIds.includes(v.id_viajero))
          .map((v) => v.id_viajero);

        if (idsAEliminar.length > 0) {
          await exec(
            "VH: eliminar removidos",
            `DELETE FROM viajeros_hospedajes WHERE id_hospedaje = ? AND id_viajero IN (${idsAEliminar
              .map(() => "?")
              .join(",")})`,
            [id_hospedaje, ...idsAEliminar]
          );
        }

        for (const v of nuevosViajeros) {
          const existe = (viajerosActuales || []).find(
            (x) => x.id_viajero === v.id_viajero
          );
          if (existe) {
            await exec(
              "VH: update is_principal",
              `UPDATE viajeros_hospedajes SET is_principal = ? WHERE id_hospedaje = ? AND id_viajero = ?`,
              [v.is_principal ? 1 : 0, id_hospedaje, v.id_viajero]
            );
          } else {
            await exec(
              "VH: insert nuevo",
              `INSERT INTO viajeros_hospedajes (id_viajero, id_hospedaje, is_principal) VALUES (?, ?, ?)`,
              [v.id_viajero, id_hospedaje, v.is_principal ? 1 : 0]
            );
          }
        }
      };

      const fetchItemsAsc = async () => {
        const [rows] = await exec("SELECT items ASC", SQL_SELECT_ITEMS_ASC, [
          id_hospedaje,
        ]);
        return rows || [];
      };
      const anyFacturado = (rows) =>
        (rows || []).some(
          (it) =>
            Number(it.is_facturado) === 1 &&
            Number(it.is_ajuste) === 0 &&
            Number(it.estado) === 1
        );
      const countNochesVigentes = (rows) =>
        (rows || []).filter(
          (it) => Number(it.estado) === 1 && Number(it.is_ajuste) === 0
        ).length;

      const sumActivos = async () => {
        const [rows] = await exec("SUM items activos", SQL_SUM_ITEMS_ACTIVOS, [
          id_hospedaje,
        ]);
        return (
          rows?.[0] || {
            total: 0,
            subtotal: 0,
            impuestos: 0,
            c_total: 0,
            c_subtotal: 0,
            c_impuestos: 0,
          }
        );
      };

      const insertItem = async ({
        id_item,
        fecha_uso,
        venta,
        costo,
        is_ajuste,
        saldoOverride,
      }) => {
        const paramsInsert = [
          id_item,
          r2(venta.total),
          r2(venta.subtotal),
          r2(venta.impuestos),
          0, // is_facturado
          fecha_uso,
          id_hospedaje,
          r2(costo.total),
          r2(costo.subtotal),
          r2(costo.impuestos),
          r2(saldoOverride || 0), // saldo (para crédito)
          0, // costo_iva
          is_ajuste ? 1 : 0,
          1, // estado=1 (activo)
        ];
        await exec("INSERT item", SQL_INSERT_ITEM, paramsInsert);
      };

      const deactivateLastK = async (k) => {
        const rows = await fetchItemsAsc();
        const candidatos = (rows || []).filter(
          (it) =>
            Number(it.estado) === 1 &&
            Number(it.is_ajuste) === 0 &&
            Number(it.is_facturado) === 0
        );
        if (candidatos.length < k) {
          throw Object.assign(
            new Error(
              `No hay suficientes items no facturados para apagar (${candidatos.length} < ${k}).`
            ),
            { http: 400 }
          );
        }
        const ordenadosDesc = [...candidatos].sort((a, b) =>
          a.fecha_uso < b.fecha_uso ? 1 : a.fecha_uso > b.fecha_uso ? -1 : 0
        );
        const toDeactivate = ordenadosDesc.slice(0, k);
        const ids = toDeactivate.map((r) => r.id_item);
        if (ids.length) {
          const placeholders = ids.map(() => "?").join(",");
          await exec("DEACTIVATE items", SQL_DEACTIVATE_BY_IDS(placeholders), [
            id_hospedaje,
            ...ids,
          ]);
        }
      };

      // ===== 0) Bloqueo por facturados =====
      const itemsActuales = await fetchItemsAsc();
      if (anyFacturado(itemsActuales)) {
        throw Object.assign(
          new Error("Edición no permitida: existen items facturados."),
          { http: 409 }
        );
      }

      // ===== 1) Parches HOSPEDAJES / BOOKINGS =====
      {
        const patchHosp = {
          id_hotel: get(hotel, "content.id_hotel"),
          nombre_hotel: get(hotel, "content.nombre_hotel"),
          tipo_cuarto: habitacion,
          codigo_reservacion_hotel: get(src, "codigo_reservacion_hotel"),
          noches: nochesTarget || null,
          comments: get(src, "comments"),
          nuevo_incluye_desayuno: get(src, "nuevo_incluye_desayuno"),
        };
        const pairs = Object.entries(patchHosp).filter(
          ([, v]) => v !== undefined && v !== null
        );
        if (pairs.length) {
          const fields = pairs.map(([k]) => `${k} = ?`);
          const vals = pairs.map(([, v]) => v);
          await exec("UPDATE hospedajes", SQL_UPDATE_HOSPEDAJES(fields), [
            ...vals,
            id_hospedaje,
          ]);
        }
      }
      {
        const setBk = [];
        const valsBk = [];
        if (checkInYmd) {
          setBk.push("check_in = ?");
          valsBk.push(`${checkInYmd} 00:00:00`);
        }
        if (checkOutYmd) {
          setBk.push("check_out = ?");
          valsBk.push(`${checkOutYmd} 00:00:00`);
        }
        if (estadoTarget) {
          setBk.push("estado = ?");
          valsBk.push(estadoTarget);
        }
        if (setBk.length)
          await exec("UPDATE bookings", SQL_UPDATE_BOOKINGS(setBk), [
            ...valsBk,
            id_booking,
          ]);
      }

      // ===== 2) Viajeros =====
      await actualizarViajerosHospedajeTx(
        id_hospedaje,
        viajeroPrincipal,
        acompanantes
      );

      // ===== 3) Diferencia de noches (DB vs target) =====
      const nochesExistentes = countNochesVigentes(itemsActuales); // lo que YA hay (estado=1, no ajuste)
      const nightsChanged =
        Number.isFinite(nochesTarget) &&
        nochesTarget > 0 &&
        nochesTarget !== nochesExistentes;

      // ===== 4) Calendario =====
      if (nightsChanged) {
        if (!checkInYmd) {
          throw Object.assign(
            new Error(
              "Para cambiar noches se requiere check_in en el payload."
            ),
            { http: 400 }
          );
        }

        if (nochesTarget < nochesExistentes) {
          // APAGAR (no borrar) exactamente la diferencia
          const k = Math.abs(nochesTarget - nochesExistentes);
          await deactivateLastK(k);
        } else {
          // CREAR exactamente la diferencia
          const k = Math.abs(nochesTarget - nochesExistentes);

          // Plantilla desde catálogo hotel o primer item activo existente
          let plantilla = moldePreferido;
          if (!plantilla) {
            const base = itemsActuales.find(
              (it) => Number(it.estado) === 1 && Number(it.is_ajuste) === 0
            );
            plantilla = base
              ? {
                  venta: {
                    total: Number(base.total),
                    subtotal: Number(base.subtotal),
                    impuestos: Number(base.impuestos),
                  },
                  costo: {
                    total: Number(base.costo_total),
                    subtotal: Number(base.costo_subtotal),
                    impuestos: Number(base.costo_impuestos),
                  },
                }
              : {
                  venta: { total: 0, subtotal: 0, impuestos: 0 },
                  costo: { total: 0, subtotal: 0, impuestos: 0 },
                };
          }

          // Fechas objetivo completas y filtrar las que faltan en DB
          const fechasFull = buildInclusiveDates(checkInYmd, nochesTarget);
          const existentesActivas = new Set(
            itemsActuales
              .filter(
                (it) => Number(it.estado) === 1 && Number(it.is_ajuste) === 0
              )
              .map((it) => toDateOnly(it.fecha_uso))
          );
          const fechasQueFaltan = fechasFull.filter(
            (f) => !existentesActivas.has(f)
          );
          const fechasNuevas = fechasQueFaltan.slice(-k); // solo la diferencia

          for (const f of fechasNuevas) {
            await insertItem({
              id_item: `ite-${uuidv4()}`,
              fecha_uso: f,
              venta: plantilla.venta,
              costo: plantilla.costo,
              is_ajuste: 0,
            });
          }
        }
      }

      // ===== 5) Ajuste por input (bandera) =====
      // - Solo creo ajuste si bandera ∈ {1,2} y delta>0 (incremento cubierto por wallet/crédito)
      // - Si delta<0 y bandera != 3, creo ajuste negativo (descuento) sin tocar pagos
      if (Number.isFinite(ventaTotalTarget) && ventaTotalTarget > 0) {
        const sums = await sumActivos(); // tras calendario
        const delta = r2(ventaTotalTarget - Number(sums.total || 0));

        const shouldCreatePositive =
          delta > 0.01 && (bandera === 1 || bandera === 2);
        const shouldCreateNegative = delta < -0.01 && bandera !== 3;

        if (shouldCreatePositive || shouldCreateNegative) {
          const { sub: adjSub, imp: adjImp } = breakdownByRates(delta, {
            ivaPct,
            ishPct,
            otrosPct,
            otrosMonto,
          });

          const fechaAjuste =
            checkOutYmd ||
            (checkInYmd
              ? addDays(checkInYmd, Math.max((nochesTarget || 1) - 1, 0))
              : toDateOnly(new Date().toISOString()));

          // Para crédito (bandera=2) y delta>0 => saldo=delta en el item
          const saldoOverride = bandera === 2 && delta > 0 ? delta : 0;

          const ajusteId = `ite-${uuidv4()}`;
          await insertItem({
            id_item: ajusteId,
            fecha_uso: fechaAjuste,
            venta: { total: delta, subtotal: adjSub, impuestos: adjImp },
            costo: { total: 0, subtotal: 0, impuestos: 0 },
            is_ajuste: 1,
            saldoOverride,
          });

          // Wallet (bandera=1) y delta>0: descargar saldos y vincular pago->item
          if (bandera === 1 && delta > 0.01) {
            const updatedSaldos = Array.isArray(body.updatedSaldos)
              ? body.updatedSaldos
              : [];
            for (const s of updatedSaldos) {
              const monto = Number(s.monto_cargado_al_item || 0);
              const id_saldos = s.id_saldos;
              if (id_saldos && monto > 0) {
                await exec("WALLET: update saldo", SQL_UPDATE_SALDO_WALLET, [
                  r2(monto),
                  id_saldos,
                ]);
              }
            }
            const id_pago_vinculo =
              get(src, "solicitud.id_pago") ||
              get(src, "solicitud.pagos_asociados.0.id_pago") ||
              null;
            if (id_pago_vinculo) {
              await exec("INSERT items_pagos", SQL_INSERT_ITEMS_PAGOS, [
                id_pago_vinculo,
                ajusteId,
                r2(Math.abs(delta)),
              ]);
            }
          }
        }
      }
      // bandera=3 => NO se crea ajuste aunque haya delta

      // ===== 6) Totales (solo items con estado=1) =====
      const sumsFinal = await sumActivos();

      // bookings
      {
        const fields = [
          "total = ?",
          "subtotal = ?",
          "impuestos = ?",
          "costo_total = ?",
          "costo_subtotal = ?",
          "costo_impuestos = ?",
          "estado = ?",
        ];
        const params = [
          r2(sumsFinal.total || 0),
          r2(sumsFinal.subtotal || 0),
          r2(sumsFinal.impuestos || 0),
          r2(sumsFinal.c_total || 0),
          r2(sumsFinal.c_subtotal || 0),
          r2(sumsFinal.c_impuestos || 0),
          estadoTarget || "Confirmada",
        ];
        await exec("UPDATE bookings(totales)", SQL_UPDATE_BOOKINGS(fields), [
          ...params,
          id_booking,
        ]);
      }

      // servicios (si consolidas)
      if (id_servicio) {
        await exec(
          "UPDATE servicios(totales)",
          `
          UPDATE servicios
             SET total = ?, subtotal = ?, impuestos = ?, updated_at = NOW()
           WHERE id_servicio = ?
        `.trim(),
          [
            r2(sumsFinal.total || 0),
            r2(sumsFinal.subtotal || 0),
            r2(sumsFinal.impuestos || 0),
            id_servicio,
          ]
        );
      }
    });

    return res.status(200).json({
      ok: true,
      message: "Reserva editada correctamente",
      id_booking: id || id_booking,
      planned,
    });
  } catch (err) {
    const http = err?.http || 500;
    return res.status(http).json({
      ok: false,
      message:
        http === 409
          ? "Edición no permitida: existen items facturados."
          : "Error al editar la reserva",
      detail: err?.message || String(err),
    });
  }
}

const createFromOperaciones = async (req, res) => {
  try {
    console.log("Revisando la bandera sesion", req.session);
    const { bandera } = req.body;
    const { check_in, check_out } = req.body;
    console.log(check_in, check_out);
    const parseMySQLDate = (dateStr) => {
      const [year, month, day] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, day);
    };

    const checkInDate = parseMySQLDate(check_in);
    const checkOutDate = parseMySQLDate(check_out);

    console.log("a ver esto,", checkInDate, checkOutDate);
    console.log(
      "REVISANDO FECHAS",
      checkOutDate.getTime() - checkInDate.getTime()
    );

    if (checkOutDate.getTime() < checkInDate.getTime()) {
      // return res.status(400).json({
      //   error: "La fecha de check-out no puede ser anterior a la fecha de check-in"
      // });
      throw new CustomError(
        "La fecha de check-out no puede ser anterior a la fecha de check-in",
        400,
        "INVALID_CHECKOUT_DATE"
      );
    }

    let response = await model.insertarReservaOperaciones(
      req.body,
      req.body.bandera
    );
    res
      .status(201)
      .json({ message: "Solicitud created successfully", data: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
      data: null,
    });
  }
};

const read = async (req, res) => {
  try {
    let response = await model.getReserva();
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const readById = async (req, res) => {
  try {
    let response = await model.getReservaById(req.query.id);
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const readOnlyById = async (req, res) => {
  try {
    let response = await model.getOnlyReservaByID(req.query.id);
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const readAll = async (req, res) => {
  try {
    let response = await model.getReservaAll();
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const readAllFacturacion = async (req, res) => {
  try {
    let response = await model.getReservaAllFacturacion();
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const getItemsFromBooking = async (req, res) => {
  try {
    const { id_hospedaje } = req.query;
    const response = await executeQuery(
      `select * from items where id_hospedaje = ?;`,
      [id_hospedaje]
    );
    res
      .status(200)
      .json({ message: "Items obtenidos con exito", data: response });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({
      message: error.message || "Error de servidor",
      error,
      data: null,
    });
  }
};
const actualizarPrecioVenta = async (req, res) => {
  try {
    const { items } = req.body;

    await runTransaction(async (connection) => {
      try {
        const query = `
          UPDATE items
          SET total = ?
          WHERE id_item = ?`;

        for (const item of items) {
          await connection.execute(query, [item.total, item.id_item]);
        }
      } catch (error) {
        throw new CustomError(
          "Error corriendo la transaction",
          500,
          "ERROR_RUN_TRANSACTION",
          error
        );
      }
    });

    res
      .status(200)
      .json({ message: "Items actualizados con exito", data: items });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({
      message: error.message || "Error de servidor",
      error,
      data: null,
    });
  }
};

const getReservasWithIAtemsByidAgente = async (req, res) => {
  console.log("ESTE ENDPOINT SOLO TRAE RESERVAS CON ITEMS SIN FACTURAR");
  const { id_agente } = req.query;
  console.log("id_agente", id_agente);
  try {
    const reservas = await executeSP("sp_reservas_con_items_by_id_agente", [
      id_agente,
    ]);
    if (!reservas) {
      return res.status(404).json({ message: "No se encontraron reservas" });
    } else {
      return res
        .status(200)
        .json({ message: "Reservas encontradas", data: reservas });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const getReservasWithItemsSinPagarByAgente = async (req, res) => {
  console.log("ESTE ENDPOINT SOLO TRAE RESERVAS CON ITEMS SIN PAGAR");
  const { id_agente } = req.query;
  try {
    const result = await executeSP("sp_get_items_sin_pagar_by_id_agente", [
      id_agente,
    ]);
    if (!result) {
      return res
        .status(404)
        .json({ message: "No se encontraron reservas con items sin pagar" });
    }
    return res.status(200).json({
      message: "Reservas con items sin pagar encontradas",
      data: result,
    });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getDetallesConexionReservas = async (req, res) => {
  const { id_agente, id_hospedaje } = req.query;
  try {
    const [facturas = [], pagos = []] = await executeSP2(
      "sp_get_detalles_conexion_reservas",
      [id_agente, id_hospedaje],
      { allSets: true }
    );
    // console.log(detalles);
    // if (!detalles || detalles.length === 0) {
    //   return res.status(404).json({ message: "No se encontraron detalles de conexión" });
    // }
    return res.status(200).json({
      message: "Detalles de conexión encontrados",
      data: {
        facturas: facturas,
        pagos: pagos,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor", details: error });
    console.error(error);
  }
};

module.exports = {
  create,
  read,
  readById,
  readAll,
  createFromOperaciones,
  readOnlyById,
  //updateReserva,
  readAllFacturacion,
  updateReserva2,
  updateReserva3,
  getItemsFromBooking,
  actualizarPrecioVenta,
  getReservasWithIAtemsByidAgente,
  getReservasWithItemsSinPagarByAgente,
  getDetallesConexionReservas,
};
