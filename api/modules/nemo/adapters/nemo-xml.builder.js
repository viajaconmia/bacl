const NEMO_AGE_TYPES = {
  ADT: "NMO.GBL.AGT.ADT",
  CHD: "NMO.GBL.AGT.CHD",
  INF: "NMO.GBL.AGT.INF",
};

class NemoXmlBuilder {
  buildAvailabilityRequest(dto, transactionId) {
    const ratings = (dto.ratings || [1, 2, 3, 4, 5]).filter(
      (r) => r >= (dto.minRating ?? 1) && r <= (dto.maxRating ?? 5)
    );

    const rooms = (dto.rooms || []).map((room) => {
      const roomPassengers = (dto.passengers || []).filter(
        (p) => p.roomSequence === room.roomSequence
      );
      const passengersXml = roomPassengers
        .map((p) => {
          const ageType = p.ageType === "ADT" ? "ADT" : p.ageType === "CHD" ? "CHD" : "INF";
          return `<Passenger AgeType="${ageType}" RoomSequence="${room.roomSequence}"${p.age !== undefined ? ` Age="${p.age}"` : ""}/>`;
        })
        .join("");
      return `<Room RoomSequence="${room.roomSequence}"><Passengers>${passengersXml}</Passengers></Room>`;
    }).join("");

    const rootPassengersXml = (dto.passengers || [])
      .map((p) => {
        const nemoAge = NEMO_AGE_TYPES[p.ageType] || "NMO.GBL.AGT.ADT";
        return `<Passenger AgeType="${nemoAge}" RoomSequence="${p.roomSequence}"${p.age !== undefined ? ` Age="${p.age}"` : ""}/>`;
      })
      .join("");

    const hotelNameTag = dto.hotelName ? `<HotelName>${dto.hotelName}</HotelName>` : "";
    const ratingsTag =
      (dto.ratings !== undefined || dto.minRating !== undefined || dto.maxRating !== undefined) && ratings.length
        ? `<Ratings>${ratings.join(",")}</Ratings>`
        : "";
    const hotelCodesTag = dto.hotelCodeList && dto.hotelCodeList.length
      ? `<HotelCodeList>${dto.hotelCodeList.join(",")}</HotelCodeList>`
      : "";
    const boardTypesTag = dto.boardTypes && dto.boardTypes.length
      ? `<BoardTypes>${dto.boardTypes.join(",")}</BoardTypes>`
      : "";

    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<AvailabilityQueryRQ TransactionId="${transactionId}" TransactionMode="Synchronous">` +
      `<GeneralParameters><PreferedLanguage LanguageCode="ES"/><PreferedCurrency CurrencyCode="MXN"/></GeneralParameters>` +
      `<Trips><Trip><Destination>${dto.destinationId}</Destination>` +
      `<ProductsParameters><HotelsParameters>` +
      `<Criterion><CheckIn>${dto.checkIn}</CheckIn><CheckOut>${dto.checkOut}</CheckOut>` +
      `<Rooms>${rooms}</Rooms><Availability>CNF</Availability>` +
      `${hotelNameTag}${ratingsTag}${hotelCodesTag}${boardTypesTag}` +
      `</Criterion></HotelsParameters></ProductsParameters></Trip></Trips>` +
      `<Passengers>${rootPassengersXml}</Passengers>` +
      `</AvailabilityQueryRQ>`
    );
  }

  buildHotelDetailsRequest(hotelCode, dto, transactionId) {
    const lang = (dto.language || "es").toUpperCase();
    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<AdditionalInfoQueryRQ TransactionId="${transactionId}" TransactionMode="Synchronous">` +
      `<GeneralParameters><PreferedLanguage LanguageCode="${lang}"/><PreferedCurrency CurrencyCode="MXN"/></GeneralParameters>` +
      `<Products><Hotels><Hotel HotelDetailId="${hotelCode}"/></Hotels></Products>` +
      `</AdditionalInfoQueryRQ>`
    );
  }

  buildValidationRequest(dto, transactionId) {
    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<AvailabilityValidationRQ TransactionId="${transactionId}" TransactionMode="Synchronous">` +
      `<GeneralParameters><PreferedLanguage LanguageCode="ES"/><PreferedCurrency CurrencyCode="MXN"/></GeneralParameters>` +
      `<Products><Hotels><Hotel TripProductID="${dto.tripProductId}"/></Hotels></Products>` +
      `</AvailabilityValidationRQ>`
    );
  }

  buildCancellationFeesRequest(dto, transactionId) {
    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<CancellationFeesQueryRQ TransactionId="${transactionId}" TransactionMode="Synchronous">` +
      `<GeneralParameters><PreferedLanguage LanguageCode="ES"/><PreferedCurrency CurrencyCode="MXN"/></GeneralParameters>` +
      `<Products><Hotels><Hotel TripProductID="${dto.tripProductId}" ShowHotelInformation="true"/></Hotels></Products>` +
      `</CancellationFeesQueryRQ>`
    );
  }

  buildHotelCatalogRequest(dto, transactionId) {
    const activeOnly = String(dto.activeOnly ?? true);
    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<HotelCatalogQueryRQ TransactionId="${transactionId}" TransactionMode="Synchronous">` +
      `<DestinationCode>${dto.destinationCode}</DestinationCode>` +
      `<ActiveOnly>${activeOnly}</ActiveOnly>` +
      `</HotelCatalogQueryRQ>`
    );
  }
}

module.exports = { NemoXmlBuilder };
