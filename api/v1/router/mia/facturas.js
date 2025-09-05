const router = require("express").Router();
const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/facturas");
const { Console } = require("winston/lib/winston/transports");
router.post("/filtrarFacturas", controller.filtrarFacturas);
router.post(
  "/",
  middleware.validateParams(["info_user", "cfdi"]),
  controller.create
);
router.post(
  "/combinada",
  middleware.validateParams(["info_user", "cfdi"]),
  controller.createCombinada
);
router.post(
  "/combinadaEmi",
  // middleware.validateParams(["info_user", "cfdi"]),
  controller.createEmi
);

router.get("/getDetallesConexionesFactura",controller.getDetallesConexionesFactura);


router.get(
  "/get_agente_facturas",
  controller.get_agente_facturas,
);

router.post("/crearFacturaDesdeCargaPagos", controller.crearFacturaDesdeCargaPagos);
router.post("/CrearFacturaDesdeCarga", controller.crearFacturaDesdeCarga);
router.post("/CrearFacturasMultiplesPagos", controller.crearFacturaMultiplesPagos);
router.patch("/AsignarFacturaItems", controller.asignarFacturaItems);
router.get("/getFacturas", controller.readAllFacturas);
router.get("/isFacturada/:id", controller.isFacturada);
router.get("/consultas", controller.readConsultas);
router.get("/consultasAll", controller.readAllConsultas);
router.get("/getDetailsFactura", controller.readDetailsFactura);
router.delete("/delete/:id", controller.deleteFacturas);

module.exports = router;
