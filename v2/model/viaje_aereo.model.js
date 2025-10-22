const db = require("../../config/db");
const { Calculo } = require("../../lib/utils/calculates");
const { Validacion } = require("../../lib/utils/validates");
const { VIAJES_AEREOS: schema } = require("./schema");

const create = async (conn, viaje) => {
  viaje = {
    ...Calculo.uuid(viaje, "id_viaje_aereo", "vue-"),
    total: Calculo.precio(viaje).total,
  };
  return await db.insert(conn, schema, viaje);
};

const update = async (conn, viaje) => {
  Validacion.uuid(viaje.id_viaje_aereo);
  const { impuestos, ...rest } = Calculo.precio(viaje);
  viaje = rest;
  return await db.update(conn, schema, viaje);
};

module.exports = { update, create };
