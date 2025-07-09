const router = require("express").Router();
const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/saldos");

router.post("/", controller.create);
router.get("/", controller.read);
router.post("/new", controller.createNewSaldo);

module.exports = router;
