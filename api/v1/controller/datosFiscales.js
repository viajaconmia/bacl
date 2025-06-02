const model = require("../model/datosFiscales");

const create = async (req, res) => {
  try {
    const response = await model.createDatosFiscales(req.body);
    res.status(201).json({
      message: "Datos fiscales creados correctamente",
      data: response,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const update = async (req, res) => {
  try {
    const response = await model.updateDatosFiscales(req.body);
    res.status(201).json({
      message: "Datos fiscales creados correctamente",
      data: response,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const read = async (req, res) => {
  try {
    const datosFiscales = await model.readDatosFiscales();
    res.status(200).json(datosFiscales);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const readById = async (req, res) => {
  try {
    const { id } = req.query;
    const datosFiscales = await model.readDatosFiscalesById(id);
    res.status(200).json(datosFiscales);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

module.exports = {
  create,
  read,
  readById,
  update,
};
