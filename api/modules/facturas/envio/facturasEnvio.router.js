const router = require("express").Router();
const { enviar, historial } = require("./facturasEnvio.controller");

router.post("/enviar", enviar);
router.get("/historial", historial);

module.exports = router;
