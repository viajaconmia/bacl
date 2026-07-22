const facturasReservasService = require("./facturasReservas.service");

const getReservasPendientes = async (req, res) => {
  const { id_agente } = req.query;

  try {
    const data = await facturasReservasService.getPendientes(id_agente);

    return res.status(200).json({
      message: "Reservas pendientes de facturar obtenidas correctamente",
      data,
    });
  } catch (error) {
    console.error("Error en getReservasPendientes:", error);
    return res.status(error.statusCode ?? 500).json({
      error: "Error al obtener reservas pendientes de facturar",
      details: error.message || error,
    });
  }
};

module.exports = { getReservasPendientes };
