const controller = require("../../controller/vuelos");
const router = require("express").Router();

router.post("/", controller.crearVuelo);

module.exports = router;
