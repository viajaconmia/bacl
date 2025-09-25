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

const updateReserva2 = async (req, res) => {
  console.log("Llegando al endpoint de updateReserva2");
  const { id } = req.query;

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
    metadata
  } = req.body;

  try {
    // 1) Generar id_item para cada ítem nuevo
    const itemsConIds = (items?.current || []).map((item) => ({
      ...item,
      id_item: item.id_item || `ite-${uuidv4()}`,
    }));

    // 2) Serializar JSON
    const itemsJson = JSON.stringify(itemsConIds);
    const impuestosJson = JSON.stringify(impuestos?.current || []);

    // 3) Array de **20** parámetros para el SP
    const params = [
      id,                                           // 1) p_id_booking
      viajero?.current?.id_viajero ?? null,         // 2) p_id_viajero
      check_in?.current ?? null,                    // 3) p_check_in
      check_out?.current ?? null,                   // 4) p_check_out
      // venta?.current?.total ?? null,             // 5) p_total (si tu SP lo pide, descomenta 5-7 y ajusta placeholders)
      // venta?.current?.subtotal ?? null,          // 6) p_subtotal
      // venta?.current?.impuestos ?? null,         // 7) p_impuestos
      estado_reserva?.current ?? null,              // 8) p_estado_reserva
      proveedor?.current?.total ?? null,            // 9) p_costo_total
      proveedor?.current?.subtotal ?? null,         // 10) p_costo_subtotal
      proveedor?.current?.impuestos ?? null,        // 11) p_costo_impuestos
      hotel?.current?.content?.nombre_hotel ?? null,// 12) p_nombre_hotel
      hotel?.current?.content?.id_hotel ?? null,    // 13) p_id_hotel
      codigo_reservacion_hotel?.current ?? null,    // 14) p_codigo_reservacion_hotel
      habitacion?.current ?? null,                  // 15) p_tipo_cuarto
      noches?.current ?? null,                      // 16) p_noches
      comments?.current ?? null,                    // 17) p_comments
      itemsJson,                                    // 18) p_items_json
      impuestosJson,                                // 19) p_impuestos_json
      nuevo_incluye_desayuno ?? null                // 20) p_nuevo_incluye_desayuno
    ];

    // Prepara acompañantes
    const idHosp = metadata?.id_hospedaje;
    if (!idHosp) {
      return res.status(400).json({ error: "metadata.id_hospedaje es requerido" });
    }
    const idViajeroPrincipal =
      viajero?.current?.id_viajero ??
      metadata?.id_viajero_reserva ??
      null;

    const acompList = Array.isArray(acompanantes) ? acompanantes : [];
    const acompFiltrados = acompList
      .map(a => a?.id_viajero)
      .filter(idv => idv && idv !== idViajeroPrincipal);

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
        const paramsIns = acompFiltrados.flatMap(idv => [idv, idHosp]);

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
        tx: result
      }
    });

  } catch (error) {
    console.error("Error en updateReserva2:", error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const createFromOperaciones = async (req, res) => {

try {
  console.log("Revisando el body  😭😭😭😭", req.body);
  const {bandera } = req.body;
  const { check_in, check_out } = req.body;
  console.log(check_in,check_out)
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

    let response = await model.insertarReservaOperaciones(req.body, req.body.bandera);
    res
      .status(201)
      .json({ message: "Solicitud created successfully", data: response });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
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
    const reservas = await executeSP(
      "sp_reservas_con_items_by_id_agente",
      [id_agente]
    );
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

const getDetallesConexionReservas = async (req,res) => {
  const {id_agente, id_hospedaje}= req.query;
  try {
   const [facturas = [], pagos = []]= await executeSP2("sp_get_detalles_conexion_reservas", [id_agente, id_hospedaje], { allSets: true });
    // console.log(detalles);
    // if (!detalles || detalles.length === 0) {
    //   return res.status(404).json({ message: "No se encontraron detalles de conexión" });
   // }
    return res.status(200).json({ message: "Detalles de conexión encontrados", data: {
      facturas: facturas,
      pagos: pagos
    } });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor", details: error });
    console.error(error);
  }
  
}

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
  getDetallesConexionReservas
};
