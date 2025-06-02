const router = require("express").Router()
const controller = require("../../controller/hospedaje")
const middleware = require("../../middleware/validateParams")

// router.post("/", middleware.validateParams([]), controller.create)
// router.get("/", middleware.validateParams([]), controller.read)
// router.put("/", middleware.validateParams([]), controller.update)
// router.delete("/", middleware.validateParams([]), controller.delete)

module.exports = router