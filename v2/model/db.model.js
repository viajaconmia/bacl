const BOOKING = require("./bookings.model");
const PAGO = require("./pagos.model");
const SALDO = require("./saldo_a_favor.model");
const SERVICIO = require("./servicios.model");
const VIAJE_AEREO = require("./viaje_aereo.model");
const VUELO = require("./vuelos.model");
const ITEM = require("./item.model");
const ITEM_FACTURA = require("./items_facturas.model");
const FACTURAS = require("./facturas.model");

module.exports = {
  FACTURAS,
  SERVICIO,
  VIAJE_AEREO,
  BOOKING,
  SALDO,
  PAGO,
  VUELO,
  ITEM,
  ITEM_FACTURA,
};
