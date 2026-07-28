const service = require("./reservasSolicitudes.service");

const getPendientes = async (req, res) => {
  try {
    const rows = await service.getPendientes();
    return res
      .status(200)
      .json({
        data: rows,
        metadata: null,
        message: "Reservas obtenidas correctamente",
      });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

module.exports = { getPendientes };
