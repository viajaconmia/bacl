const router = require("express").Router()
const controller = require("../../controller/impuestos")
// const middleware = require("../../middleware/validateParams")

router.get("/", controller.read)
// router.post("/", middleware.validateParams([]), controller.create)
// router.put("/", middleware.validateParams([]), controller.update)
// router.delete("/", middleware.validateParams([]), controller.delete)

module.exports = router