const controller = require("../../controller/otp");
const router = require("express").Router();

router.post("/send-otp-pass", controller.enviarOtp);
router.get("/all", controller.clientesSinVerificar);
router.get("/verify-otp", controller.verificarOtp);

module.exports = router;
