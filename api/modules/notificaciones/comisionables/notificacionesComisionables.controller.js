const service = require("./notificacionesComisionables.service");

const conteo = async (req, res) => {
  try {
    const total = await service.getConteo();
    return res.status(200).json({ message: "ok", data: { conteo: total } });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

module.exports = { conteo };
