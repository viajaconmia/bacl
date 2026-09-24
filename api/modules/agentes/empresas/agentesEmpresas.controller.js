const service = require("./agentesEmpresas.service");

const fiscales = async (req, res) => {
  const { id_agente } = req.query;
  try {
    const data = await service.getDatosFiscalesByAgente(id_agente);
    return res.status(200).json({ message: "", data });
  } catch (error) {
    console.error("Error en fiscales (agentesEmpresas):", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message || "Error al obtener los datos fiscales del agente",
    });
  }
};

module.exports = { fiscales };
