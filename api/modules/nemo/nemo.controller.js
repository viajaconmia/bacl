const nemoService = require("./nemo.service");

async function searchHotels(req, res) {
  try {
    const result = await nemoService.searchHotels(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function getHotelDetails(req, res) {
  try {
    const { hotelCode } = req.params;
    const { language } = req.query;
    const result = await nemoService.getHotelDetails(hotelCode, { language });
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function validateRate(req, res) {
  try {
    const { tripProductId } = req.body;
    const result = await nemoService.validateRate(tripProductId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function getCancellationFees(req, res) {
  try {
    const { tripProductId } = req.body;
    const result = await nemoService.getCancellationFees(tripProductId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function ensureHotel(req, res) {
  try {
    const result = await nemoService.ensureHotelExists(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function createReservation(req, res) {
  try {
    const sessionUser = req.session?.user || req.user || {};
    const result = await nemoService.createReservation(req.body, sessionUser);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating Nemo reservation in MIA:", error);
    res.status(400).json({ error: error.message });
  }
}

module.exports = {
  searchHotels,
  getHotelDetails,
  validateRate,
  getCancellationFees,
  ensureHotel,
  createReservation,
};
