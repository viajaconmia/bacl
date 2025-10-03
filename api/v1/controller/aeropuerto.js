const { executeQuery } = require("../../../config/db");

const getAeropuertos = async (req, res) => {
  try {
    const aerolineas = await executeQuery(
      `SELECT Codigo_IATA as codigo, id_destino as id, NomeES as nombre, Ubicacion as ciudad, Nombre_pais as pais FROM destinos`
    );
    res.status(200).json({ message: "", data: aerolineas });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

const createAeropuerto = async (req, res) => {
  try {
    const { codigo, ubicacion } = req.body;

    if (!codigo.trim() || !ubicacion.trim())
      throw new Error("Un valor viene vacio");
    const nombreAeropuerto = `${ubicacion} (${codigo})`;
    await executeQuery(
      `INSERT INTO destinos (Codigo_IATA, Ubicacion, NomeES) values (?,?,?)`,
      [codigo, ubicacion, nombreAeropuerto]
    );
    const aeropuertos = await executeQuery(
      `SELECT Codigo_IATA as codigo, id_destino as id, NomeES as nombre FROM destinos`
    );
    res.status(200).json({ message: "Creado con exito", data: aeropuertos });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

module.exports = {
  getAeropuertos,
  createAeropuerto,
};
