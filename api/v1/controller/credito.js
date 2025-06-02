const model = require("../model/credito");

const create = async (req, res) => {
  try {
    const response = await model.createAgenteCredito(req.body);
    res.status(201).json({ message: "Credito credito para el agente", data: response });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const read = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const datosCredito = await model.readAgenteCredito(id_agente);
    res.status(200).json(datosCredito);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

module.exports = {
  create,
  read,
};
