const { runTransaction } = require("../../../../config/db");
const service = require("./pagoProveedoresFacturas.service");

const buscarFactura = async (req, res) => {
  const { uuid_factura } = req.query;
  try {
    const data = await service.buscarFacturaPorUuid(uuid_factura);
    return res.status(200).json({
      message: "Factura obtenida correctamente",
      data,
      metadata: null,
    });
  } catch (error) {
    console.error("Error en buscarFactura:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message || "Error al buscar la factura por uuid",
      details: error.details ?? error.message ?? error,
    });
  }
};

const buscarSolicitudes = async (req, res) => {
  const { uuid_factura } = req.query;
  try {
    const data = await service.buscarSolicitudesPorUuid(uuid_factura);
    return res.status(200).json({
      message: "Solicitudes encontradas correctamente",
      data,
      metadata: null,
    });
  } catch (error) {
    console.error("Error en buscarSolicitudes:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message || "Error al buscar solicitudes por uuid_factura",
      details: error.details ?? error.message ?? error,
    });
  }
};

const eliminarPagoFactura = async (req, res) => {
  const { id_factura, id_solicitud } = req.query;
  try {
    const data = await runTransaction((conn) =>
      service.eliminarPagoFactura(id_factura, id_solicitud, conn),
    );
    return res.status(200).json({
      message: "Registro eliminado correctamente",
      data,
      metadata: null,
    });
  } catch (error) {
    console.error("Error en eliminarPagoFactura:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message || "Error al eliminar el registro",
      details: error.details ?? error.message ?? error,
    });
  }
};

module.exports = { buscarFactura, buscarSolicitudes, eliminarPagoFactura };
