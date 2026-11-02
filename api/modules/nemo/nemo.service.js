const { NemoXmlAdapter } = require("./adapters/nemo-xml.adapter");
const { executeQuery } = require("../../../config/db");
const { insertarReservaOperaciones } = require("../../v1/model/reservas");

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

  /**
   * Asegura que el hotel de Nemo exista en la tabla `hoteles` de MIA.
   * Realiza doble verificación:
   * 1. Por id_hotel estandarizado (NMO_{hotelCode})
   * 2. Por nombre del hotel (coincidencia insensible a mayúsculas/minúsculas)
   * Si no existe, lo inserta con Activo = 0 para no alterar búsquedas ni cotizaciones públicas.
   * El trigger de base de datos trg_hoteles_insert_proveedor crea automáticamente el proveedor.
   */
  async ensureHotelExists(hotelData) {
    if (!hotelData) {
      throw new Error("Datos del hotel son requeridos.");
    }

    const hotelCode = String(hotelData.hotelCode || hotelData.code || "").trim();
    const hotelName = String(hotelData.hotelName || hotelData.name || "").trim();

    if (!hotelCode && !hotelName) {
      throw new Error("Se requiere al menos hotelCode o hotelName para asegurar la existencia del hotel.");
    }

    const targetId = hotelCode ? `NMO_${hotelCode}` : null;

    // 1. Verificación por ID estandarizado NMO_{hotelCode}
    if (targetId) {
      const existingById = await executeQuery(
        "SELECT * FROM hoteles WHERE id_hotel = ? LIMIT 1",
        [targetId]
      );
      if (existingById && existingById.length > 0) {
        const hotel = existingById[0];
        const prov = await executeQuery(
          "SELECT id FROM proveedores WHERE id_relacion = ? OR proveedor = ? LIMIT 1",
          [hotel.id_hotel, hotel.nombre]
        );
        return {
          hotel,
          id_hotel: hotel.id_hotel,
          nombre: hotel.nombre,
          id_proveedor: prov && prov[0] ? prov[0].id : null,
          created: false,
          matchType: "id",
        };
      }
    }

    // 2. Doble verificación por Nombre del Hotel
    if (hotelName) {
      const existingByName = await executeQuery(
        "SELECT * FROM hoteles WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)) LIMIT 1",
        [hotelName]
      );
      if (existingByName && existingByName.length > 0) {
        const hotel = existingByName[0];
        const prov = await executeQuery(
          "SELECT id FROM proveedores WHERE id_relacion = ? OR proveedor = ? LIMIT 1",
          [hotel.id_hotel, hotel.nombre]
        );
        return {
          hotel,
          id_hotel: hotel.id_hotel,
          nombre: hotel.nombre,
          id_proveedor: prov && prov[0] ? prov[0].id : null,
          created: false,
          matchType: "name",
        };
      }
    }

    // 3. Si no existe, insertar con Activo = 0
    const finalId = targetId || `NMO_${Date.now()}`;
    const address = hotelData.address || null;
    const city = hotelData.destinationName || hotelData.city || null;
    const country = hotelData.country || "MEXICO";
    const lat = hotelData.latitude != null ? Number(hotelData.latitude) : null;
    const lng = hotelData.longitude != null ? Number(hotelData.longitude) : null;
    const comentarios = "## DATOS BÁSICOS ## Hotel externo importado de Nemo.";

    await executeQuery(
      `INSERT INTO hoteles (
        id_hotel, nombre, id_cadena, direccion, latitud, longitud, lat, lng,
        Estado, Ciudad_Zona, pais, Activo, Comentarios
      ) VALUES (?, ?, 11, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        finalId,
        hotelName,
        address,
        lat != null ? String(lat) : null,
        lng != null ? String(lng) : null,
        lat,
        lng,
        city,
        city,
        country,
        comentarios,
      ]
    );

    // El trigger trg_hoteles_insert_proveedor crea automáticamente el proveedor correspondiente
    const newProv = await executeQuery(
      "SELECT id FROM proveedores WHERE id_relacion = ? LIMIT 1",
      [finalId]
    );

    return {
      hotel: {
        id_hotel: finalId,
        nombre: hotelName,
        Activo: 0,
        Ciudad_Zona: city,
        pais: country,
      },
      id_hotel: finalId,
      nombre: hotelName,
      id_proveedor: newProv && newProv[0] ? newProv[0].id : null,
      created: true,
      matchType: "none",
    };
  },

  /**
   * Crea una reservación en MIA a partir de una tarifa de Nemo.
   * Maneja el cobro al cliente mediante:
   * - bandera = 0: Crédito (valida y descuenta saldo del agente)
   * - bandera = 1: Wallet / Saldo a favor (consume saldos de saldos_a_favor)
   * Asocia al proveedor del hotel y a Nemo como intermediario.
   */
  async createReservation(dto, sessionUser = {}) {
    const banderaNum = Number(dto.bandera);
    if (banderaNum !== 0 && banderaNum !== 1) {
      throw new Error(
        `bandera inválida al crear la reserva: se recibió "${dto.bandera}" pero solo se acepta 0 (crédito) o 1 (wallet/saldo a favor).`
      );
    }

    if (!dto.id_agente) throw new Error("id_agente es requerido.");
    if (!dto.id_viajero) throw new Error("id_viajero es requerido.");
    if (!dto.check_in || !dto.check_out) throw new Error("check_in y check_out son requeridos.");
    if (!dto.hotel) throw new Error("Información del hotel es requerida.");

    // 1. Asegurar existencia del hotel (doble verificación ID/Nombre)
    const hotelResult = await this.ensureHotelExists(dto.hotel);

    // 2. Obtener proveedor intermediario NEMO
    const nemoProv = await executeQuery(
      "SELECT id, proveedor FROM proveedores WHERE proveedor = 'NEMO' AND intermediario = 1 LIMIT 1"
    );
    const nemoProviderId = nemoProv && nemoProv[0] ? nemoProv[0].id : 4278;

    // 3. Calcular montos e impuestos
    const totalVenta = Number(dto.venta?.total || dto.rate?.total || 0);
    if (!(totalVenta > 0)) {
      throw new Error("El total de venta debe ser un número mayor a 0.");
    }
    const subtotalVenta = Number(dto.venta?.subtotal || (totalVenta * 0.84).toFixed(2));
    const impuestosVenta = Number(dto.venta?.impuestos || (totalVenta * 0.16).toFixed(2));

    const totalCosto = Number(dto.proveedor?.total || totalVenta);
    const subtotalCosto = Number(dto.proveedor?.subtotal || subtotalVenta);
    const impuestosCosto = Number(dto.proveedor?.impuestos || impuestosVenta);

    // 4. Calcular noches
    const checkInDate = new Date(dto.check_in);
    const checkOutDate = new Date(dto.check_out);
    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    const calculatedNoches = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    const noches = Number(dto.noches) || calculatedNoches;

    // 5. Generar items por noche
    const items = [];
    const nightTotal = parseFloat((totalVenta / noches).toFixed(2));
    const nightSubtotal = parseFloat((nightTotal * 0.84).toFixed(2));
    const nightImpuestos = parseFloat((nightTotal * 0.16).toFixed(2));

    for (let i = 0; i < noches; i++) {
      items.push({
        venta: {
          total: nightTotal,
          subtotal: nightSubtotal,
          impuestos: nightImpuestos,
        },
        costo: {
          total: parseFloat((totalCosto / noches).toFixed(2)),
          subtotal: parseFloat((subtotalCosto / noches).toFixed(2)),
          impuestos: parseFloat((impuestosCosto / noches).toFixed(2)),
        },
      });
    }

    // 6. Armar payload de reserva para el modelo MIA
    const habitacionNombre = dto.habitacion || dto.rate?.roomDescription || "HABITACIÓN ESTÁNDAR";
    const reservaPayload = {
      solicitud: {
        id_agente: dto.id_agente,
      },
      viajero: {
        id_viajero: dto.id_viajero,
      },
      acompanantes: Array.isArray(dto.acompanantes) ? dto.acompanantes : [],
      check_in: dto.check_in,
      check_out: dto.check_out,
      noches: noches,
      habitacion: habitacionNombre,
      codigo_reservacion_hotel: dto.codigo_reservacion_hotel || dto.rate?.rateId || `NMO-${Date.now()}`,
      estado_reserva: dto.estado_reserva || "Confirmada",
      comments: dto.comments || "Reserva procesada con tarifas Nemo (PriceSurfer).",
      comentarios_internos: "Proveedor intermediario: Nemo (PriceSurfer).",
      is_comisionable: 0,
      monto_comisionable: null,
      porcentaje_comisionable: null,
      comentarios_comisionables: null,
      venta: {
        total: totalVenta,
        subtotal: subtotalVenta,
        impuestos: impuestosVenta,
      },
      proveedor: {
        total: totalCosto,
        subtotal: subtotalCosto,
        impuestos: impuestosCosto,
      },
      hotel: {
        name: hotelResult.nombre,
        content: {
          id_hotel: hotelResult.id_hotel,
          nombre_hotel: hotelResult.nombre,
          tipos_cuartos: [
            { nombre_tipo_cuarto: "SENCILLO", precio: 0, costo: 0, tipo_desayuno: null, incluye_desayuno: 0 },
            { nombre_tipo_cuarto: "DOBLE", precio: 0, costo: 0, tipo_desayuno: null, incluye_desayuno: 0 },
          ],
        },
      },
      intermediario: {
        exists: true,
        proveedor: {
          id: nemoProviderId,
          proveedor: "NEMO",
        },
      },
      items: items,
      user: {
        id: sessionUser?.id || sessionUser?.id_usuario || dto.usuario_creador || "operaciones-nemo",
      },
      usuarioCreador: {
        id_viajero: sessionUser?.id_viajero || null,
      },
      ejemplo_saldos: Array.isArray(dto.ejemplo_saldos) ? dto.ejemplo_saldos : [],
    };

    // 7. Ejecutar transacción de reserva en MIA
    const result = await insertarReservaOperaciones(reservaPayload, banderaNum);

    return {
      success: true,
      message: "Reserva creada exitosamente en MIA.",
      data: result,
      hotel: hotelResult,
      intermediarioId: nemoProviderId,
    };
  },
};

module.exports = nemoService;
