const { executeQuery, runTransaction } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
const { verificarSaldos } = require("../../../lib/utils/validates");
const { calcularPrecios } = require("../../../lib/utils/calculates");

const crearVuelo = async (req, res) => {
  try {
    //EXTRACCIÓN, VALIDACIÓN Y FORMATEO DE DATOS
    let { faltante, saldos, vuelos, reserva, id_agente } = req.body;

    if (vuelos.length == 0) throw new Error("No se encontraron vuelos");

    console.log("faltante:", faltante);
    console.log("saldos:", saldos);
    console.log("vuelos:", vuelos);
    console.log("reserva:", reserva);
    console.log("id_agente:", id_agente);

    faltante = Number(faltante);
    reserva = {
      ...reserva,
      costo: Number(reserva.costo),
      precio: Number(reserva.precio),
    };
    saldos = saldos.map((saldo) => ({
      ...saldo,
      saldo: Number(saldo.saldo),
      monto: Number(saldo.monto),
      restante: Number(saldo.restante),
      saldo_usado: Number(saldo.saldo_usado),
    }));

    //FORMATO DE LAS TABLAS PARA UN MANEJO MAS SENCILLO
    //VUELOS
    const tipo_vuelo = vuelos.map((vuelo) => [
      vuelo.tipo.includes("vuelta"),
      vuelo.tipo.includes("escala"),
    ]);

    const indiceVueloIdaDestino = vuelos.findLastIndex((vuelo) =>
      vuelo.tipo.includes("ida escala")
    );
    const indiceVueloRegresoOrigen = vuelos.findIndex((vuelo) =>
      vuelo.tipo.includes("vuelta")
    );
    const indiceVueloRegresoDestino = vuelos.findLastIndex((vuelo) =>
      vuelo.tipo.includes("vuelta escala")
    );

    const id_servicio = `ser-${uuidv4()}`;
    const id_booking = `boo-${uuidv4()}`;
    const id_viaje_aereo = `vue-${uuidv4()}`;
    const id_solicitud = `ser-${uuidv4()}`;

    const viaje_aereo = {
      id_viaje_aereo,
      id_booking,
      id_servicio,
      codigo_confirmation: reserva.codigo,
      trip_type: `${
        tipo_vuelo.some(([vuelta, escala]) => !!vuelta) ? "REDONDO" : "IDA"
      }${tipo_vuelo.some(([_, escala]) => !!escala) ? " CON ESCALA" : ""}`,
      status: reserva.status,
      ida: {
        origen: {
          aeropuerto: vuelos[0].origen.nombre || null,
          ciudad: vuelos[0].origen.ciudad || null,
        },
        destino: {
          aeropuerto:
            vuelos[indiceVueloIdaDestino >= 0 ? indiceVueloIdaDestino : 0]
              .destino.nombre,
          ciudad:
            vuelos[indiceVueloIdaDestino >= 0 ? indiceVueloIdaDestino : 0]
              .destino.ciudad,
        },
      },
      regreso:
        indiceVueloRegresoOrigen > 0
          ? {
              origen: {
                aeropuerto:
                  vuelos[indiceVueloRegresoOrigen].origen.nombre || null,
                ciudad: vuelos[indiceVueloRegresoOrigen].origen.ciudad || null,
              },
              destino: {
                aeropuerto:
                  vuelos[
                    indiceVueloRegresoDestino > 0
                      ? indiceVueloRegresoDestino
                      : indiceVueloRegresoOrigen
                  ].destino.nombre,
                ciudad:
                  vuelos[
                    indiceVueloRegresoDestino > 0
                      ? indiceVueloRegresoDestino
                      : indiceVueloRegresoOrigen
                  ].destino.ciudad,
              },
            }
          : null,
      payment_status: "confirmado",
      total_passengers: 1,
      total: reserva.precio.toFixed(2),
    };

    const vuelosToCreate = vuelos.map((vuelo, index) => ({
      id_viaje_aereo,
      id_viajero: reserva.viajero.id_viajero,
      flight_number: vuelo.folio,
      airline: vuelo.aerolinea.nombre,
      airline_code: vuelo.aerolinea.id,
      airline_code: vuelo.aerolinea.id,
      departure: {
        airport: vuelo.origen.nombre,
        airport_code: vuelo.origen.id,
        city: vuelo.origen.ciudad || "",
        country: vuelo.origen.pais || "",
        date: vuelo.check_in.split("T")[0],
        time: vuelo.check_in.split("T")[1],
      },
      arrival: {
        airport: vuelo.destino.nombre,
        airport_code: vuelo.destino.id,
        city: vuelo.destino.ciudad || "",
        country: vuelo.destino.pais || "",
        date: vuelo.check_out.split("T")[0],
        time: vuelo.check_out.split("T")[1],
      },
      has_stops: vuelos.length > 1,
      stop_count: index + 1,
      stops: vuelos.length,
      seat_number: vuelo.asiento,
      seat_location: vuelo.ubicacion_asiento,
      rate_type: vuelo.tipo_tarifa,
      comentarios: vuelo.comentarios,
      fly_type: vuelo.tipo,
    }));

    //VALIDACIONES DE LOS DATOS DEL FRONT CON LOS DE LA BASE DE DATOS
    /**
     * credito del cliente
     * saldo de los saldos
     *
     */
    const [agente] = await executeQuery(
      `SELECT * FROM agente_details where id_agente = ?`,
      [id_agente]
    );
    console.log("\n\n", agente);
    if (!agente) throw new Error("No existe agente");
    if (faltante > 0 && Number(agente.saldo) < faltante)
      throw new Error("El agente no tiene el credito suficiente");
    if (saldos.length > 0) {
      const saldosDB = await executeQuery(
        `SELECT * FROM saldos_a_favor where id_saldos in (${saldos
          .map((s) => "?")
          .join(",")})`,
        saldos.map((s) => s.id_saldos)
      );
      console.log("saldosDB", saldosDB);
      //Verificar esta parte cuando se hagan los cargos a los saldos
      const isValidateSaldos = verificarSaldos([...saldosDB, ...saldos]);
      if (!isValidateSaldos)
        throw new Error("Los saldos no coinciden con los recibidos");
    }

    const precio = calcularPrecios(reserva.precio);

    //INSERCIONES EN LA BASE DE DATOS
    const response = runTransaction(async (connection) => {
      try {
        //SERVICIO
        const sqlInsertService = `
  INSERT INTO servicios (
    id_servicio,
    total,
    subtotal,
    impuestos,
    is_credito,
    id_agente
  ) VALUES (?, ?, ?, ?, ?, ?);
`;
        const paramsInsertService = [
          id_servicio, // No es NULL, no tiene un valor por defecto.
          precio.total, // No es NULL, no tiene un valor por defecto.
          precio.subtotal / 1.16, // No es NULL, no tiene un valor por defecto.
          precio.impuestos, // Puede ser NULL.
          faltante > 0, // Puede ser NULL y tiene un valor por defecto de '0'.
          id_agente, // Puede ser NULL.
        ];

        await connection.execute(sqlInsertService, paramsInsertService);

        const pagos = [];
        if (saldos.length > 0) {
          const insertPagosQuery = `
  INSERT INTO pagos (
    id_pago,
    id_servicio,
    responsable_pago_agente,
    fecha_creacion,
    total,
    subtotal,
    impuestos,
    concepto,
    referencia,
    fecha_pago,
    monto,
    banco,
    autorizacion_stripe,
    last_digits,
    fecha_transaccion,
    metodo_de_pago,
    tipo_de_tarjeta,
    tipo_de_pago,
    link_pago,
    id_saldo_a_favor,
    id_agente,
    is_facturado,
    monto_saldo,
    transaccion,
    monto_transaccion,
    estado,
    saldo_aplicado
  ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, NOW(), ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;
          const pagosToInsert = saldos.map((saldo) => {
            const id_credito = `pag-${uuidv4()}`;
            const precio_saldo = calcularPrecios(saldo);

            return [
              id_pago, // No es NULL, no tiene valor por defecto. Es la clave primaria.
              id_servicio, // No es NULL, no tiene valor por defecto. Es parte de la clave primaria.
              id_agente, // Puede ser NULL.
              precio_saldo.total, // Puede ser NULL.
              precio_saldo.subtotal, // Puede ser NULL.
              precio_saldo.impuestos, // Puede ser NULL.
              "Pago con saldo a favor", // Puede ser NULL.
              precio_saldo.total, // Puede ser NULL.
              saldo.banco_tarjeta || null, // Puede ser NULL.
              saldo.link_stripe || null, // Puede ser NULL.
              saldo.ult_digits || null, // Puede ser NULL.
              saldo.metodo_pago || null, // Puede ser NULL.
              saldo.tipo_tarjeta || null, // Puede ser NULL.
              "tipo_de_pago", // Puede ser NULL.
              "id_empresa", // Puede ser NULL.
              "link_pago", // Puede ser NULL.
              "id_saldo_a_favor", // Puede ser NULL.
              "id_agente", // Puede ser NULL.
              "is_facturado", // Puede ser NULL y tiene un valor por defecto de '0'.
              "monto_saldo", // Puede ser NULL.
              "transaccion", // Puede ser NULL.
              "monto_transaccion", // Puede ser NULL.
              "estado", // Puede ser NULL y tiene un valor por defecto de 'Confirmado'.
              "saldo_aplicado", // Puede ser NULL.
            ];
          });

          const pagosParams = [
            "id_pago", // No es NULL, no tiene valor por defecto. Es la clave primaria.
            "id_servicio", // No es NULL, no tiene valor por defecto. Es parte de la clave primaria.
            "monto_a_credito", // Puede ser NULL y tiene un valor por defecto de '0.00'.
            "responsable_pago_empresa", // Puede ser NULL.
            "responsable_pago_agente", // Puede ser NULL.
            "fecha_creacion", // No es NULL, no tiene valor por defecto.
            "pago_por_credito", // Puede ser NULL y tiene un valor por defecto de '0.00'.
            "pendiente_por_cobrar", // Puede ser NULL y tiene un valor por defecto de '0'.
            "total", // Puede ser NULL.
            "subtotal", // Puede ser NULL.
            "impuestos", // Puede ser NULL.
            "padre", // Puede ser NULL.
            "concepto", // Puede ser NULL.
            "referencia", // Puede ser NULL.
            "fecha_pago", // Puede ser NULL.
            "spei", // Puede ser NULL.
            "monto", // Puede ser NULL.
            "banco", // Puede ser NULL.
            "autorizacion_stripe", // Puede ser NULL.
            "last_digits", // Puede ser NULL.
            "fecha_transaccion", // Puede ser NULL.
            "currency", // Puede ser NULL y tiene un valor por defecto de 'mxn'.
            "metodo_de_pago", // Puede ser NULL.
            "tipo_de_tarjeta", // Puede ser NULL.
            "tipo_de_pago", // Puede ser NULL.
            "id_empresa", // Puede ser NULL.
            "link_pago", // Puede ser NULL.
            "id_saldo_a_favor", // Puede ser NULL.
            "id_agente", // Puede ser NULL.
            "is_facturado", // Puede ser NULL y tiene un valor por defecto de '0'.
            "monto_saldo", // Puede ser NULL.
            "transaccion", // Puede ser NULL.
            "monto_transaccion", // Puede ser NULL.
            "estado", // Puede ser NULL y tiene un valor por defecto de 'Confirmado'.
            "saldo_aplicado", // Puede ser NULL.
          ];

          // Ejemplo de uso:
          // await connection.execute(insertPagosQuery, pagosParams);
        }
        if (faltante > 0) {
          //PAGO A CREDITO
          const insertPagoCreditoQuery = `
  INSERT INTO pagos_credito (
    id_credito,
    id_servicio,
    monto_a_credito,
    responsable_pago_agente,
    fecha_creacion,
    pago_por_credito,
    pendiente_por_cobrar,
    total,
    subtotal,
    impuestos,
    concepto
  ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?);
`;
          const id_credito = `cre-${uuidv4()}`;
          const pagoCreditoParams = [
            id_credito, // No es NULL, no tiene valor por defecto. Es la clave primaria.
            id_servicio, // No es NULL, no tiene valor por defecto.
            precio.total, // No es NULL, no tiene valor por defecto.
            id_agente, // No es NULL, no tiene valor por defecto.
            precio.total, // No es NULL, no tiene valor por defecto.
            faltante.toFixed(2), // No es NULL, no tiene valor por defecto.
            precio.total, // No es NULL, no tiene valor por defecto.
            precio.subtotal, // No es NULL, no tiene valor por defecto.
            precio.impuestos, // No es NULL, no tiene valor por defecto.
            "Vuelo", // No es NULL, no tiene valor por defecto.
          ];

          await connection.execute(insertPagoCreditoQuery, pagoCreditoParams);
        }

        const sqlInsertBooking = `
  INSERT INTO bookings (
    id_booking,
    id_servicio,
    check_in,
    check_out,
    total,
    subtotal,
    impuestos,
    estado,
    costo_total,
    id_solicitud
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

        const paramsInsertBooking = [
          id_booking, // No es NULL, no tiene valor por defecto. Es parte de la clave primaria.
          id_servicio, // No es NULL, no tiene valor por defecto. Es parte de la clave primaria.
          vuelos[0].check_in, // No es NULL, no tiene valor por defecto.
          vuelos[vuelos.length - 1].check_out, // No es NULL, no tiene valor por defecto.
          precio.total, // No es NULL, no tiene valor por defecto.
          precio.subtotal / 1.16, // No es NULL, no tiene un valor por defecto.
          precio.impuestos, // Puede ser NULL.
          reserva.status, // Puede ser NULL y tiene un valor por defecto de 'En proceso'.
          reserva.costo.toFixed(2), // Puede ser NULL.
          id_solicitud, // Puede ser NULL.
        ];

        await connection.execute(sqlInsertBooking, paramsInsertBooking);

        const insertItemsQuery = `
  INSERT INTO items (
    id_item,
    id_catalogo_item,
    id_factura,
    total,
    subtotal,
    impuestos,
    is_facturado,
    fecha_uso,
    id_hospedaje,
    costo_total,
    costo_subtotal,
    costo_impuestos,
    saldo,
    costo_iva,
    is_ajuste,
    id_viaje_aereo
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

        const itemsParams = [
          "id_item", // No es NULL, no tiene valor por defecto. Es la clave primaria.
          "id_catalogo_item", // Puede ser NULL.
          "id_factura", // Puede ser NULL.
          "total", // No es NULL, no tiene valor por defecto.
          "subtotal", // No es NULL, no tiene valor por defecto.
          "impuestos", // No es NULL, no tiene valor por defecto.
          "is_facturado", // Puede ser NULL y tiene un valor por defecto de '0'.
          "fecha_uso", // No es NULL, no tiene valor por defecto.
          "id_hospedaje", // Puede ser NULL.
          "costo_total", // Puede ser NULL.
          "costo_subtotal", // Puede ser NULL.
          "costo_impuestos", // Puede ser NULL.
          faltante.toFixed(2), // Puede ser NULL. siempre va el faltante ya sea a credito o normal
          "costo_iva", // Puede ser NULL.
          "is_ajuste", // Puede ser NULL y tiene un valor por defecto de '0'.
          "id_viaje_aereo", // Puede ser NULL.
        ];

        // Ejemplo de uso:
        // await connection.execute(insertItemsQuery, itemsParams);

        const insertVuelosQuery = `
  INSERT INTO vuelos (
    id_viaje_aereo,
    id_viajero,
    flight_number,
    airline,
    airline_code,
    aircraft,
    aircraft_code,
    departure_airport,
    departure_airport_code,
    departure_city,
    departure_country,
    departure_date,
    departure_time,
    arrival_airport,
    arrival_airport_code,
    arrival_city,
    arrival_country,
    arrival_date,
    arrival_time,
    duration,
    has_stops,
    stop_count,
    stops,
    currency,
    baggage,
    amenities,
    cancellable,
    refundable,
    seat_number,
    seat_location,
    has_extra_legroom,
    is_emergency_exit,
    additional_fee,
    currency_seat,
    id_usuario_creador,
    id_usuario_modifica,
    rate_type,
    comentarios,
    fly_type
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

        const vuelosParams = [
          "id_viaje_aereo", // No es NULL, no tiene valor por defecto.
          "id_viajero", // No es NULL, no tiene valor por defecto.
          "flight_number", // Puede ser NULL.
          "airline", // No es NULL, no tiene valor por defecto.
          "airline_code", // No es NULL, no tiene valor por defecto.
          "aircraft", // Puede ser NULL.
          "aircraft_code", // Puede ser NULL.
          "departure_airport", // No es NULL, no tiene valor por defecto.
          "departure_airport_code", // No es NULL, no tiene valor por defecto.
          "departure_city", // No es NULL, no tiene valor por defecto.
          "departure_country", // No es NULL, no tiene valor por defecto.
          "departure_date", // No es NULL, no tiene valor por defecto.
          "departure_time", // No es NULL, no tiene valor por defecto.
          "arrival_airport", // No es NULL, no tiene valor por defecto.
          "arrival_airport_code", // No es NULL, no tiene valor por defecto.
          "arrival_city", // No es NULL, no tiene valor por defecto.
          "arrival_country", // No es NULL, no tiene valor por defecto.
          "arrival_date", // No es NULL, no tiene valor por defecto.
          "arrival_time", // No es NULL, no tiene valor por defecto.
          "duration", // Puede ser NULL.
          "has_stops", // Puede ser NULL y tiene un valor por defecto de '0'.
          "stop_count", // Puede ser NULL y tiene un valor por defecto de '0'.
          "stops", // Puede ser NULL.
          "currency", // Puede ser NULL y tiene un valor por defecto de 'MXN'.
          "baggage", // Puede ser NULL.
          "amenities", // Puede ser NULL.
          "cancellable", // Puede ser NULL y tiene un valor por defecto de '1'.
          "refundable", // Puede ser NULL y tiene un valor por defecto de '0'.
          "seat_number", // No es NULL, no tiene valor por defecto.
          "seat_location", // No es NULL, no tiene valor por defecto.
          "has_extra_legroom", // Puede ser NULL.
          "is_emergency_exit", // Puede ser NULL.
          "additional_fee", // Puede ser NULL y tiene un valor por defecto de '0.00'.
          "currency_seat", // Puede ser NULL.
          "id_usuario_creador", // Puede ser NULL.
          "id_usuario_modifica", // Puede ser NULL.
          "rate_type", // Puede ser NULL.
          "comentarios", // Puede ser NULL.
          "fly_type", // Puede ser NULL.
        ];

        // Ejemplo de uso:
        // await connection.execute(insertVuelosQuery, vuelosParams);

        const insertItemsPagosQuery = `
  INSERT INTO items_pagos (
    id_item,
    id_pago,
    monto
  ) VALUES (?, ?, ?);
`;

        const itemsPagosParams = [
          "id_item", // No es NULL, no tiene valor por defecto. Es parte de la clave primaria.
          "id_pago", // No es NULL, no tiene valor por defecto. Es parte de la clave primaria.
          "monto", // No es NULL, no tiene valor por defecto.
        ];

        // Ejemplo de uso:
        // await connection.execute(insertItemsPagosQuery, itemsPagosParams);

        const insertSolicitudesQuery = `
  INSERT INTO solicitudes (
    id_solicitud,
    id_servicio,
    confirmation_code,
    id_viajero,
    hotel,
    check_in,
    check_out,
    room,
    total,
    status,
    id_usuario_generador,
    nombre_viajero,
    viajeros_adicionales,
    id_agente,
    id_hotel,
    id_acompanantes,
    usuario_creador,
    origen,
    vuelo
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

        const solicitudesParams = [
          "id_solicitud", // No es NULL, no tiene valor por defecto. Es la clave primaria.
          "id_servicio", // Puede ser NULL.
          "confirmation_code", // No es NULL, no tiene valor por defecto.
          "id_viajero", // No es NULL, no tiene valor por defecto.
          "hotel", // Puede ser NULL.
          "check_in", // Puede ser NULL.
          "check_out", // Puede ser NULL.
          "room", // Puede ser NULL.
          "total", // No es NULL, no tiene valor por defecto.
          "status", // No es NULL y tiene un valor por defecto de 'pending'.
          "id_usuario_generador", // Puede ser NULL.
          "nombre_viajero", // Puede ser NULL.
          "viajeros_adicionales", // Puede ser NULL.
          "id_agente", // Puede ser NULL.
          "id_hotel", // Puede ser NULL.
          "id_acompanantes", // Puede ser NULL.
          "usuario_creador", // Puede ser NULL.
          "origen", // Puede ser NULL.
          "vuelo", // Puede ser NULL.
        ];

        // Ejemplo de uso:
        // await connection.execute(insertSolicitudesQuery, solicitudesParams);

        const insertViajesAereosQuery = `
  INSERT INTO viajes_aereos (
    id_viaje_aereo,
    id_booking,
    id_servicio,
    trip_type,
    status,
    payment_status,
    total_passengers,
    aeropuerto_origen,
    ciudad_origen,
    aeropuerto_destino,
    ciudad_destino,
    regreso_aeropuerto_origen,
    regreso_ciudad_origen,
    regreso_aeropuerto_destino,
    regreso_ciudad_destino,
    adults,
    children,
    infants,
    subtotal,
    taxes,
    fees,
    total,
    currency,
    cancellation_policies,
    codigo_confirmacion
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

        const viajesAereosParams = [
          "id_viaje_aereo", // No es NULL, no tiene valor por defecto. Es la clave primaria.
          "id_booking", // No es NULL, no tiene valor por defecto.
          "id_servicio", // No es NULL, no tiene valor por defecto.
          "trip_type", // No es NULL, no tiene valor por defecto.
          "status", // No es NULL y tiene un valor por defecto de 'pending'.
          "payment_status", // No es NULL y tiene un valor por defecto de 'pending'.
          "total_passengers", // No es NULL, no tiene valor por defecto.
          "aeropuerto_origen", // Puede ser NULL.
          "ciudad_origen", // Puede ser NULL.
          "aeropuerto_destino", // Puede ser NULL.
          "ciudad_destino", // Puede ser NULL.
          "regreso_aeropuerto_origen", // Puede ser NULL.
          "regreso_ciudad_origen", // Puede ser NULL.
          "regreso_aeropuerto_destino", // Puede ser NULL.
          "regreso_ciudad_destino", // Puede ser NULL.
          "adults", // Puede ser NULL.
          "children", // Puede ser NULL y tiene un valor por defecto de '0'.
          "infants", // Puede ser NULL y tiene un valor por defecto de '0'.
          "subtotal", // Puede ser NULL.
          "taxes", // Puede ser NULL.
          "fees", // Puede ser NULL y tiene un valor por defecto de '0.00'.
          "total", // No es NULL, no tiene valor por defecto.
          "currency", // Puede ser NULL y tiene un valor por defecto de 'MXN'.
          "cancellation_policies", // Puede ser NULL.
          "codigo_confirmacion", // Puede ser NULL.
        ];

        // Ejemplo de uso:
        // await connection.execute(insertViajesAereosQuery, viajesAereosParams);
      } catch (error) {
        throw error;
      }
    });

    res.status(200).json({
      message: "Reservación creada con exito",
      data: { vuelos: vuelosToCreate, ...viaje_aereo },
    });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

module.exports = {
  crearVuelo,
};
