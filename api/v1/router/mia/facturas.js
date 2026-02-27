const router = require("express").Router();
const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/facturas");
const v2 = require("../../../../v2/controller/facturas.controller");

router.post("/filtrarFacturas", controller.filtrarFacturas);
router.post(
  "/",
  middleware.validateParams(["info_user", "cfdi"]),
  controller.create,
);
router.post(
  "/combinada",
  middleware.validateParams(["info_user", "cfdi"]),
  controller.createCombinada,
);
router.post(
  "/combinadaEmi",
  // middleware.validateParams(["info_user", "cfdi"]),
  controller.createEmi,
);

router.get("/detallesConexion", controller.getDetallesConexionesFactura);
router.get("/eliminar factura");
router.delete("/quitar_relacion", controller.getQuitarDetalles);
router.get("/getfulldetalles", controller.getFullDetalles);

router.get("/get_agente_facturas", controller.get_agente_facturas);

router.post(
  "/crearFacturaDesdeCargaPagos",
  controller.crearFacturaDesdeCargaPagos,
);

router.get(
  "/agentes_report_fac",
  // middleware.validateParams(["info_user", "cfdi"]),
  controller.agentes_report_fac,
);

router.post("/CrearFacturaDesdeCarga", controller.crearFacturaDesdeCarga);
router.post(
  "/CrearFacturasMultiplesPagos",
  controller.crearFacturaMultiplesPagos,
);
router.patch("/AsignarFacturaItems", controller.asignarFacturaItems);
router.patch("/AsignarFacturaPagos", controller.asignarFacturaPagos);
router.get("/getFacturas", controller.readAllFacturas);
router.get("/isFacturada/:id", controller.isFacturada);
router.get("/consultas", controller.readConsultas);
router.get("/consultasAll", controller.readAllConsultas);
router.get("/getfacturasPagoPendiente", controller.getfacturasPagoPendiente);
router.get("/getDetailsFactura", controller.readDetailsFactura);
router.delete("/delete/:id", controller.deleteFacturas);
router.post("/asignarURLS_factura", controller.asignarURLS_factura);
router.post(
  "/getfacturasPagoPendienteByAgente",
  controller.getfacturasPagoPendienteByAgente,
);
router.put("/documentos", controller.updateDocumentosFacturas);
router.get("/detalles_facturas", controller.getFacturasDetalles);
module.exports = router;

/**
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * V2
 */

router.delete("/:id", v2.cancelarFacturaById);
