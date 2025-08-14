const { executeQuery } = require("../../../config/db");
const { CustomError } = require("../../../middleware/errorHandler");

const getCartItemsById = async (req, res) => {
  try {
    const { id_agente, id_viajero } = req.query;
    if (!id_agente && !id_viajero)
      throw new CustomError(
        "Faltan el id del usuario",
        400,
        "MISING_DATA",
        null
      );

    const cartItems = executeQuery(`SELECT * FROM `);

    res.status(200).json({
      message: "Obtenidos con exito",
      data: { id_agente, id_viajero },
    });
  } catch (error) {
    console.log("Este es el error qiuien c", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.details,
      message: error.message,
      data: null,
    });
  }
};

module.exports = {
  getCartItemsById,
};
