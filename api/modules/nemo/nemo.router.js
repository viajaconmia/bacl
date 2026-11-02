const router = require("express").Router();
const {
  searchHotels,
  getHotelDetails,
  validateRate,
  getCancellationFees,
} = require("./nemo.controller");

router.post("/hotels/search", searchHotels);
router.get("/hotels/:hotelCode/details", getHotelDetails);
router.post("/hotels/validate", validateRate);
router.post("/hotels/cancellation-fees", getCancellationFees);

module.exports = router;
