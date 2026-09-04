const router = require("express").Router();
const { getReservasPendientes, getReporteAgente } = require("./facturasReservas.controller");

router.get("/pendientes", getReservasPendientes);
router.get("/reporte-agente", getReporteAgente);

module.exports = router;
