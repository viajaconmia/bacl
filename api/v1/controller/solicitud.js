const { executeSP } = require("../../../config/db");
let model = require("../model/solicitud");

const create = async (req, res) => {
  try {
    let response = await model.createSolicitudes(req.body);
    res
      .status(201)
      .json({ message: "Solicitud created successfully", data: response });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const read = async (req, res) => {
  try {
    let filters = req.query;
    let solicitudes = await model.getSolicitudes(filters);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const readClient = async (req, res) => {
  try {
    const { user_id } = req.query;
    let solicitudes = await model.getSolicitudesClient(user_id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const readSolicitudById = async (req, res) => {
  req.context.logStep('Llegando al endpoint de readSolicitudById');
  const { id } = req.query;
  try {
    const result = await executeSP("sp_get_solicitud_by_id",[id]);
    if(!result || result.length === 0) {
      req.context.logStep('Result vacio');
      return res.status(404).json({ message: "No se encontró un detalle para esta solicitud" });
    }
    res.status(200).json({message: "Detalle de solicitud obtenido correctamente", data: result});
  } catch (error) {
    req.context.logStep('error en la ejecucion del SP',error);
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const readForClient = async (req, res) => {
  try {
    const { id } = req.query;
    let solicitudes = await model.readForClient(id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const readSolicitudByIdWithViajero = async (req, res) => {
  try {
    const { id } = req.query;
    let solicitudes = await model.getSolicitudesClientWithViajero(id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const getViajeroFromSolicitud = async (req, res) => {
  try {
    const { id } = req.query;
    let solicitudes = await model.getViajeroSolicitud(id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const getViajeroAgenteFromSolicitud = async (req, res) => {
  try {
    const { id } = req.query;
    let solicitudes = await model.getViajeroAgenteSolicitud(id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const readConsultas = async (req, res) => {
  try {
    const { user_id } = req.query;
    let solicitudes = await model.getSolicitudesConsultas(user_id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const getItemsSolicitud = async (req, res) => {
  try {
    const { id_solicitud } = req.query;
    let solicitudes = await model.getItemsSolicitud(id_solicitud);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

module.exports = {
  create,
  read,
  readClient,
  readSolicitudById,
  readSolicitudByIdWithViajero,
  getViajeroFromSolicitud,
  getViajeroAgenteFromSolicitud,
  readConsultas,
  getItemsSolicitud,
  readForClient,
};
