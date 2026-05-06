const router = require("express").Router();
const controller = require("../../controller/avisos_reservas");

router.post("/reservas", controller.read);
router.post("/enviadas", controller.enviadas);
router.post("/notificadas", controller.norificaciones);
router.patch("/prefacturar",controller.prefacturar);
router.patch("/atendida",controller.atendida);
router.patch("/aprobar",controller.aprobar);
router.patch("/desligar",controller.desligar);
router.post("/facturacion",controller.facturacion);
router.post("/generar_layaut", controller.generar_layaut);
router.post("/avisos_factura", controller.validar_items)
module.exports = router;

