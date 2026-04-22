const router = require("express").Router();
const controller = require("../../controller/avisos_reservas");


router.get("/reservas", controller.read);

module.exports = router;    