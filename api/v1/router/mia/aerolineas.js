const controller = require("../../controller/aerolineas");
const router = require("express").Router();

router.get("/", controller.getAerolineas);
router.post("/", controller.createAerolinea);

module.exports = router;
