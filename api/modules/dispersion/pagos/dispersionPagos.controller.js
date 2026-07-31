const { runTransaction } = require("../../../../config/db");
const dispersionPagosService = require("./dispersionPagos.service");

const create = async (req, res) => {
  try {
    const result = await runTransaction((conn) =>
      dispersionPagosService.crearPagosDesdeDispersion(req.body, conn),
    );

    return res.status(201).json({
      data: result,
      metadata: null,
      message: "Pagos creados correctamente",
    });
  } catch (error) {
    console.error("Error en dispersionPagos.create:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message,
      details: error.details,
    });
  }
};

module.exports = { create };
