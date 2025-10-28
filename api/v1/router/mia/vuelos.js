const controller = require("../../controller/vuelos");
const newController = require("../../../../v2/controller/vuelos.controller");
const router = require("express").Router();

router.get("/", controller.getVuelos);
router.get("/id", controller.getVueloById);
router.post("/", controller.crearVuelo);
router.put("/", newController.editarVuelo);

module.exports = router;
