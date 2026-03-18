const router = require("express").Router();
const controller = require("../../controller/pago_proveedor");

router.get("/solicitud", controller.getSolicitudes);
router.get("/solicitud_conciliacion", controller.getSolicitudes2);
router.post("/solicitud", controller.createSolicitud);
router.get("/saldo_a_favor", controller.saldo_a_favor)
router.post("/cambio_de_estatus", controller.cambio_estatus)
router.post("/dispersion", controller.createDispersion)
router.post("/pago", controller.createPago) 
router.get("/datosFiscales",controller.getDatosFiscalesProveedor);
router.get("/saldos",controller.saldos)
router.post("/editProveedor",controller.editProveedores);
router.get("/proveedores",controller.getProveedores)
router.post("/subir_factura",controller.cargarFactura)
router.patch("/edit", controller.EditCampos)
router.post("/detalles",controller.Detalles)
module.exports = router;
