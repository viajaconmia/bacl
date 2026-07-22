const { runTransaction } = require("../../../config/db");
const facturasService = require("./facturas.service");
const facturasReservasService = require("./reservas/facturasReservas.service");
const facturasSaldosService = require("./saldos/facturasSaldos.service");
const facturasPagosService = require("./pagos/facturasPagos.service");

const filtrar = async (req, res) => {
  const {
    estatusFactura,
    id_factura,
    id_cliente,
    cliente,
    uuid,
    rfc,
    page = null,
    length = null,
    startDate = null,
    endDate = null,
  } = req.body;

  try {
    const { rows, total, hasPagination } = await facturasService.getAll({
      estatusFactura,
      id_factura,
      id_cliente,
      cliente,
      uuid,
      rfc,
      page,
      length,
      startDate,
      endDate,
    });

    if (rows.length === 0) {
      return res.status(404).json({ message: "No se encontraron facturas con el parametro deseado" });
    }

    return res.status(200).json({
      message: "Facturas filtradas correctamente",
      data: rows,
      metadata: hasPagination ? { total } : null,
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      error: "Error al filtrar facturas",
      details: error.message || error,
    });
  }
};

const detalle = async (req, res) => {
  const { id_factura } = req.query;

  if (!id_factura) {
    return res.status(400).json({ message: "id_factura es requerido" });
  }

  try {
    const { reservas, saldos, pagos } = await runTransaction(async (conn) => {
      const [reservas, saldos, pagos] = await Promise.all([
        facturasReservasService.getReservasByFactura(id_factura, conn),
        facturasSaldosService.getSaldosByFactura(id_factura, conn),
        facturasPagosService.getPagosByFactura(id_factura, conn),
      ]);
      return { reservas, saldos, pagos };
    });

    return res.status(200).json({
      message: "Detalle de factura obtenido correctamente",
      data: { reservas, saldos, pagos },
    });
  } catch (error) {
    console.error("Error en detalle:", error);
    return res.status(error.statusCode ?? 500).json({
      error: "Error al obtener detalle de factura",
      details: error.message || error,
    });
  }
};

module.exports = { filtrar, detalle };
