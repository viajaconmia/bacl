const { Calculo } = require("../../lib/utils/calculates");
const { Validacion } = require("../../lib/utils/validates");
const db = require("../../config/db");
const { HOSPEDAJE: schema } = require("./schema");

const create = async (conn, hospedaje) => {
  hospedaje = Calculo.uuid(hospedaje, "id_hospedaje", "hos-");
  Validacion.uuidfk(hospedaje.id_booking);
  return await db.insert(conn, schema, hospedaje);
};

const update = async (conn, hospedaje) => {
  Validacion.uuid(hospedaje.id_booking);
  return await db.update(conn, schema, hospedaje);
};

module.exports = { update, create };
