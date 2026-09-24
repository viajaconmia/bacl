const service = require("./facturasPagos.service");

const prepagoFacturables = async (req, res) => {
  try {
    const data = await service.getPrepagoFacturables();
    return res.status(200).json({
      message: "Pagos de prepago facturables obtenidos correctamente",
      data,
    });
  } catch (error) {
    console.error("Error en prepagoFacturables (facturasPagos):", error);
    return res.status(error.statusCode ?? 500).json({
      error:
        error.message || "Error al obtener los pagos de prepago facturables",
    });
  }
};

const balance = async (req, res) => {
  try {
    const rows = await service.getBalancePagosFacturas();
    return res.status(200).json({
      message: "Balance de pagos y facturas obtenido correctamente",
      data: rows[0] ?? null,
    });
  } catch (error) {
    console.error("Error en balance (facturasPagos):", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message || "Error al obtener el balance de pagos y facturas",
    });
  }
};

module.exports = { prepagoFacturables, balance };
