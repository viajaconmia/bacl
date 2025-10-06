const controller = require("../../controller/vuelos");
const router = require("express").Router();

router.get("/", controller.getVuelos);
router.post("/", controller.crearVuelo);

module.exports = router;
