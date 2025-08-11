const router = require("express").Router();
const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/facturas");
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
router.post("/CrearFacturaDesdeCarga", controller.crearFacturaDesdeCarga);
router.patch("/AsignarFacturaItems", controller.asignarFacturaItems);
router.get("/getFacturas", controller.readAllFacturas);
router.get("/isFacturada/:id", controller.isFacturada);
router.get("/consultas", controller.readConsultas);
router.get("/consultasAll", controller.readAllConsultas);
router.get("/getDetailsFactura", controller.readDetailsFactura);
router.delete("/delete/:id", controller.deleteFacturas);

module.exports = router;
