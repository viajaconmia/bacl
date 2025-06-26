const router = require("express").Router();
const controller = require("../../controller/pago_proveedor");

router.get("/solicitud", controller.getSolicitudes);
router.post("/solicitud", controller.createSolicitud);

module.exports = router;
