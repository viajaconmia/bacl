const { executeQuery, executeSP2 } = require("../../../config/db");

function extractFilters(body) {
  const {
    pag = 1,
    cant = 50,
    id_agente = null,
    nombre_agente = null,
    hotel = null,
    codigo_reservacion = null,
    traveler = null,
    tipo_hospedaje = null,
  } = body ?? {};

  return {
    pag: Number(pag) || 1,
    cant: Number(cant) || 50,
    id_agente: id_agente || null,
    nombre_agente: nombre_agente || null,
    hotel: hotel || null,
    codigo_reservacion: codigo_reservacion || null,
    traveler: traveler || null,
    tipo_hospedaje: tipo_hospedaje || null,
  };
}

const read = async (req, res) => {
  try {
    const { pag, cant, id_agente, nombre_agente, hotel, codigo_reservacion, traveler, tipo_hospedaje } = extractFilters(req.body);
    const response = await executeSP2("sp_vw_new_reservas_paginado_sin_enviar", [pag, cant, id_agente, nombre_agente, hotel, codigo_reservacion, traveler, tipo_hospedaje]);
    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener avisos de reservas", details: error.message });
  }
};

const enviadas = async (req, res) => {
  try {
    const { pag, cant, id_agente, nombre_agente, hotel, codigo_reservacion, traveler, tipo_hospedaje } = extractFilters(req.body);
    const response = await executeSP2("sp_vw_new_reservas_paginado", [pag, cant, id_agente, nombre_agente, hotel, codigo_reservacion, traveler, tipo_hospedaje]);
    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener avisos de reservas", details: error.message });
  }
};

const norificaciones = async (req, res) => {
  try {
    const { pag, cant, id_agente, nombre_agente, hotel, codigo_reservacion, traveler, tipo_hospedaje } = extractFilters(req.body);
    const response = await executeSP2("sp_vw_new_reservas_paginado", [pag, cant, id_agente, nombre_agente, hotel, codigo_reservacion, traveler, tipo_hospedaje]);
    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener avisos de reservas", details: error.message });
  }
};

const prefacturar = async (req, res) => {
  try {
    const { user } = req.session;
    const id_user = user.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: "El payload debe traer un arreglo 'ids' con al menos un registro",
      });
    }

    const resultados = [];

    for (const item of ids) {
      const { id_relacion, id_booking } = item;

      if (!id_relacion || !id_booking) {
        resultados.push({
          id_relacion,
          id_booking,
          error: "Faltan id_relacion o id_booking",
        });
        continue;
      }

      const response = await executeSP2("sp_prefacturar", [
        id_relacion,
        id_booking,
        id_user,
      ]);

      resultados.push({
        id_relacion,
        id_booking,
        response,
      });
    }

    return res.status(200).json({
      message: "Proceso ejecutado correctamente",
      resultados,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al marcar como prefacturada",
      details: error.message,
    });
  }
};

module.exports = { read, enviadas, norificaciones,prefacturar };
