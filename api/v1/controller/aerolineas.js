const { executeQuery } = require("../../../config/db");

const getAerolineas = async (req, res) => {
  try {
    const aerolineas = await executeQuery(`SELECT * FROM aerolineas`);
    res.status(200).json({ message: "", data: aerolineas });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

const createAerolinea = async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre.trim()) throw new Error("Viene vacio el nombre");

    await executeQuery(`INSERT INTO aerolineas (nombre) values (?)`, [nombre]);
    const aerolineas = await executeQuery(`SELECT * FROM aerolineas`);
    res.status(200).json({ message: "Creado con exito", data: aerolineas });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

module.exports = {
  getAerolineas,
  createAerolinea,
};
