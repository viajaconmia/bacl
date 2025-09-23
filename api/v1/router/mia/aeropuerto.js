const controller = require("../../controller/aeropuerto");
const router = require("express").Router();

router.get("/", controller.getAeropuertos);
router.post("/", controller.createAeropuerto);

module.exports = router;
