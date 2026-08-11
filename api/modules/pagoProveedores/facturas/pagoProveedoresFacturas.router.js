const router = require("express").Router();
const {
  buscarFactura,
  editarFactura,
  buscarSolicitudes,
  eliminarPagoFactura,
  editarPagoFactura,
} = require("./pagoProveedoresFacturas.controller");

router.get("/", buscarFactura);
router.put("/", editarFactura);
router.get("/solicitudes", buscarSolicitudes);
router.put("/solicitudes", editarPagoFactura);
router.delete("/solicitudes", eliminarPagoFactura);

module.exports = router;
