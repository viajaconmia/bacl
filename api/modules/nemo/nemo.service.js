const { NemoXmlAdapter } = require("./adapters/nemo-xml.adapter");

const adapter = new NemoXmlAdapter();

const nemoService = {
  async searchHotels(dto) {
    if (!dto.destinationId) throw new Error("destinationId es requerido.");
    if (!dto.checkIn || !dto.checkOut) throw new Error("checkIn y checkOut son requeridos.");
    return adapter.searchHotels(dto);
  },

  async getHotelDetails(hotelCode, dto = {}) {
    if (!hotelCode) throw new Error("hotelCode es requerido.");
    return adapter.getHotelDetails(hotelCode, dto);
  },

  async validateRate(tripProductId) {
    if (!tripProductId) throw new Error("tripProductId es requerido.");
    return adapter.validateRate(tripProductId);
  },

  async getCancellationFees(tripProductId) {
    if (!tripProductId) throw new Error("tripProductId es requerido.");
    return adapter.getCancellationFees(tripProductId);
  },
};

module.exports = nemoService;
