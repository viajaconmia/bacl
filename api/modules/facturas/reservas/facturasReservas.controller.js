const facturasReservasService = require("./facturasReservas.service");

const getReservasPendientes = async (req, res) => {
  const { id_agente, page, length } = req.query;

  try {
    const { rows, total, hasPagination } = await facturasReservasService.getPendientes({
      id_agente,
      page,
      length,
    });

    return res.status(200).json({
      message: "Reservas pendientes de facturar obtenidas correctamente",
      data: rows,
      metadata: hasPagination ? { total } : null,
    });
  } catch (error) {
    console.error("Error en getReservasPendientes:", error);
    return res.status(error.statusCode ?? 500).json({
      error: "Error al obtener reservas pendientes de facturar",
      details: error.message || error,
    });
  }
};

const getReporteAgente = async (req, res) => {
  const { id_agente, fecha_desde, fecha_hasta, page, length } = req.query;

  try {
    const { rows, total, hasPagination } = await facturasReservasService.getReporteAgente({
      id_agente,
      fecha_desde,
      fecha_hasta,
      page,
      length,
    });

    return res.status(200).json({
      message: "Facturas del agente obtenidas correctamente",
      data: rows,
      metadata: hasPagination ? { total } : null,
    });
  } catch (error) {
    console.error("Error en getReporteAgente:", error);
    return res.status(error.statusCode ?? 500).json({
      error: "Error al obtener el reporte de facturas del agente",
      details: error.message || error,
    });
  }
};

module.exports = { getReservasPendientes, getReporteAgente };
