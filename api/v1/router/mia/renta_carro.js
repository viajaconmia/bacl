const router = require("express").Router();
const controller = require("../../controller/renta_carros");

router.post("/", controller.createRentaAutos);

module.exports = router;
