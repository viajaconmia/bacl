const router = require("express").Router();
const controller = require("../../controller/pago_proveedor");
const { TipoCambio } = require("../../controller/tipo_cambio");

router.get("/solicitud", controller.getSolicitudes2);
router.get("/solicitud_conciliacion", controller.getSolicitudes);
router.post("/solicitud", controller.createSolicitud);
router.get("/saldo_a_favor", controller.saldo_a_favor)
router.post("/cambio_de_estatus", controller.cambio_estatus)
router.post("/dispersion", controller.createDispersion)
router.post("/pago", controller.createPago)  
router.post("/comprobante_pago", controller.createComprobantePago);
router.get("/datosFiscales",controller.getDatosFiscalesProveedor);
router.get("/tipo_cambio", TipoCambio);
router.get("/saldos",controller.saldos)
router.get("/consultar_facturado",controller.consultar_facturado)
router.post("/editProveedor",controller.editProveedores);
router.get("/proveedores",controller.getProveedores);
router.patch("/edit", controller.EditCampos)
router.post("/subir_factura",controller.cargarFactura);
router.post("/asignar_factura_previa",controller.asignar_factura_previa);
router.post("/asignar_monto_fact", controller.monto_factura)
router.post("/detalles",controller.Detalles);
router.get("/buscar_factura",controller.Uuid);
router.delete("/edit_factura",controller.eliminarFactura);
router.post("/buscaruuid",controller.buscaruuid);
router.patch("/reasignar_pago", controller.reasignarPago);
router.patch("/generar_saldo_a_favor", controller.generar_saldo_a_favor);
router.post("/cancelar_dispersion", controller.cancelar_dispersion);
module.exports = router;

