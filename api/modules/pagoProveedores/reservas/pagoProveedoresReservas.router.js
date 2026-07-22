const router = require("express").Router();
const { getReservas } = require("./pagoProveedoresReservas.controller");

router.get("/", getReservas);

module.exports = router;
