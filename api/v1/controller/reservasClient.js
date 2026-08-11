const { error } = require("winston");
const { executeSP, executeQuery } = require("../../../config/db");
const { CustomError } = require("../../../middleware/errorHandler");

const get_reservasClient_by_id_agente = async (req, res) => {
  try {
    req.context.logStep(
      "Llegando al endpoint de get_reservasClient_by_id_agente",
    );
    const { user_id, usuario_creador } = req.query;
    console.log("user_id recibido:", user_id);
    if (!user_id) {
      throw new CustomError(
        "Falta el parametro user_id",
        400,
        "ERROR_MISSING_PARAMETER",
        null,
      );
    }
    let result = await executeSP("sp_get_reservasClient_by_id_cliente", [
      user_id,
    ]);

    const [{ restringido }] = await executeQuery(
      `select restringido from agentes where id_agente = ?`,
      [user_id],
    );

    if (Boolean(restringido) && usuario_creador) {
      result = result.filter((item) => item.usuario_creador == usuario_creador);
    }

    res.status(200).json({
      message: "Reservas obtenidas correctamente",
      data: result,
    });
  } catch (error) {
    req.context.logStep("Error en la ejecucion del SP", error);
    console.error(error);
    res.status(error.statusCode || 500).json({
      error: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "Error interno del servidor",
      data: null,
    });
  }
};

