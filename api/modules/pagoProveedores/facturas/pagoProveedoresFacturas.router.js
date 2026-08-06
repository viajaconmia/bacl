const router = require("express").Router();
const {
  buscarFactura,
  buscarSolicitudes,
  eliminarPagoFactura,
} = require("./pagoProveedoresFacturas.controller");

router.get("/", buscarFactura);
router.get("/solicitudes", buscarSolicitudes);
router.delete("/solicitudes", eliminarPagoFactura);

module.exports = router;
