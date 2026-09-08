const { runTransaction, setAuditUser } = require("../../../config/db");
const service = require("./reservas.service");

const editar = async (req, res) => {
  const { id_booking } = req.params;
  const { user } = req.session;
  try {
    const data = await runTransaction(async (conn) => {
      await setAuditUser(conn, user);
      return service.editarCamposGenerales(id_booking, req.body, conn);
    });
    return res.status(200).json({
      message: "Booking actualizado correctamente",
      data,
      metadata: null,
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

module.exports = { editar };
