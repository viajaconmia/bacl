const router = require("express").Router();
const { getReservasPendientes } = require("./facturasReservas.controller");

router.get("/pendientes", getReservasPendientes);

module.exports = router;
