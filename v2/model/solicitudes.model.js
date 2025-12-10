const { Calculo } = require("../../lib/utils/calculates");
const { Validacion } = require("../../lib/utils/validates");
const db = require("../../config/db");
const { SOLICITUDES: schema } = require("./schema");

const create = async (conn, item) => {
  item = Calculo.uuid(item, "id_solicitud", "ser-");
  item = Calculo.precio(item);
  return await db.insert(conn, schema, item);
};

const update = async (conn, item) => {
  Validacion.uuid(item.id_solicitud);
  item = Calculo.precio(item);
  return await db.update(conn, schema, item);
};

const get = async (...id) => {
  console.log(id);
  return await db.get(schema.table, schema.id, ...id);
};

module.exports = { update, create, get };
