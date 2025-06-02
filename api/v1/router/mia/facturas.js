const router = require("express").Router()
const middleware = require("../../middleware/validateParams")
const controller = require("../../controller/facturas")

router.post("/", middleware.validateParams(["info_user", "cfdi"]), controller.create)
router.post("/combinada", middleware.validateParams(["info_user", "cfdi"]), controller.createCombinada)
router.get("/getFacturas", controller.readAllFacturas);
router.get("/consultas", controller.readConsultas)

module.exports = router