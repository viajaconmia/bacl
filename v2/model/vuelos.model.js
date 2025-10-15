const db = require("../../config/db");
const { Formato } = require("../../lib/utils/formats");
const { Validacion } = require("../../lib/utils/validates");
const { VIAJES_AEREOS: schema } = require("./schema");

const create = async (connection, vuelo) => {
  Validacion.uuidfk(vuelo.id_vuelo);
  Validacion.uuidfk(vuelo.id_viajero);
  Validacion.numberid(vuelo.airline_code);
  Validacion.numberid(vuelo.departure_airport_code);
  Validacion.numberid(vuelo.arrival_airport_code);

  Validacion.requiredColumns(schema.required, vuelo);

  const propiedades = Formato.propiedades(schema.columnas, vuelo);
  const response = await db.insert(connection, propiedades, schema.table);

  return [vuelo, response];
};

const update = async (connection, vuelo) => {
  Validacion.numberid(vuelo.id_vuelo);

  const props = Formato.propiedades(schema.columnas, vuelo, "id_vuelo");
  const response = await db.update(
    connection,
    schema.table,
    props,
    vuelo.id_vuelo
  );

  return [vuelo, response];
};

const drop = async () => {
  ids.forEach((id) => Validacion.numberid(id));
  const query = `DELETE FROM ${table} WHERE id_vuelo in (${ids
    .map((_) => "?")
    .join(",")})`;
  return await connection.execute(query, ids);
};

module.exports = { update, create, drop };
