const { runTransaction, setAuditUser } = require("../../../../config/db");
const service = require("./pagoProveedoresSolicitudes.service");

const getDispersion = async (req, res) => {
  const { ids } = req.body;
  try {
    const data = await service.getDispersion(ids);
    return res.status(200).json({ data, metadata: null, message: "Solicitudes obtenidas correctamente" });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

const editar = async (req, res) => {
  const { id_solicitud_proveedor } = req.query;
  const { user } = req.session;
  try {
    const data = await runTransaction(async (conn) => {
      await setAuditUser(conn, user);
      return service.editar(id_solicitud_proveedor, req.body, user, conn);
    });
    return res.status(200).json({
      data,
      metadata: null,
      message: "Solicitud actualizada correctamente",
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

module.exports = { getDispersion, editar };
