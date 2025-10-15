const db = require("../../config/db");
const { Calculo } = require("../../lib/utils/calculates");
const { Formato } = require("../../lib/utils/formats");
const { Validacion } = require("../../lib/utils/validates");
const { VIAJES_AEREOS: schema } = require("./schema");

const create = async (connection, viaje) => {
  viaje = {
    ...Calculo.uuid(viaje, "id_viaje_aereo", "vue-"),
    total: Calculo.precio(viaje).total,
  };

  Validacion.requiredColumns(schema.required, viaje);

  const propiedades = Formato.propiedades(schema.columnas, viaje);
  const response = await db.insert(connection, propiedades, schema.table);

  return [viaje, response];
};

const update = async (connection, viaje) => {
  Validacion.uuid(viaje.id_viaje_aereo);
  viaje = Calculo.precio(viaje);

  const props = Formato.propiedades(schema.columnas, viaje, "id_viaje_aereo");
  const response = await db.update(
    connection,
    schema.table,
    props,
    viaje.id_viaje_aereo
  );

  return [viaje, response];
};

module.exports = { update, create };
