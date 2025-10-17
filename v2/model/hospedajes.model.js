const { Calculo } = require("../../lib/utils/calculates");
const { Formato } = require("../../lib/utils/formats");
const ERROR = require("../../lib/utils/messages");
const {
  hasAllRequiredColumn,
  Validacion,
} = require("../../lib/utils/validates");
const db = require("../../config/db");
const { HOSPEDAJE: schema } = require("./schema");

const create = async (connection, hospedaje) => {
  hospedaje = Calculo.uuid(hospedaje, "id_hospedaje", "hos-");
  hospedaje = Calculo.precio(hospedaje);
  Validacion.requiredColumns(schema.required, hospedaje);

  const propiedades = Formato.propiedades(schema.columnas, hospedaje);
  const response = await db.insert(connection, propiedades, schema.table);

  return [hospedaje, response];
};

const update = async (connection, hospedaje) => {
  Validacion.uuid(hospedaje.id_booking);
  hospedaje = Calculo.precio(hospedaje);

  const propiedades = Formato.propiedades(
    schema.columnas,
    hospedaje,
    "id_hospedaje"
  );
  const response = await db.update(
    connection,
    schema.table,
    propiedades,
    hospedaje.id_booking,
    "id_hospedaje"
  );

  return [hospedaje, response];
};

module.exports = { update, create };