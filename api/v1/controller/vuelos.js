const { executeQuery } = require("../../../config/db");

const crearVuelo = async (req, res) => {
  try {
    const {} = req.body;

    res
      .status(200)
      .json({ message: "Reservación creada con exito", data: null });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

module.exports = {
  crearVuelo,
};
