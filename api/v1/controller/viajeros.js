const { executeSP, executeQuery } = require("../../../config/db");
const model = require("../model/viajeros");

const create = async (req, res) => {
  try {
    const { user } = req?.session;
    const response = await model.createViajero(req.body, user);
    res
      .status(201)
      .json({ message: "Viajero creado correctamente", data: response });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const update = async (req, res) => {
  try {
    const response = await model.updateViajero(req.body);
    res
      .status(201)
      .json({ message: "Viajero actualizado correctamente", data: response });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const read = async (req, res) => {
  try {
    const viajeros = await model.readViajero(req.body);
    res.status(200).json(viajeros);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const readAllViajeros = async (req, res) => {
  try {
    const viajeros = await model.readAllViajeros();
    res.status(200).json(viajeros);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const updateNombreViajero = async (req, res) => {
  try {
    const { id_viajero } = req.body;

    if (!id_viajero) {
      return res.status(400).json({
        message: "id_viajero es requerido",
        data: null,
      });
    }

    const result = await executeQuery(
      `
      UPDATE viajeros
      SET 
        primer_nombre = 'PRUEBA',
        segundo_nombre = 'PRUEBA',
        apellido_paterno = 'PRUEBA',
        apellido_materno = 'PRUEBA'
      WHERE id_viajero = ?;
      `,
      [id_viajero],
    );

    return res.status(200).json({
      message: "Viajero actualizado correctamente",
      data: result,
    });
  } catch (error) {
    console.log(error);
    return res.status(error.statusCode || 500).json({
      message: error.message,
      data: null,
      error,
    });
  }
};

const readById = async (req, res) => {
  try {
    const viajeros = await model.readViajeroById(req.query.id);
    res.status(200).json({ data: viajeros, message: "viajeros obtenidos" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const deleteViajeroById = async (req, res) => {
  try {
    const viajeros = await model.deleteViajero(req.query.id_viajero);
    res
      .status(201)
      .json({ message: "Viajero eliminado correctamente", data: viajeros });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const get_viajeros_by_id_agente = async (req, res) => {
  const { id_agente } = req.params;
  try {
    const viajeros = await executeSP(
      "get_viajeros_by_id_agente",
      [id_agente],
      false,
    );
    if (!viajeros) {
      res.estatus(404).json({
        message:
          "No se han recuperado viajeros a partir de ese agente, intente con otro",
      });
    } else {
      res
        .status(200)
        .json({ message: "Viajeros recuperados con exito ", data: viajeros });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error interno del servidor", error: error });
  }
};

const primeros_empresa_viajero = async (req, res) => {
  const { id_agente } = req.params;
  console.log(id_agente);
  try {
    console.log("Vamos a hacer la query");
    const primeros = await executeSP(
      "get_primer_viajero_y_empresa_by_agente",
      [id_agente],
      false,
    );
    console.log("Verificando que trae primeros", primeros);
    if (!primeros) {
      res.estatus(404).json({
        message:
          "No se han recuperado viajeros a partir de ese agente, intente con otro",
      });
    } else {
      res.status(200).json({
        message: "Viajero y empresa recuperados con exito ",
        data: primeros,
      });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error interno del servidor", error: error });
  }
};
module.exports = {
  create,
  read,
  get_viajeros_by_id_agente,
  primeros_empresa_viajero,
  readById,
  update,
  deleteViajeroById,
  readAllViajeros,
  updateNombreViajero,
};
