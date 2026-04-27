const router = require("express").Router();
const { getCorreosProcesados } = require("../../controller/cotizaciones");

router.get("/correos-procesados", getCorreosProcesados);

module.exports = router;
