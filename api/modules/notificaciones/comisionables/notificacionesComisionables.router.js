const router = require("express").Router();
const { conteo } = require("./notificacionesComisionables.controller");

router.get("/conteo", conteo);

module.exports = router;
