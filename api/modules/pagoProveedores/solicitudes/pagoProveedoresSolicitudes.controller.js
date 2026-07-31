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

module.exports = { getDispersion };
