const model = require("../model/reservas");
const {executeQuery} = require("../../../config/db");

const create = async (req, res) => {

  const { reserva } = req.body;
  const { estado_reserva, solicitud } = reserva;
  if (estado_reserva === "Cancelada")
    //SI AL PROCESAR LA SOLICITUD SE SETEA COMO CANCELADA, SE CANCELA LA SOLICITUD Y NO SE CREA LA RESERVA
    {
    try {
      await executeQuery(
        `UPDATE solicitudes 
           SET status = 'Canceled' 
         WHERE id_solicitud = ?`,
        [solicitud.id_solicitud]
      );
      return res
        .status(200)
        .json({ message: "Solicitud cancelada correctamente" });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ error: "Error interno al cancelar solicitud", details: error.message });
    }
  }
  try {
       let response = await model.insertarReserva(req.body);
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


const updateReserva = async (req, res) => {
  try {
    let response = await model.editarReserva(req.body, req.query.id);
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
const createFromOperaciones = async (req, res) => {
  try {
    let response = await model.insertarReservaOperaciones(req.body);
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
    let response = await model.getReserva();
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const readById = async (req, res) => {
  try {
    let response = await model.getReservaById(req.query.id);
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const readOnlyById = async (req, res) => {
  try {
    let response = await model.getOnlyReservaByID(req.query.id);
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const readAll = async (req, res) => {
  try {
    let response = await model.getReservaAll();
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const readAllFacturacion = async (req, res) => {
  try {
    let response = await model.getReservaAllFacturacion();
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

module.exports = {
  create,
  read,
  readById,
  readAll,
  createFromOperaciones,
  readOnlyById,
  updateReserva,
  readAllFacturacion,
};
