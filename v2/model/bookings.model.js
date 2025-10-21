const { Calculo } = require("../../lib/utils/calculates");
const { Validacion } = require("../../lib/utils/validates");
const db = require("../../config/db");
const { BOOKINGS: schema } = require("./schema");

const create = async (conn, booking) => {
  booking = Calculo.uuid(booking, "id_booking", "boo-");
  booking = Calculo.precio(booking);
  return await db.insert(conn, schema, booking);
};

const update = async (conn, booking) => {
  Validacion.uuid(booking.id_booking);
  booking = Calculo.precio(booking);
  return await db.update(conn, schema, booking);
};

module.exports = { update, create };
