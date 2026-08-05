const router = require("express").Router();
const { buscarSolicitudes, eliminarPagoFactura } = require("./pagoProveedoresFacturas.controller");

router.get("/solicitudes", buscarSolicitudes);
router.delete("/solicitudes", eliminarPagoFactura);

module.exports = router;
