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

    // 3) Construir array de 19 parámetros para el SP
    const params = [
      id, // 1) p_id_booking
      viajero?.current?.id_viajero ?? null, // 2) p_id_viajero
      check_in?.current ?? null, // 3) p_check_in
      check_out?.current ?? null, // 4) p_check_out
      // venta?.current?.total ?? null, // 5) p_total
      // venta?.current?.subtotal ?? null, // 6) p_subtotal
      // venta?.current?.impuestos ?? null, // 7) p_impuestos
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

    // 5) Verificar resultado
    // dependiendo de tu helper, puede que sea result.affectedRows o result[0].affectedRows
    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No se encontró la reserva" });
    }

    // 6) Responder con los nuevos IDs de items
    return res.status(200).json({
      message: "Reserva actualizada correctamente",
      data: {
        id_booking: id,
        items: itemsConIds,
        impuestos: impuestos?.current || [],
        rawResult: result,
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

const updateReserva2 = async (req, res) => {
  console.log("Llegando al endpoint de updateReserva2");
  const { id } = req.query;
  const { metadata } = req.body;

  const {
    viajero,
    check_in,
    check_out,
    estado_reserva,
    proveedor,
    hotel,
    codigo_reservacion_hotel,
    habitacion,
    noches,
    comments,
    items,
    impuestos,
  } = req.body;

  console.log("id booking:", id);
  console.log("Revisando el body ⚠️", JSON.stringify(req.body, null, 2));

  // Helper de logging
  const planned = [];
  const logExec = (type, sql, params) => {
    planned.push({ type, sql, params });
    console.log(`\n[EXEC] ${type}\nSQL:\n${sql}\nPARAMS:`);
    console.dir(params, { depth: null });
  };

  // Asegurar ids en items entrantes (plantilla para inserts)
  const itemsConIds = (items?.current || []).map((item) => ({
    ...item,
    id_item: item.id_item || `ite-${uuidv4()}`,
  }));

  // JSON para SP
  const itemsJson = JSON.stringify(itemsConIds);
  const impuestosJson = JSON.stringify(impuestos?.current || []);

  // Parámetros del SP (19, manteniendo los comentados fuera)
  const spParams = [
    id, // 1) p_id_booking
    viajero?.current?.id_viajero ?? null, // 2) p_id_viajero
    check_in?.current ?? null, // 3) p_check_in
    check_out?.current ?? null, // 4) p_check_out
    // venta?.current?.total ?? null, // 5) p_total
    // venta?.current?.subtotal ?? null, // 6) p_subtotal
    // venta?.current?.impuestos ?? null, // 7) p_impuestos
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
  ];

  const nochesBefore = noches?.before || 0;
  const nochesActual = noches?.current || 0;

  const sqlInsertItem = `
    INSERT INTO items (
      id_item, total, subtotal, impuestos, is_facturado, fecha_uso, id_hospedaje,
      costo_total, costo_subtotal, costo_impuestos, saldo, costo_iva, is_ajuste
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `.trim();

  try {
    await runTransaction(async (connection) => {
      // (A) Si aumentan noches → insertar nuevos items clonando del primero
      if (nochesActual > nochesBefore) {
        const itemTemplate = itemsConIds[0];
        if (!itemTemplate) {
          console.warn(
            "No hay item template disponible para crear nuevas noches."
          );
        } else {
          const cantidad = nochesActual - nochesBefore;
          for (let i = 0; i < cantidad; i++) {
            const nuevoItem = {
              ...itemTemplate,
              id_item: `ite-${uuidv4()}`,
            };

            const ivaCosto =
              (nuevoItem.impuestos || []).find(
                (x) => (x.name || "").toLowerCase() === "iva"
              )?.total || 0;

            const paramsInsert = [
              nuevoItem.id_item,
              nuevoItem.venta.total,
              nuevoItem.venta.subtotal,
              nuevoItem.venta.impuestos,
              0, // is_facturado
              new Date(), // fecha_uso
              metadata.id_hospedaje,
              nuevoItem.costo.total,
              nuevoItem.costo.subtotal,
              nuevoItem.costo.impuestos,
              metadata.id_credito != null ? nuevoItem.venta.total : 0, // saldo
              ivaCosto, // costo_iva
              0, // is_ajuste
            ];

            logExec("INSERT items (+noche)", sqlInsertItem, paramsInsert);
            // await connection.execute(sqlInsertItem, paramsInsert);
          }
        }
      }

      // (B) Si reducen noches → desactivar los más recientes (LIFO)
      if (nochesActual < nochesBefore) {
        const itemsADesactivar = Math.max(0, (nochesBefore - nochesActual) | 0);

        if (itemsADesactivar > 0) {
          // 👇 Sanitiza el límite como entero literal (sin placeholder)
          const limit =
            Number.isFinite(itemsADesactivar) && itemsADesactivar > 0
              ? Math.floor(itemsADesactivar)
              : 0; // LIMIT 0 devuelve 0 filas (seguro)

          // 1) Seleccionar ids más recientes (sin `?` en LIMIT)
          const sqlSelectIds = `
      SELECT id_item
      FROM items
      WHERE id_hospedaje = ?
        AND estado = 1
      ORDER BY created_at DESC
      LIMIT ${limit}
    `.trim();

          const selectParams = [metadata.id_hospedaje];
          console.log(
            "[EXEC] SELECT ids LIFO para desactivar\nSQL:\n",
            sqlSelectIds,
            "\nPARAMS:\n",
            selectParams
          );
          const [rows] = await connection.execute(sqlSelectIds, selectParams);
          const ids = rows.map((r) => r.id_item);

          // 2) UPDATE por IN (...)
          if (ids.length > 0) {
            const placeholders = ids.map(() => "?").join(",");
            const sqlUpdate = `
        UPDATE items
        SET estado = 0
        WHERE id_item IN (${placeholders})
      `.trim();

            console.log(
              "[EXEC] UPDATE items (desactivar LIFO)\nSQL:\n",
              sqlUpdate,
              "\nPARAMS:\n",
              ids
            );
            // await connection.execute(sqlUpdate, ids);
          } else {
            console.warn("No se encontraron items activos para desactivar.");
          }
        }
      }

      // (C) Llamar al SP
      const spName = "sp_editar_reserva_procesada";
      const spPlaceholders = Array(spParams.length).fill("?").join(",");
      const sqlCall = `CALL ${spName}(${spPlaceholders})`;

      logExec(`CALL ${spName}`, sqlCall, spParams);
      // await connection.query(sqlCall, spParams); // query() se lleva mejor con CALL y múltiples resultsets
    });

    // Si todo fue bien, responde OK
    return res.status(200).json({
      message: "Reserva actualizada correctamente",
      data: {
        id_booking: id,
        items: itemsConIds,
        impuestos: impuestos?.current || [],
        planned,
        meta: { nochesBefore, nochesActual },
      },
    });
  } catch (error) {
    console.error("Error en updateReserva2 (runTransaction):", error);
    return res
      .status(error.statusCode || 500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const updateReserva3 = async (req, res) => {
  // update de campos generales
  // para ello vamos a mapear los campos por tabla
  /* TABLA HOSPEDAJES 
id_hotel, nombre_hotel, tipo_cuarto,codigo_reservacion_hotel,noches,comments,nuevo_incluye_desayuno,
*/
  const query_update_hospedajes = `update hospedajes set id_hotel=?, nombre_hotel=?, tipo_cuarto=?, codigo_reservacion_hotel=?, noches=?, comments=?, nuevo_incluye_desayuno=? where id_hospedaje = ?`;
  await executeQuery(query_update_hospedajes, [
    req.body.hotel.current.content.id_hotel,
    req.body.hotel.current.content.nombre_hotel,
    req.body.habitacion.current,
    req.body.codigo_reservacion_hotel.current,
    req.body.noches.current,
    req.body.comments.current,
    req.body.nuevo_incluye_desayuno.current,
    req.body.metadata.id_hospedaje,
  ]);
  /*TABLA BOOKINGS*/
  const query_update_bookings = `UPDATE bookings
SET
    check_in = ?,
    check_out = ?,
    ${
      /*total = ?,
    subtotal = ?,
    impuestos = ?,*/
      ""
    }
    estado = ?,
    costo_total = ?,
    costo_subtotal = ?,
    costo_impuestos = ?,
WHERE id_booking = ?;`;
  const costos = calcularPrecios(req.body.proveedor.current.total);
  await executeQuery(query_update_hospedajes, [
    req.body.check_in.current,
    req.body.check_out.current,
    req.body.estado_reserva.current,
    req.body.proveedor.current.total,
    costos.total,
    costos.subtotal,
    costos.impuestos,
    req.body.metadata.id_booking,
  ]);

  const { metadata } = req.body;

  if (!metadata.id_credito) {
  }
};

const createFromOperaciones = async (req, res) => {
  try {
    console.log("Revisando el body  😭😭😭😭", req.body);
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
  getItemsFromBooking,
  actualizarPrecioVenta,
  getReservasWithIAtemsByidAgente,
  getReservasWithItemsSinPagarByAgente,
  getDetallesConexionReservas,
};
