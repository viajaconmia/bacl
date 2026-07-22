const router = require("express").Router();
const { getReservas } = require("./pagoProveedores.controller");

router.get("/reservas", getReservas);

module.exports = router;
