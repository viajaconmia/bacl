const router = require("express").Router();
const controller = require("../../controller/pago_proveedor");

router.get("/solicitud", controller.getSolicitudes);
router.post("/solicitud", controller.createSolicitud);

router.post("/dispersion", controller.createDispersion)
router.post("/pago", controller.createPago)
router.get("/datosFiscales",controller.getDatosFiscalesProveedor)
router.post("/editProveedor",controller.editProveedores);
router.get("/proveedores",controller.getProveedores)
router.post("/subir_factura",controller.cargarFactura)
module.exports = router;
