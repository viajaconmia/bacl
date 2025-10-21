const db = require("../../config/db");
const { Validacion } = require("../../lib/utils/validates");
const { VIAJES_AEREOS: schema } = require("./schema");

const create = async (conn, vuelo) => {
  Validacion.uuidfk(vuelo.id_vuelo);
  Validacion.uuidfk(vuelo.id_viajero);
  Validacion.numberid(vuelo.airline_code);
  Validacion.numberid(vuelo.departure_airport_code);
  Validacion.numberid(vuelo.arrival_airport_code);
  return await db.insert(conn, schema, vuelo);
};

const update = async (conn, vuelo) => {
  Validacion.numberid(vuelo.id_vuelo);
  return await db.update(conn, schema, vuelo);
};

const drop = async (conn) => {
  ids.forEach((id) => Validacion.numberid(id));
  const query = `DELETE FROM ${table} WHERE id_vuelo in (${ids
    .map((_) => "?")
    .join(",")})`;
  return await conn.execute(query, ids);
};

module.exports = { update, create, drop };
