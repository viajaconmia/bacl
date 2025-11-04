const controller = require("../../controller/vuelos");
const router = require("express").Router();

router.get("/", controller.getVuelos);
router.get("/id", controller.getVueloById);
router.post("/", controller.crearVuelo);
router.put("/", controller.editarVuelo);

module.exports = router;
