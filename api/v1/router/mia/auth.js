const controller = require("../../controller/auth");
const router = require("express").Router();

router.post("/new-create-agent", controller.newCreateAgente);

module.exports = router;
