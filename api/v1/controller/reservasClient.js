const { executeSP } = require("../../../config/db");

const get_reservasClient_by_id_agente = async (req, res) => {
  try {
    req.context.logStep('Llegando al endpoint de get_reservasClient_by_id_agente');
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: "Falta el parametro user_id" });
    }
    const result = await executeSP("sp_get_reservasClient_by_id_cliente", [user_id]);
    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No se encontraron reservas" });
    }
    res.status(200).json({
      message: "Reservas obtenidas correctamente",
      data: result,
    });
  } catch (error) {
    req.context.logStep('Error en la ejecucion del SP', error);
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
}

const filtro_solicitudes_y_reservas = async (req, res) => {
  req.context.logStep("Llegando al endpoint de filtro_solicitudes_y_reservas");

  // Recibe los filtros con nombres del frontend
  const{
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
 const status_dic ={
    "Confirmada" : "Confirmada",
     "Pendiente" : "En Proceso",
      "Cancelada": "Cancelada", 
       "Todos":  null
 }




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
  status_dic[status] || null ,
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
      return res
        .status(404)
        .json({
          message: "No se encontraron resultados para los filtros proporcionados",
          data: []
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
}