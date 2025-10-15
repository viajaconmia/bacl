const { Calculo } = require("../../lib/utils/calculates");
const { Formato } = require("../../lib/utils/formats");
const { Validacion } = require("../../lib/utils/validates");
const db = require("../../config/db");
const { SERVICIOS: schema } = require("./schema");

const create = async (connection, servicio) => {
  servicio = Calculo.uuid(servicio, "id_servicio", "ser-");
  servicio = Calculo.precio(servicio);
  Validacion.requiredColumns(schema.required, servicio);

  const propiedades = Formato.propiedades(schema.columnas, servicio);
  const response = await db.insert(connection, propiedades, schema.table);

  return [servicio, response];
};

const update = async (connection, servicio) => {
  Validacion.uuid(servicio.id_servicio);
  servicio = Calculo.precio(servicio);

  const props = Formato.propiedades(schema.columnas, servicio, "id_servicio");

  const response = db.update(
    connection,
    schema.table,
    props,
    servicio.id_servicio,
    "id_servicio"
  );
  return [servicio, response];
};

module.exports = { update, create };
