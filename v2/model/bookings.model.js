const { Calculo } = require("../../lib/utils/calculates");
const { Formato } = require("../../lib/utils/formats");
const ERROR = require("../../lib/utils/messages");
const {
  hasAllRequiredColumn,
  Validacion,
} = require("../../lib/utils/validates");
const db = require("../../config/db");
const { BOOKINGS: schema } = require("./schema");

const create = async (connection, booking) => {
  booking = Calculo.uuid(booking, "id_booking", "boo-");
  booking = Calculo.precio(booking);
  Validacion.requiredColumns(schema.required, booking);

  const propiedades = Formato.propiedades(schema.columnas, booking);
  const response = await db.insert(connection, propiedades, schema.table);

  return [booking, response];
};

const update = async (connection, booking) => {
  Validacion.uuid(booking.id_booking);
  booking = Calculo.precio(booking);

  const propiedades = Formato.propiedades(
    schema.columnas,
    booking,
    "id_booking"
  );
  const response = await db.update(
    connection,
    schema.table,
    propiedades,
    booking.id_booking
  );

  return [booking, response];
};

module.exports = { update, create };