const filtro_solicitudes_y_reservas = async (req, res) => {
  console.log("", req.query, req.params);
  req.context.logStep("Llegando al endpoint de filtro_solicitudes_y_reservas");

  // Recibe los filtros con nombres del frontend
  const {
    codigo_reservacion,
    client,
    reservante,
    reservationStage,
    hotel,
    status,
    startDate,
    endDate,
    traveler,
    paymentMethod,
    id_client,
    //statusPagoProveedor,
    filterType,
    //markup_end,
    //markup_start,
    id_solicitud,
  } = req.body;
  const status_dic = {
    Confirmada: "Confirmada",
    Pendiente: "En Proceso",
    Cancelada: "Cancelada",
    Todos: null,
  };

  const { p_criterio } = req.query;
  console.log("recuperando criterio", p_criterio);

  try {
    const result = await executeSP("sp_filtrar_solicitudes_y_reservas2", [
      codigo_reservacion || null,
      startDate || null,
      endDate || null,
      hotel || null,
      id_client || null,
      client || null,
      traveler || null,

      reservationStage || null,
      status_dic[status] || null,
      reservante || null,
      paymentMethod || null,

      //statusPagoProveedor,
      filterType || null,
      // status_pago_proveedor,
      // markup_start,
      // markup_end,
      p_criterio || 1,
      id_solicitud || null,
    ]);

    req.context.logStep("parametros enviados al SP", {
      codigo_reservacion,
      client,
      reservante,
      reservationStage,
      hotel,
      status,
      startDate,
      endDate,
      traveler,
      paymentMethod,
      id_client,
      //statusPagoProveedor,
      filterType,
    });
    if (!result || result.length === 0) {
      req.context.logStep("Result vacio");
      return res.status(200).json({
        message: "No se encontraron resultados para los filtros proporcionados",
        data: [],
      });
    } else {
      res.status(200).json({
        message: "Resultados obtenidos correctamente",
        data: result,
      });
    }
  } catch (error) {
    req.context.logStep("Error en la ejecucion del SP", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
    console.error("Error en filtro_solicitudes_y_reservas:", error);
  }
};
/*
const edicion_filtro = async (req, res) => {
  const { id } = req.query;

  try {
    const result = await executeSP("sp_filtrar_solicitudes_y_reservas2", [
      codigo_reservacion || null,
      startDate || null,
      endDate || null,
      hotel || null,
      id_client || null,
      client || null,
      traveler || null,

      reservationStage || null,
      status_dic[status] || null,
      reservante || null,
      paymentMethod || null,

      //statusPagoProveedor,
      filterType || null,
      // status_pago_proveedor,
      // markup_start,
      // markup_end,
      p_criterio || 1,
      id_solicitud || null,
    ]);

    if (!result || result.length === 0) {
      return res.status(200).json({
        message: "No se encontraron resultados para los filtros proporcionados",
        data: [],
      });
    } else {
      res.status(200).json({
        message: "Resultados obtenidos correctamente",
        data: result,
      });
    }
  } catch (error) {
    req.context.logStep("Error en la ejecucion del SP", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
    console.error("Error en filtro_solicitudes_y_reservas:", error);
  }
};*/
const get_all_facturas = async (req, res) => {
  try {
    req.context.logStep("Llegando al endpoint de sp_get_reservas_filtradas");

    // 1. Extracción segura de parámetros
    // Nota: Verifica si id_client viene como objeto o si user_id está directo en req.body
    const user_id = req.body.id_client?.user_id || req.body.user_id;
    const tipo_reserva = req.body.tipo;

    // Variables para el filtrado posterior (deben venir del request o definir valores por defecto)
    const restringido = req.body.restringido || false;
    const usuario_creador = req.body.usuario_creador;

    console.log("user_id recibido:", user_id);

    // 2. Validación de parámetros obligatorios
    if (!user_id) {
      throw new CustomError(
        "Falta el parámetro user_id",
        400,
        "ERROR_MISSING_PARAMETER",
        null,
      );
    }

    // 3. Ejecución del SP
    // Asegúrate de que executeSP devuelva directamente el array de resultados
    let result = await executeSP("sp_get_reservas_filtradas", [
      user_id,
      tipo_reserva,
      "confirmada",
    ]);

    // 4. Filtrado lógico en el Backend (si es necesario)
    if (restringido && usuario_creador) {
      result = result.filter(
        (item) => item.usuario_creador === usuario_creador,
      );
    }

    // 5. Respuesta exitosa
    return res.status(200).json({
      status: "success",
      message: "Reservas obtenidas correctamente",
      data: result,
    });
  } catch (error) {
    req.context.logStep("Error en la ejecución del SP", error);
    console.error("Detalle del error:", error);

    // 6. Manejo de errores centralizado
    return res.status(error.statusCode || 500).json({
      error: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "Error interno del servidor",
      data: null,
    });
  }
};

const get_hotel_edicion = async (req, res) => {
  try {
    const { id_booking } = req.query;

    if (!id_booking) {
      return res.status(400).json({
        message: "Falta el parámetro id_booking",
        data: null,
      });
    }

    const hospedajeRows = await executeQuery(
      `
      SELECT
        h.id_hospedaje,
        h.id_hospedaje AS id_relacion,
        h.id_hotel,
        h.nombre_hotel AS hotel_reserva,
        h.codigo_reservacion_hotel,
        h.tipo_cuarto,
        h.tipo_cuarto AS room,
        h.comments,
        h.nuevo_incluye_desayuno,
        h.id_intermediario,
        h.is_con_desayuno
      FROM hospedajes h
      WHERE h.id_booking =
        CAST(? AS CHAR CHARACTER SET utf8mb3) COLLATE utf8mb3_general_ci
      LIMIT 1;
      `,
      [id_booking],
    );

    if (!hospedajeRows || hospedajeRows.length === 0) {
      return res.status(404).json({
        message: "No se encontró hospedaje para este booking",
        data: null,
      });
    }

    const hospedaje = hospedajeRows[0];

    const bookingRows = await executeQuery(
      `
      SELECT
        b.id_booking,
        b.id_servicio,
        b.check_in,
        b.check_out,
        b.estado AS status_reserva,
        b.estado,
        b.total,
        b.subtotal,
        b.impuestos,
        b.costo_total,
        b.costo_subtotal,
        b.costo_impuestos,
        b.comentarios_internos,
        b.tipo_pago AS metodo_pago_dinamico,
        b.id_solicitud,
        b.usuario_creador,
        b.is_comisionable,
        b.monto_comisionable,
        b.porcentaje_comisionable,
        b.comentarios_comisionables

      FROM bookings b
      WHERE b.id_booking =
        CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
      LIMIT 1;
      `,
      [id_booking],
    );

    if (!bookingRows || bookingRows.length === 0) {
      return res.status(404).json({
        message: "No se encontró booking",
        data: null,
      });
    }

    const booking = bookingRows[0];

    const servicioRows = await executeQuery(
      `
      SELECT
        s.id_agente
      FROM servicios s
      WHERE s.id_servicio = ?
      LIMIT 1;
      `,
      [booking.id_servicio],
    );

    const viajerosRows = await executeQuery(
      `
      SELECT
        MAX(CASE WHEN vh.is_principal = 1 THEN vh.id_viajero END) AS id_viajero_reserva,
        GROUP_CONCAT(CASE WHEN vh.is_principal = 0 THEN vh.id_viajero END) AS viajeros_adicionales_reserva
      FROM viajeros_hospedajes vh
      WHERE vh.id_hospedaje =
        CAST(? AS CHAR CHARACTER SET utf8mb3) COLLATE utf8mb3_general_ci;
      `,
      [hospedaje.id_hospedaje],
    );

    const servicio = servicioRows?.[0] || {};
    const viajeros = viajerosRows?.[0] || {};

    return res.status(200).json({
      message: "Detalle de hotel obtenido correctamente",
      data: {
        ...booking,
        ...hospedaje,

        id_booking: booking.id_booking,
        id_hospedaje: hospedaje.id_hospedaje,
        id_relacion: hospedaje.id_hospedaje,

        id_agente: servicio.id_agente || null,
        nombre_agente: null,

        id_viajero_reserva: viajeros.id_viajero_reserva || null,
        viajeros_adicionales_reserva:
          viajeros.viajeros_adicionales_reserva || "",

        nombre_viajero_reservacion: null,
        viajeros_acompañantes: null,
      },
    });
  } catch (error) {
    console.error("Error en get_hotel_edicion:", error);
    return res.status(500).json({
      message: error.message || "Error interno del servidor",
      data: null,
      error,
    });
  }
};

module.exports = {
  get_reservasClient_by_id_agente,
  filtro_solicitudes_y_reservas, //REPETIDO POR EMERGENCIA
  get_all_facturas,
  get_hotel_edicion,
};
