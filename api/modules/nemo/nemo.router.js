const router = require("express").Router();
const {
  searchHotels,
  getHotelDetails,
  validateRate,
  getCancellationFees,
  ensureHotel,
  createReservation,
} = require("./nemo.controller");

router.post("/hotels/search", searchHotels);
router.get("/hotels/:hotelCode/details", getHotelDetails);
router.post("/hotels/validate", validateRate);
router.post("/hotels/cancellation-fees", getCancellationFees);

// Operaciones & Reservas con Nemo en MIA
router.post("/hotels/ensure", ensureHotel);
router.post("/reservas/crear", createReservation);

module.exports = router;
