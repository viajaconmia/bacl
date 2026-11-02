const { XMLParser, XMLValidator } = require("fast-xml-parser");

class NemoXmlParser {
  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      trimValues: true,
      parseTagValue: false,
      parseAttributeValue: false,
    });
  }

  parseAvailabilityResponse(xml) {
    const response = this.parseResponse(xml, "AvailabilityQueryRS");
    const details = response.Details || null;
    if (!details) {
      return {
        transactionId: response["@_TransactionId"] || "UNKNOWN",
        provider: "nemo",
        totalItems: 0,
        hotels: [],
        rawResponse: xml,
      };
    }

    const trips = details.Trips || null;
    const trip = trips ? this.firstRecord(trips.Trip) : null;
    const hotelsAvailability = trip ? (trip.HotelsAvailability || null) : null;
    const hotelsNode = hotelsAvailability ? (hotelsAvailability.Hotels || null) : null;
    const hotelRecords = hotelsNode ? this.collection(hotelsNode, "Hotel") : [];

    const hotels = hotelRecords.map((h) => this.mapHotel(h)).filter((h) => h.rates.length > 0);
    return {
      transactionId: response["@_TransactionId"] || "UNKNOWN",
      provider: "nemo",
      totalItems: hotels.length,
      hotels,
      ...(hotels.length < 3 ? { rawResponse: xml } : {}),
    };
  }

  parseHotelDetailsResponse(xml, hotelCodeFallback) {
    const response = this.parseResponse(xml, "AdditionalInfoQueryRS");
    if (response.Exceptions || !response.HotelCode) {
      return {
        hotelCode: response.HotelCode || hotelCodeFallback || "",
        description: "Información general provista por Nemo.",
        checkInTime: "15:00",
        checkOutTime: "12:00",
        amenities: [],
        images: [],
      };
    }

    const amenitiesRecords = response.Amenities ? this.collection(response.Amenities, "Amenity") : [];
    const imagesRecords = response.Images ? this.collection(response.Images, "Image") : [];

    return {
      hotelCode: String(response.HotelCode || ""),
      description: String(response.Description || ""),
      checkInTime: String(response.CheckInTime || "15:00"),
      checkOutTime: String(response.CheckOutTime || "12:00"),
      amenities: amenitiesRecords.map((item) => ({
        code: String(item["@_Code"] || ""),
        name: String(item["#text"] || item.Name || ""),
      })),
      images: imagesRecords.map((item) => ({
        category: String(item["@_Category"] || "Hotel"),
        url: String(item["@_Url"] || ""),
      })),
    };
  }

  parseValidationResponse(xml) {
    const response = this.parseResponse(xml, "AvailabilityValidationRS");
    const rate = this.firstRecord(response.Rate);
    const price = this.firstRecord(rate.Price);
    const status = this.firstRecord(response.Status);
    const amount = Number(price["@_Amount"] || 0);

    return {
      transactionId: response["@_TransactionId"] || "UNKNOWN",
      provider: "nemo",
      tripProductId: String(response.TripProductID || ""),
      validatedPrice: {
        amount,
        currency: String(price["@_Currency"] || "MXN"),
        priceChanged: String(response.PriceChanged || "false").toLowerCase() === "true",
      },
      availabilityStatus: String(status.Availability || "Confirmed"),
      rateStatus: String(status.Rate || "Available"),
    };
  }

  parseCancellationFeesResponse(xml) {
    const response = this.parseResponse(xml, "CancellationFeesQueryRS");
    const feeSchedule = response.FeeSchedule ? this.collection(response.FeeSchedule, "Tier") : [];

    return {
      transactionId: response["@_TransactionId"] || "UNKNOWN",
      provider: "nemo",
      tripProductId: String(response.TripProductID || ""),
      currency: String(response.Currency || "MXN"),
      freeCancellationDeadline: response.FreeCancellationDeadline || undefined,
      feeSchedule: feeSchedule.map((tier) => ({
        startDate: String(tier["@_StartDate"] || ""),
        endDate: tier["@_EndDate"] || undefined,
        feeAmount: Number(tier["@_FeeAmount"] || 0),
        penaltyPercentage: Number(tier["@_PenaltyPercentage"] || 0),
      })),
    };
  }

  mapHotel(hotel) {
    const address = this.firstRecord(hotel.Address);
    const ratesContainer = hotel.Rates || null;
    const rateRecords = ratesContainer ? this.toRecordArray(ratesContainer.Rate) : [];
    const ratingNode = this.firstRecord(hotel.Rating);

    const latitude = Number(hotel["@_Latitude"] || 0);
    const longitude = Number(hotel["@_Longitude"] || 0);

    return {
      hotelCode: String(hotel["@_Code"] || hotel.Code || ""),
      hotelName: String(hotel["@_Name"] || hotel.Name || "Hotel sin nombre"),
      rating: Number(ratingNode?.Value || hotel["@_Rating"] || 1),
      address: {
        street: String(address?.Line || ""),
        city: String(address?.City || ""),
        postalCode: String(address?.PostalCode || ""),
        countryCode: String(address?.CountryCode || ""),
      },
      latitude,
      longitude,
      rates: rateRecords.map((r) => this.mapRate(r)),
    };
  }

  mapRate(rate) {
    let amount = 0;
    let currency = "USD";

    if (rate.Price) {
      const priceRecord = this.firstRecord(rate.Price);
      amount = Number(priceRecord["@_Amount"] || 0);
      currency = String(priceRecord["@_Currency"] || "USD");
    } else if (rate.RatePrices) {
      const rpContainer = this.firstRecord(rate.RatePrices);
      const rpList = this.toRecordArray(rpContainer.RatePrice);
      const grsOrNet = rpList.find((p) => p["@_Type"] === "GRS" || p["@_Type"] === "NET") || rpList[0];
      if (grsOrNet) {
        amount = Number(grsOrNet["#text"] || grsOrNet["@_Amount"] || 0);
        currency = String(grsOrNet["@_Currency"] || "USD");
      }
    }

    const boardRecord = this.firstRecord(rate.Board);
    const rateBoardCode = boardRecord ? boardRecord["@_Code"] : undefined;
    const rateBoardDesc = boardRecord ? boardRecord["#text"] || boardRecord : rate.Board;

    const roomRatesContainer = rate.RoomRates || rate.Rooms || null;
    const roomRates = roomRatesContainer
      ? this.toRecordArray(roomRatesContainer.RoomRate || roomRatesContainer.Room).map((r) =>
          this.mapRoomRate(r, rateBoardCode, rateBoardDesc)
        )
      : [];

    const policy = this.firstRecord(rate.CancellationPolicy);

    return {
      tripProductId: String(rate["@_TripProductID"] || rate.TripProductID || ""),
      rateClass: String(rate["@_RateClass"] || rate.RateClass || "Standard"),
      amount,
      currency,
      roomRates,
      cancellationPolicy: {
        refundable: String(policy?.Refundable || "false").toLowerCase() === "true",
        deadline: policy?.Deadline || undefined,
      },
      bookable: false,
      bookableReason: "PROVIDER_BOOKING_DISABLED",
    };
  }

  mapRoomRate(roomRate, fallbackBoardCode, fallbackBoardDesc) {
    const boardType = this.firstRecord(roomRate.BoardType) || {};
    const rawType = String(roomRate["@_Type"] || roomRate.RoomType || "");
    const description = roomRate.RoomDescription || roomRate.Description;
    const roomText = roomRate["#text"];

    const friendlyName =
      description && String(description).trim().toLowerCase() !== "test"
        ? String(description).trim()
        : roomText && String(roomText).trim().toLowerCase() !== "test"
        ? String(roomText).trim()
        : this.mapNemoRoomType(rawType);

    const boardCode = String(boardType["@_Code"] || fallbackBoardCode || "RO");
    const boardDescription = String(boardType["@_Description"] || fallbackBoardDesc || "Sólo alojamiento");

    return {
      roomSequence: Number(roomRate["@_RoomSequence"] || 1),
      roomType: friendlyName,
      boardCode,
      boardDescription,
    };
  }

  mapNemoRoomType(code) {
    const cleanCode = String(code || "").toUpperCase().trim();
    const map = {
      "NMO.HTL.RMT.BED.2BD": "Habitación Doble (2 Camas)",
      "NMO.HTL.RMT.BED.1BD": "Habitación con 1 Cama King/Queen",
      "NMO.HTL.RMT.BED.TWN": "Habitación Twin (2 Camas)",
      "NMO.HTL.RMT.DBL": "Habitación Doble",
      "NMO.HTL.RMT.SGL": "Habitación Individual",
      "NMO.HTL.RMT.TPL": "Habitación Triple",
      "NMO.HTL.RMT.QUA": "Habitación Cuádruple",
      "NMO.HTL.RMT.STE": "Suite",
      "NMO.HTL.RMT.JSU": "Junior Suite",
      "NMO.HTL.RMT.FAM": "Habitación Familiar",
      "NMO.HTL.RMT.STD": "Habitación Estándar",
      "NMO.HTL.RMT.SUP": "Habitación Superior",
      "NMO.HTL.RMT.DLX": "Habitación Deluxe",
      "NMO.HTL.RMT.EXC": "Habitación Ejecutiva",
      DBL: "Habitación Doble",
      SGL: "Habitación Individual",
      TPL: "Habitación Triple",
      QUA: "Habitación Cuádruple",
    };
    if (map[cleanCode]) return map[cleanCode];
    if (cleanCode.endsWith("2BD")) return "Habitación Doble (2 Camas)";
    if (cleanCode.endsWith("1BD")) return "Habitación con 1 Cama";
    if (cleanCode.endsWith("DBL")) return "Habitación Doble";
    if (cleanCode.endsWith("SGL")) return "Habitación Individual";
    if (cleanCode.endsWith("TPL")) return "Habitación Triple";
    if (cleanCode.endsWith("QUA")) return "Habitación Cuádruple";
    if (cleanCode.endsWith("STE")) return "Suite";
    if (cleanCode.startsWith("NMO.HTL.RMT.")) {
      const suffix = cleanCode.replace("NMO.HTL.RMT.", "").replace(/\./g, " ");
      return `Habitación ${suffix}`;
    }
    return code || "Habitación Estándar";
  }

  parseResponse(xml, root) {
    if (XMLValidator.validate(xml) !== true) {
      throw new Error("Invalid Nemo XML document.");
    }
    const document = this.xmlParser.parse(xml) || {};
    const errorRoot = document.ErrorRS;
    if (errorRoot) {
      const err = this.firstRecord(errorRoot.Error);
      throw new Error(`Nemo supplier error: ${err["@_Message"] || err.Message || "Error desconocido"}`);
    }

    const response = document[root] || {};
    const exceptions = response.Exceptions;
    if (exceptions) {
      const notification = this.firstRecord(exceptions.Notification);
      const code = Number(notification.NotificationId || 1000);
      const message =
        notification.NotificationDetailedMessage || notification.NotificationMessage || "Supplier exception";

      if (root === "AvailabilityQueryRS" && (code === 5000 || message.toLowerCase().includes("no availability"))) {
        return response;
      }
      if (root === "AdditionalInfoQueryRS") {
        return response;
      }
      throw new Error(`Supplier error [${code}]: ${message}`);
    }

    return response;
  }

  firstRecord(value) {
    if (Array.isArray(value)) return value[0] || {};
    if (value && typeof value === "object") return value;
    return {};
  }

  toRecordArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return [value];
  }

  collection(container, itemKey) {
    if (!container) return [];
    return this.toRecordArray(container[itemKey]);
  }
}

module.exports = { NemoXmlParser };
