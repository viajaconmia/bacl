const middleware = require("../../middleware/validateParams")
const controller = require("../../controller/credito")
const router = require("express").Router()

router.post("/", controller.create)
router.get("/", controller.read);

module.exports = router