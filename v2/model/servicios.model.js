const { Calculo } = require("../../lib/utils/calculates");
const { Validacion } = require("../../lib/utils/validates");
const db = require("../../config/db");
const { SERVICIOS: schema } = require("./schema");

const create = async (conn, servicio) => {
  servicio = Calculo.uuid(servicio, "id_servicio", "ser-");
  servicio = Calculo.precio(servicio);
  return await db.insert(conn, schema, servicio);
};

const update = async (conn, servicio) => {
  Validacion.uuid(servicio.id_servicio);
  servicio = Calculo.precio(servicio);
  return await db.update(conn, schema, servicio);
};

module.exports = { update, create };
