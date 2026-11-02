const axios = require("axios");
const { NemoXmlBuilder } = require("./nemo-xml.builder");
const { NemoXmlParser } = require("./nemo-xml.parser");

class NemoXmlAdapter {
  constructor() {
    this.baseUrl =
      process.env.NEMO_BASE_URL || "https://service-cert.psurfer.net/pricesurfer";
    this.authToken =
      process.env.NEMO_AUTH_TOKEN || "d432f8c751ed1006931a663755666799";
    this.builder = new NemoXmlBuilder();
    this.parser = new NemoXmlParser();
  }

  async send(path, xml, parse) {
    const url = `${this.baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
    try {
      const response = await axios.post(url, xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          Accept: "application/xml",
          "auth-token": this.authToken,
        },
        timeout: 25000,
        transformResponse: [(body) => body],
      });
      return parse(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error("Authentication with hotel supplier failed.");
        }
        const status = error.response?.status;
        const bodyPreview = error.response?.data ? String(error.response.data).slice(0, 200) : "";
        throw new Error(
          `Unable to complete the Nemo hotel request (HTTP ${status || "unknown"}): ${bodyPreview || error.message}`
        );
      }
      throw error;
    }
  }

  createTransactionId() {
    const timestamp = Date.now();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `TX_MIA_${timestamp}_${random}`;
  }

  async searchHotels(dto) {
    const transactionId = this.createTransactionId();
    const xml = this.builder.buildAvailabilityRequest(dto, transactionId);
    return this.send(
      "/catalog/products/search?hideNewInfo=false",
      xml,
      (body) => this.parser.parseAvailabilityResponse(body)
    );
  }

  async getHotelDetails(hotelCode, dto = {}) {
    const transactionId = this.createTransactionId();
    const xml = this.builder.buildHotelDetailsRequest(hotelCode, dto, transactionId);
    return this.send(
      "/catalog/product/detail",
      xml,
      (body) => this.parser.parseHotelDetailsResponse(body, hotelCode)
    );
  }

  async validateRate(tripProductId) {
    const transactionId = this.createTransactionId();
    const xml = this.builder.buildValidationRequest({ tripProductId }, transactionId);
    return this.send(
      "/catalog/product/validate",
      xml,
      (body) => this.parser.parseValidationResponse(body)
    );
  }

  async getCancellationFees(tripProductId) {
    const transactionId = this.createTransactionId();
    const xml = this.builder.buildCancellationFeesRequest({ tripProductId }, transactionId);
    return this.send(
      "/booking/cancellation/fees",
      xml,
      (body) => this.parser.parseCancellationFeesResponse(body)
    );
  }
}

module.exports = { NemoXmlAdapter };
