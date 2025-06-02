let model = require("../model/etiquetas");

const create = async (req, res) => {
  try {
      const response = await model.createTag(req.body);
      res.status(201).json({
        message: "Etiqueta creada correctamente",
        data: response,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Error en el servidor", details: error });
    }
};

const read = async (req, res) => {
  try {
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const readTagsClient = async (req, res) => {
  try {
      const { id_agente } = req.query;
      const etiquetas = await model.getTagsClient(id_agente);
  
      res.status(200).json({ data: etiquetas })
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Error en el servidor', details: error })
    }
};

const createSolicitudEtiqueta = async (req, res) => {
  try {
    const response = await model.createSolicitudEtiqueta(req.body)
    res.status(201).json({ message: "Relacion creada correctamente", data: response })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}


module.exports = {
  create,
  read,
  readTagsClient,
  createSolicitudEtiqueta,
};
