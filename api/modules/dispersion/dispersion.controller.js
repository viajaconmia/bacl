const { runTransaction } = require("../../../config/db");
const dispersionService = require("./dispersion.service");

const create = async (req, res) => {
  try {
    const result = await runTransaction((conn) => dispersionService.createDispersion(req.body, conn));
    const correo_enviado = await dispersionService.notifyDispersionCreated(result);

    return res.status(200).json({
      data: { ...result, correo_enviado },
      metadata: null,
      message: "Dispersión creada y registros guardados correctamente",
    });
  } catch (error) {
    console.error("Error en dispersion.create:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message,
      details: error.details,
    });
  }
};

module.exports = { create };
