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

const editarFactura = async (req, res) => {
  const { id_factura_proveedor } = req.query;
  const { propina, impsan } = req.body;
  try {
    const data = await runTransaction((conn) =>
      service.editarFactura(id_factura_proveedor, { propina, impsan }, conn),
    );
    return res.status(200).json({
      message: "Factura actualizada correctamente",
      data,
      metadata: null,
    });
  } catch (error) {
    console.error("Error en editarFactura:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message || "Error al actualizar la factura",
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

const editarPagoFactura = async (req, res) => {
  const { id_factura, id_solicitud } = req.query;
  const { monto_facturado, monto_propina, monto_impsan } = req.body;
  try {
    const data = await runTransaction((conn) =>
      service.editarPagoFactura(
        id_factura,
        id_solicitud,
        { monto_facturado, monto_propina, monto_impsan },
        conn,
      ),
    );
    return res.status(200).json({
      message: "Registro actualizado correctamente",
      data,
      metadata: null,
    });
  } catch (error) {
    console.error("Error en editarPagoFactura:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message || "Error al actualizar el registro",
      details: error.details ?? error.message ?? error,
    });
  }
};

module.exports = {
  buscarFactura,
  editarFactura,
  buscarSolicitudes,
  eliminarPagoFactura,
  editarPagoFactura,
};
