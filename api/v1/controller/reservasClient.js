const { error } = require("winston");
const { executeSP } = require("../../../config/db");
const { CustomError } = require("../../../middleware/errorHandler");

const get_reservasClient_by_id_agente = async (req, res) => {
  try {
    req.context.logStep(
      "Llegando al endpoint de get_reservasClient_by_id_agente"
    );
    const { user_id } = req.query;
    if (!user_id) {
      throw new CustomError(
        "Falta el parametro user_id",
        400,
        "ERROR_MISSING_PARAMETER",
        null
      );
    }
    const result = await executeSP("sp_get_reservasClient_by_id_cliente", [
      user_id,
    ]);
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

module.exports = {
  get_reservasClient_by_id_agente,
  filtro_solicitudes_y_reservas, //REPETIDO POR EMERGENCIA
};
