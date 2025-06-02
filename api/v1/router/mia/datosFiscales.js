const router = require("express").Router();
const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/datosFiscales");

router.put("/", controller.update);
router.post("/", controller.create);
router.get("/", controller.read);
router.get("/id", controller.readById);

module.exports = router;
