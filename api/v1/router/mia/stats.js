const controller = require("../../controller/stats")
const router = require("express").Router()

router.get("/monthly", controller.getCardStats)
router.get("/year", controller.getCardStatsPerMonth)

module.exports = router