const router = require("express").Router();
const controller = require("../../controller/avisos_reservas");

router.post("/reservas", controller.read);
router.post("/enviadas", controller.enviadas);
router.post("/notificadas", controller.norificaciones);
router.patch("/prefacturar",controller.prefacturar);
module.exports = router;
