const router = require("express").Router();
const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/providers/volaris");

// requeridos para consultar booking
const required = ["recordLocator", "lastName"];

// POST /providers/volaris/booking
router.post(
  "/booking",
  middleware.validateParams(required),
  controller.lookupBookingByPNR
);

module.exports = router;
