const { runTransaction, setAuditUser } = require("../../../../config/db");
const service = require("./reservasComisionables.service");

const listar = async (req, res) => {
  const {
    page,
    length,
    proveedor,
    id_intermediario,
    comision_cobrada,
    comentarios_comisionables,
    estado,
    codigo_confirmacion,
  } = req.query;
  try {
    const { rows, total, hasPagination } = await service.getAll({
      page,
      length,
      proveedor,
      id_intermediario,
      comision_cobrada,
      comentarios_comisionables,
      estado,
      codigo_confirmacion,
    });
    return res.status(200).json({
      message: "Comisionables obtenidos correctamente",
      data: rows,
      metadata: hasPagination ? { total } : null,
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

const cobrar = async (req, res) => {
  const { id_booking } = req.params;
  try {
    const data = await service.marcarComisionCobrada(id_booking);
    return res.status(200).json({
      message: "Comisión marcada como cobrada",
      data,
      metadata: null,
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

const editarComisionables = async (req, res) => {
  const { id_booking } = req.params;
  const { user } = req.session;
  try {
    const data = await runTransaction(async (conn) => {
      await setAuditUser(conn, user);
      return service.editarCamposComisionables(id_booking, req.body, conn);
    });
    return res.status(200).json({
      message: "Campos comisionables actualizados correctamente",
      data,
      metadata: null,
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

module.exports = { listar, cobrar, editarComisionables };
