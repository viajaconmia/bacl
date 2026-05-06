const { executeQuery, runTransaction } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
const { verificarSaldos } = require("../../../lib/utils/validates");
const { calcularPrecios, Calculo } = require("../../../lib/utils/calculates");
const { formateoViajeAereo } = require("../../../lib/utils/formats");
const ERROR = require("../../../lib/utils/messages");
const Servicio = require("../../../v2/model/servicios.model");
const ViajeAereo = require("../../../v2/model/viaje_aereo.model");
const { ca } = require("zod/locales");
const {
  procesarSolicitudProveedorAlEditarReserva,
} = require("../../../v2/controller/reservas.controller");
const { notificado } = require("./avisos_reservas");
// const Booking = require("../../../v2/model/bookings.model");
// const Item = require("../../../v2/model/model/item.model");

const getVuelos = async (req, res) => {
  try {
    const viajes_aereos =
      await executeQuery(`select va.*, ad.id_agente, ad.nombre from viajes_aereos va
inner join servicios s on s.id_servicio = va.id_servicio
inner join agente_details ad on ad.id_agente = s.id_agente;`);
    res.status(200).json({ data: viajes_aereos, message: "" });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

const getVuelosCupon = async (req, res) => {
  try {
    const {
      page = 1,
      created_inicio,
      created_fin,
      viajero,
      codigo_confirmacion,
    } = req.query;

    const pageNumber = Number(page) || 1;
    const pageSize = 50;
    const offset = (pageNumber - 1) * pageSize;

    let where = [];
    let params = [];

    /* =========================
       FECHA CREACIÓN
    ========================= */
    if (created_inicio && created_fin) {
      where.push(`va.created_at BETWEEN ? AND ?`);
      params.push(created_inicio, created_fin);
    }

    /* =========================
       VIAJERO (texto)
    ========================= */
    if (viajero) {
      where.push(`
        CONCAT_WS(
          ' ',
          vi.primer_nombre,
          vi.segundo_nombre,
          vi.apellido_paterno,
          vi.apellido_materno
        ) LIKE ?
      `);
      params.push(`%${viajero}%`);
    }

    /* =========================
       CÓDIGO CONFIRMACIÓN
    ========================= */
    if (codigo_confirmacion) {
      where.push(`va.codigo_confirmacion LIKE ?`);
      params.push(`%${codigo_confirmacion}%`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    /* =========================
       TOTAL
    ========================= */
    const totalQuery = `
      SELECT COUNT(DISTINCT va.id_viaje_aereo) AS total
      FROM vw_viaje_aereo va
      LEFT JOIN viajeros vi ON vi.id_viajero = va.id_viajero
      ${whereSQL}
    `;

    const [totalRow] = await executeQuery(totalQuery, params);
    const total = totalRow.total;

    /* =========================
       DATA PAGINADA
    ========================= */
    const dataQuery = `
  SELECT va.*
  FROM vw_viaje_aereo va
  LEFT JOIN viajeros vi ON vi.id_viajero = va.id_viajero
  ${whereSQL}
  ORDER BY va.created_at DESC
  LIMIT ${pageSize} OFFSET ${offset}
`;

    const data = await executeQuery(dataQuery, params);

    res.status(200).json({
      data,
      metadata: {
        total,
        page: Number(page),
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      message: "",
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      data: null,
      error,
    });
  }
};

const getVueloById = async (req, res) => {
  try {
    const { id } = req.query;
    console.log("\n\nid del vuelo", id);

    const [viaje_aereo] = await executeQuery(
      `SELECT * FROM viajes_aereos WHERE id_booking = ?`,
      [id],
    );
    if (!viaje_aereo) throw new Error("No se encontró el viaje aéreo");

    let vuelos = await executeQuery(
      `select * from vuelos where id_viaje_aereo = ?`,
      [viaje_aereo.id_viaje_aereo],
    );

    const [viajero] = await executeQuery(
      `SELECT av.id_agente, v.*, CONCAT_WS(' ', v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno) AS nombre_completo FROM agentes_viajeros av
      LEFT JOIN viajeros v on v.id_viajero = av.id_viajero
    WHERE av.id_viajero = ?`,
      [viaje_aereo.id_viajero],
    );

    const aeropuertos = await executeQuery(
      `SELECT Codigo_IATA as codigo, id_destino as id, NomeES as nombre, Ubicacion as ciudad, Nombre_pais as pais FROM destinos WHERE id_destino in (${vuelos
        .map(() => "?,?")
        .join(",")})`,
      vuelos.flatMap((vuelo) => [
        vuelo.departure_airport_code,
        vuelo.arrival_airport_code,
      ]),
    );

    const [booking] = await executeQuery(
      `select * from bookings where id_booking = ?`,
      [id],
    );

    const proveedores = await executeQuery(
      `SELECT * FROM proveedores WHERE id in (${[
        ...vuelos.map(() => "?"),
        viaje_aereo.id_intermediario ? "?" : null,
      ]
        .filter(Boolean)
        .join(",")})`,
      [
        ...vuelos.map((v) => v.id_proveedor),
        viaje_aereo.id_intermediario ? viaje_aereo.id_intermediario : null,
      ].filter(Boolean),
    );

    console.log(proveedores);

    const vuelosFromViaje = vuelos.map((vuelo) => ({
      id: vuelo.id_vuelo,
      tipo: vuelo.fly_type,
      folio: vuelo.flight_number,
      origen: aeropuertos.find(
        (aeropuerto) => aeropuerto.id == vuelo.departure_airport_code,
      ),
      destino: aeropuertos.find(
        (aeropuerto) => aeropuerto.id == vuelo.arrival_airport_code,
      ),
      check_in: `${vuelo.departure_date.toISOString().split("T")[0]}T${
        vuelo.departure_time
      }`,
      check_out: `${vuelo.arrival_date.toISOString().split("T")[0]}T${
        vuelo.arrival_time
      }`,
      aerolinea: proveedores.find((p) => p.id == vuelo.id_proveedor),
      asiento: vuelo.seat_number,
      ubicacion_asiento: vuelo.seat_location,
      comentarios: vuelo.comentarios,
      tipo_tarifa: vuelo.rate_type,
      eq_mano: vuelo.eq_mano,
      eq_personal: vuelo.eq_personal,
      eq_documentado: vuelo.eq_documentado,
    }));

    res.status(200).json({
      data: {
        status: viaje_aereo.status,
        precio: viaje_aereo.total,
        codigo: viaje_aereo.codigo_confirmacion,
        costo: booking.costo_total,
        intermediario: proveedores.find(
          (p) => p.id == viaje_aereo.id_intermediario,
        ),
        vuelos: vuelosFromViaje,
        viajero,
      },
      message: "",
    });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

const crearVuelo = async (req, res) => {
  try {
    //EXTRACCIÓN, VALIDACIÓN Y FORMATEO DE DATOS
    let { id_agente } = req.body;

    if (req.body.vuelos.length == 0)
      throw new Error("No se encontraron vuelos");

    const {
      faltante,
      reserva,
      saldos,
      vuelos,
      id_booking,
      id_servicio,
      viaje_aereo,
      indiceVueloRegresoOrigen,
    } = formateoViajeAereo(
      req.body.faltante,
      req.body.reserva,
      req.body.saldos,
      req.body.vuelos,
    );

    const id_solicitud = `sol-${uuidv4()}`;
    const id_transaccion = `tra-${uuidv4()}`;

    const [agente] = await executeQuery(
      `SELECT * FROM agente_details where id_agente = ?`,
      [id_agente],
    );
    if (!agente) throw new Error("No existe agente");
    if (faltante > 0 && Number(agente.saldo) < faltante)
      throw new Error("El agente no tiene el credito suficiente");
    if (saldos.length > 0) {
      const saldosDB = await executeQuery(
        `SELECT * FROM saldos_a_favor where id_saldos in (${saldos
          .map((s) => "?")
          .join(",")})`,
        saldos.map((s) => s.id_saldos),
      );
      //Verificar esta parte cuando se hagan los cargos a los saldos
      const isValidateSaldos = verificarSaldos([...saldosDB, ...saldos]);
      if (!isValidateSaldos)
        throw new Error("Los saldos no coinciden con los recibidos");
    }

    const precio = calcularPrecios(reserva.precio);

    //INSERCIONES EN LA BASE DE DATOS
    const response = await runTransaction(async (connection) => {
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
          ) VALUES (?, ?, ?, ?, ?, ?);`;
        const paramsInsertService = [
          id_servicio, // No es NULL, no tiene un valor por defecto.
          precio.total, // No es NULL, no tiene un valor por defecto.
          precio.subtotal / 1.16, // No es NULL, no tiene un valor por defecto.
          precio.impuestos, // Puede ser NULL.
          faltante > 0, // Puede ser NULL y tiene un valor por defecto de '0'.
          id_agente, // Puede ser NULL.
        ];

        await connection.execute(sqlInsertService, paramsInsertService);

        const insertSolicitudesQuery = `
          INSERT INTO solicitudes (
            id_solicitud,
            id_servicio,
            confirmation_code,
            id_viajero,
            check_in,
            check_out,
            total,
            id_usuario_generador,
            id_agente,
            usuario_creador,
            origen,
            vuelo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

        const solicitudesParams = [
          id_solicitud, // No es NULL, no tiene valor por defecto. Es la clave primaria.
          id_servicio, // Puede ser NULL.
          `VUE-${(Math.random() * 99999999).toFixed(0)}`, // No es NULL, no tiene valor por defecto.
          reserva.viajero.id_viajero, // No es NULL, no tiene valor por defecto.
          vuelos[0].check_in, // Puede ser NULL.
          indiceVueloRegresoOrigen > 1
            ? vuelos[indiceVueloRegresoOrigen].check_in
            : null, // Puede ser NULL.
          precio.total, // No es NULL, no tiene valor por defecto.
          id_agente, // Puede ser NULL.
          id_agente, // Puede ser NULL.
          req?.session?.id || null, // Puede ser NULL.
          "Operaciones", // Puede ser NULL.
          {
            tipo: viaje_aereo.trip_type,
            escalas_preferencia: null,
            maleta: false,
            origen: vuelos[0].origen,
            destino:
              vuelos[
                indiceVueloRegresoOrigen > 1
                  ? indiceVueloRegresoOrigen - 1
                  : vuelos.length - 1
              ].destino,
            salida: vuelos[0].check_in,
            regreso:
              indiceVueloRegresoOrigen > 1
                ? vuelos[indiceVueloRegresoOrigen].check_in
                : null,
            horario_salida: null,
            horario_regreso: null,
            numero_personas: 1,
            seleccion_asiento: false,
            tarifa_flexible: false,
            comentarios: "",
          },
        ];

        // Ejemplo de uso:
        console.log((insertSolicitudesQuery, solicitudesParams));
        await connection.execute(insertSolicitudesQuery, solicitudesParams);

        const pagos_to_item_pagos = [];
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
              saldo_aplicado
            ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, NOW(), ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
          const pagosToInsert = saldos.map((saldo) => {
            const id_pago = `pag-${uuidv4()}`;
            const precio_saldo = calcularPrecios(Number(saldo.saldo_usado));
            pagos_to_item_pagos.push({ id_pago, monto: saldo.saldo_usado });

            return [
              id_pago, // No es NULL, no tiene valor por defecto. Es la clave primaria.
              id_servicio, // No es NULL, no tiene valor por defecto. Es parte de la clave primaria.
              id_agente, // Puede ser NULL.
              precio_saldo.total, // Puede ser NULL.
              precio_saldo.subtotal, // Puede ser NULL.
              precio_saldo.impuestos, // Puede ser NULL.
              "Pago con saldo a favor", // Puede ser NULL.
              saldo.referencia,
              precio_saldo.total, // Puede ser NULL.
              saldo.banco_tarjeta || null, // Puede ser NULL.
              saldo.link_stripe || null, // Puede ser NULL.
              saldo.ult_digits || null, // Puede ser NULL.
              saldo.metodo_pago || null, // Puede ser NULL.
              saldo.tipo_tarjeta || null, // Puede ser NULL.
              faltante > 0 ? null : "contado", // Puede ser NULL.
              saldo.link_stripe, // Puede ser NULL.
              saldo.id_saldos, // Puede ser NULL.
              id_agente, // Puede ser NULL.
              false, // Puede ser NULL y tiene un valor por defecto de '0'.
              saldo.monto, // Puede ser NULL.
              id_transaccion, // Puede ser NULL.
              (reserva.precio - faltante).toFixed(2), // Puede ser NULL.
              saldo.saldo_usado, // Puede ser NULL.
            ];
          });

          await Promise.all(
            pagosToInsert.map((paramPago) =>
              connection.execute(insertPagosQuery, paramPago),
            ),
          );
        }
        const id_credito = `cre-${uuidv4()}`;
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
            ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?);`;

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
        if (faltante > 0 && saldos.length > 0) {
          await Promise.all(
            pagos_to_item_pagos.map(({ id_pago, monto }) =>
              connection.execute(
                `INSERT INTO relacion_credito_pago 
                (id_credito, id_pago, monto_del_pago, restante)
                VALUES (?, ?, ?, ?)`,
                [id_credito, id_pago, monto, faltante],
              ),
            ),
          );
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
            id_solicitud,
            usuario_creador
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?);`;

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
          req?.session?.user?.id,
        ];

        await connection.execute(sqlInsertBooking, paramsInsertBooking);

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
            subtotal,
            taxes,
            total,
            codigo_confirmacion,
            id_intermediario,
            id_viajero
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

        const viajesAereosParams = [
          viaje_aereo.id_viaje_aereo, // No es NULL, no tiene valor por defecto. Es la clave primaria.
          viaje_aereo.id_booking, // No es NULL, no tiene valor por defecto.
          viaje_aereo.id_servicio, // No es NULL, no tiene valor por defecto.
          viaje_aereo.trip_type, // No es NULL, no tiene valor por defecto.
          viaje_aereo.status, // No es NULL y tiene un valor por defecto de 'pending'.
          viaje_aereo.payment_status, // No es NULL y tiene un valor por defecto de 'pending'.
          viaje_aereo.total_passengers, // No es NULL, no tiene valor por defecto.
          viaje_aereo.ida.origen.aeropuerto, // Puede ser NULL.
          viaje_aereo.ida.origen.ciudad, // Puede ser NULL.
          viaje_aereo.ida.destino.aeropuerto, // Puede ser NULL.
          viaje_aereo.ida.destino.ciudad, // Puede ser NULL.
          viaje_aereo.regreso?.origen.aeropuerto || null, // Puede ser NULL.
          viaje_aereo.regreso?.origen.ciudad || null, // Puede ser NULL.
          viaje_aereo.regreso?.destino.aeropuerto || null, // Puede ser NULL.
          viaje_aereo.regreso?.destino.ciudad || null, // Puede ser NULL.
          precio.subtotal, // Puede ser NULL.
          precio.impuestos, // Puede ser NULL.
          precio.total, // No es NULL, no tiene valor por defecto.
          viaje_aereo.codigo_confirmation, // Puede ser NULL.
          req?.body?.reserva?.intermediario?.id || null,
          req.body?.reserva.viajero?.id_viajero || null,
        ];

        await connection.execute(insertViajesAereosQuery, viajesAereosParams);

        const insertItemsQuery = `
          INSERT INTO items (
            id_item,
            total,
            subtotal,
            impuestos,
            fecha_uso,
            costo_total,
            saldo,
            id_viaje_aereo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

        const id_item = `ite-${uuidv4()}`;
        //TODO: REVISAR EL ID_FACTURA, PORQUE SI EL SALDO YA FUE FACTURADO DEBE TENER ID_FACTURA PERO PUEDE QUE TENGA MUCHOS SALDOS Y MUCHAS FACTURAS Y ESO AUN NO SE PUEDE
        const itemsParams = [
          id_item, // No es NULL, no tiene valor por defecto. Es la clave primaria.
          precio.total, // No es NULL, no tiene valor por defecto.
          precio.subtotal, // No es NULL, no tiene valor por defecto.
          precio.impuestos, // No es NULL, no tiene valor por defecto.
          vuelos[0].check_in, // No es NULL, no tiene valor por defecto.
          reserva.costo, // Puede ser NULL.
          faltante.toFixed(2), // Puede ser NULL. siempre va el faltante ya sea a credito o normal
          viaje_aereo.id_viaje_aereo, // Puede ser NULL.
        ];

        await connection.execute(insertItemsQuery, itemsParams);

        const insertItemsPagosQuery = `
          INSERT INTO items_pagos (
            id_item,
            id_pago,
            monto
          ) VALUES (?, ?, ?);`;
        await Promise.all(
          pagos_to_item_pagos.map(({ id_pago, monto }) =>
            connection.execute(insertItemsPagosQuery, [
              id_item,
              id_pago,
              monto,
            ]),
          ),
        );

        const insertVuelosQuery = `
          INSERT INTO vuelos (
            id_viaje_aereo,
            flight_number,
            airline,
            id_proveedor,
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
            has_stops,
            stop_count,
            stops,
            seat_number,
            seat_location,
            id_usuario_creador,
            rate_type,
            comentarios,
            fly_type,
            eq_mano,
            eq_personal,
            eq_documentado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

        console.log("INSERT VUELOS QUERY:", vuelos);

        await Promise.all(
          vuelos.map((vuelo) =>
            connection.execute(insertVuelosQuery, [
              vuelo.id_viaje_aereo || null, // No es NULL, no tiene valor por defecto.
              vuelo.flight_number || null, // Puede ser NULL.
              vuelo.aerolinea.proveedor || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.airline_code || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.departure.airport || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.departure.airport_code || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.departure.city || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.departure.country || "", // No es NULL||null, no tiene valor por defecto.
              vuelo.departure.date || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.departure.time || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.arrival.airport || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.arrival.airport_code || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.arrival.city || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.arrival.country || "", // No es NULL||null, no tiene valor por defecto.
              vuelo.arrival.date || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.arrival.time,
              vuelo.has_stops || null, // Puede ser NULL y tiene un valor por defecto de '0'.
              vuelo.stop_count || null, // Puede ser NULL y tiene un valor por defecto de '0'.
              vuelo.stops || null, // Puede ser NULL.
              vuelo.seat_number || null, // No es NULL||null, no tiene valor por defecto.
              vuelo.seat_location || null, // No es NULL||null, no tiene valor por defecto.
              req?.session?.id || "general" || null, // Puede ser NULL.
              vuelo.rate_type || null, // Puede ser NULL.
              vuelo.comentarios || null, // Puede ser NULL.
              vuelo.fly_type || null, // Puede ser NULL.
              vuelo.eq_mano || null,
              vuelo.eq_personal || null,
              vuelo.eq_documentado || null,
            ]),
          ),
        );

        //Falta editar credito y asi
        if (faltante > 0) {
          await connection.execute(
            `UPDATE agentes SET saldo = saldo - ? where id_agente = ?`,
            [faltante, id_agente],
          );
        }
        if (saldos.length > 0) {
          await Promise.all(
            saldos.map((saldo) =>
              connection.execute(
                `UPDATE saldos_a_favor SET saldo = ? where id_saldos = ?`,
                [saldo.restante, saldo.id_saldos],
              ),
            ),
          );
        }
      } catch (error) {
        throw error;
      }
    });

    res.status(200).json({
      message: "Reservación creada con exito",
      data: { vuelos: vuelos, ...viaje_aereo },
    });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

const editarVuelo = async (req, res) => {
  try {
    const { cambios, viaje_aereo: data_meta } = req.body;

    const [viaje_aereo_db] = await executeQuery(
      `SELECT * FROM vw_new_reservas WHERE id_booking = ?`,
      [data_meta.id_booking],
    );
    if (!viaje_aereo_db || viaje_aereo_db.length === 0) {
      throw new Error("No se encontró el viaje aéreo");
    }

    const formaters = formateoViajeAereo(
      req.body?.faltante || 0,
      req.body.current,
      req.body?.saldos || [],
      req.body.current.vuelos,
      viaje_aereo_db,
    );
    const { vuelos, viaje_aereo, reserva } = formaters;
    const {
      vuelos: vuelosBefore,
      viaje_aereo: viaje_aereoBefore,
      reserva: reservaBefore,
    } = formateoViajeAereo(
      req.body?.faltante || 0,
      req.body.before,
      req.body?.saldos || [],
      req.body.before.vuelos,
      viaje_aereo_db,
    );

    if (cambios.keys.length == 0) throw new Error(ERROR.CHANGES.EMPTY);

    let diferencia_ajuste = 0;
    let precio_ajuste = null;
    let precio_nuevo = null;
    let items_con_nuevos_totales = [];
    let id_relacion_db = null;
    let pagos_con_saldo = [];
    if (cambios.keys.includes("precio")) {
      diferencia_ajuste =
        cambios.logs.precio.current - cambios.logs.precio.before;
      if (diferencia_ajuste > 0) {
        const [agente] = await executeQuery(
          `SELECT * FROM agente_details WHERE id_agente = ?`,
          [data_meta.id_agente],
        );
        if (!agente) throw new Error("No existe agente");
        if (Number(agente.saldo) < diferencia_ajuste)
          throw new Error("El agente no tiene el crédito suficiente");
        precio_ajuste = calcularPrecios(diferencia_ajuste);
        precio_nuevo = calcularPrecios(cambios.logs.precio.current);
      } else if (diferencia_ajuste < 0) {
        precio_ajuste = calcularPrecios(Math.abs(diferencia_ajuste));
        precio_nuevo = calcularPrecios(cambios.logs.precio.current);

        const items_db = await executeQuery(
          `SELECT id_item FROM items WHERE id_viaje_aereo = ?`,
          [viaje_aereo_db.id_viaje_aereo],
        );

        const [booking_details] = await executeQuery(
          `SELECT id_relacion FROM vw_details_booking WHERE id_booking = ?`,
          [data_meta.id_booking],
        );
        id_relacion_db = booking_details?.id_relacion || null;

        pagos_con_saldo = await executeQuery(
          `SELECT id_pago, id_saldo_a_favor,
                  COALESCE(saldo_aplicado, monto_saldo, monto, 0) AS monto_aplicado
           FROM pagos
           WHERE id_servicio = ? AND id_saldo_a_favor IS NOT NULL`,
          [viaje_aereo_db.id_servicio],
        );

        const nuevo_total_num = Number(cambios.logs.precio.current);
        const n = items_db.length;
        const total_por_item = Number((nuevo_total_num / n).toFixed(2));
        let acumulado = 0;
        items_con_nuevos_totales = items_db.map((item, i) => {
          const total_item =
            i === n - 1
              ? Number((nuevo_total_num - acumulado).toFixed(2))
              : (() => {
                  acumulado += total_por_item;
                  return total_por_item;
                })();
          const calculo = calcularPrecios(total_item);
          return {
            id_item: item.id_item,
            nuevo_total: calculo.total,
            nuevo_subtotal: calculo.subtotal,
            nuevo_impuestos: calculo.impuestos,
          };
        });
      }
    }

    const response = await runTransaction(async (connection) => {
      try {
        await notificado({
          connection,
          id_booking: viaje_aereo_db.id_booking,
          body: {
            cambios: (Object.entries(cambios?.logs) || []).reduce(
              (curr, [key, value]) => {
                curr["current"] = { ...curr["current"], [key]: value.current };
                curr["before"] = { ...curr["before"], [key]: value.before };
                return curr;
              },
              { current: {}, before: {} },
            ),
          },
          id_user: req?.session?.user?.id || null,
        });
        await procesarSolicitudProveedorAlEditarReserva({
          connection,
          metadata: {
            id_booking: viaje_aereo_db.id_booking,
            cambios,
            viaje_aereo,
            viaje_aereoBefore,
            vuelos,
            vuelosBefore,
            reserva,
            reservaBefore,
          },
          usuario: req?.session?.user?.id || req?.user?.email || "system",
        });
        console.log("cambios", viaje_aereo_db);
        console.log("reserva", reserva);
        if (cambios.keys.includes("costo")) {
          await connection.execute(
            `UPDATE bookings SET costo_total = ? WHERE id_booking = ?`,
            [reserva.costo, viaje_aereo_db.id_booking],
          );
          await connection.execute(
            `UPDATE items SET costo_total = ? WHERE id_viaje_aereo = ?`,
            [reserva.costo, viaje_aereo_db.id_viaje_aereo],
          );
        }
        if (precio_ajuste && diferencia_ajuste > 0) {
          await connection.execute(
            `UPDATE servicios SET total = total + ?, subtotal = subtotal + ?, impuestos = impuestos + ? WHERE id_servicio = ?`,
            [
              precio_ajuste.total,
              Number(precio_ajuste.subtotal) / 1.16,
              precio_ajuste.impuestos,
              viaje_aereo_db.id_servicio,
            ],
          );
          await connection.execute(
            `UPDATE bookings SET total = ? WHERE id_booking = ?`,
            [precio_nuevo.total, viaje_aereo_db.id_booking],
          );
          await connection.execute(
            `UPDATE viajes_aereos SET total = ?, subtotal = ?, taxes = ? WHERE id_viaje_aereo = ?`,
            [
              precio_nuevo.total,
              precio_nuevo.subtotal,
              precio_nuevo.impuestos,
              viaje_aereo_db.id_viaje_aereo,
            ],
          );
          const id_item_ajuste = `ite-${uuidv4()}`;
          await connection.execute(
            `INSERT INTO items (id_item, total, subtotal, impuestos, fecha_uso, costo_total, saldo, id_viaje_aereo, is_ajuste) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, 1)`,
            [
              id_item_ajuste,
              precio_ajuste.total,
              precio_ajuste.subtotal,
              precio_ajuste.impuestos,
              null,
              diferencia_ajuste.toFixed(2),
              viaje_aereo_db.id_viaje_aereo,
            ],
          );
          const id_credito_ajuste = `cre-${uuidv4()}`;
          await connection.execute(
            `INSERT INTO pagos_credito (id_credito, id_servicio, monto_a_credito, responsable_pago_agente, fecha_creacion, pago_por_credito, pendiente_por_cobrar, total, subtotal, impuestos, concepto) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
            [
              id_credito_ajuste,
              viaje_aereo_db.id_servicio,
              precio_ajuste.total,
              data_meta.id_agente,
              precio_ajuste.total,
              diferencia_ajuste.toFixed(2),
              precio_ajuste.total,
              precio_ajuste.subtotal,
              precio_ajuste.impuestos,
              "Ajuste de precio - Vuelo",
            ],
          );
          await connection.execute(
            `UPDATE agentes SET saldo = saldo - ? WHERE id_agente = ?`,
            [diferencia_ajuste, data_meta.id_agente],
          );
        } else if (precio_ajuste && diferencia_ajuste < 0) {
          await connection.execute(
            `UPDATE servicios SET total = total - ?, subtotal = subtotal - ?, impuestos = impuestos - ? WHERE id_servicio = ?`,
            [
              precio_ajuste.total,
              Number(precio_ajuste.subtotal) / 1.16,
              precio_ajuste.impuestos,
              viaje_aereo_db.id_servicio,
            ],
          );
          await connection.execute(
            `UPDATE bookings SET total = ? WHERE id_booking = ?`,
            [precio_nuevo.total, viaje_aereo_db.id_booking],
          );
          await connection.execute(
            `UPDATE viajes_aereos SET total = ?, subtotal = ?, taxes = ? WHERE id_viaje_aereo = ?`,
            [
              precio_nuevo.total,
              precio_nuevo.subtotal,
              precio_nuevo.impuestos,
              viaje_aereo_db.id_viaje_aereo,
            ],
          );
          await Promise.all(
            items_con_nuevos_totales.map(async (item) => {
              const [rowsPagos] = await connection.execute(
                `SELECT COALESCE(SUM(monto), 0) AS pagado FROM items_pagos WHERE id_item = ?`,
                [item.id_item],
              );
              const pagado = Number(rowsPagos?.[0]?.pagado || 0);
              const nuevoSaldo = Math.max(Number(item.nuevo_total) - pagado, 0);
              await connection.execute(
                `UPDATE items SET total = ?, subtotal = ?, impuestos = ?, saldo = ? WHERE id_item = ?`,
                [
                  item.nuevo_total,
                  item.nuevo_subtotal,
                  item.nuevo_impuestos,
                  nuevoSaldo.toFixed(2),
                  item.id_item,
                ],
              );
            }),
          );
          const monto_a_devolver = Math.abs(diferencia_ajuste);
          const total_pagado_con_saldo = pagos_con_saldo.reduce(
            (sum, p) => sum + Number(p.monto_aplicado),
            0,
          );
          const retorno_a_saldos = Number(
            Math.min(monto_a_devolver, total_pagado_con_saldo).toFixed(2),
          );
          const retorno_a_credito = Number(
            (monto_a_devolver - retorno_a_saldos).toFixed(2),
          );

          let pendiente_saldo = retorno_a_saldos;
          for (const pago of pagos_con_saldo) {
            if (pendiente_saldo <= 0) break;
            const devolver_este = Number(
              Math.min(Number(pago.monto_aplicado), pendiente_saldo).toFixed(2),
            );
            if (devolver_este > 0) {
              await connection.execute(
                `UPDATE saldos_a_favor SET saldo = saldo + ?, activo = 1, updated_at = NOW() WHERE id_saldos = ?`,
                [devolver_este, pago.id_saldo_a_favor],
              );
              await connection.execute(
                `UPDATE pagos SET saldo_aplicado = GREATEST(0, COALESCE(saldo_aplicado, 0) - ?) WHERE id_pago = ?`,
                [devolver_este, pago.id_pago],
              );
              pendiente_saldo = Number(
                (pendiente_saldo - devolver_este).toFixed(2),
              );
            }
          }
          if (retorno_a_credito > 0) {
            await connection.execute(
              `UPDATE agentes SET saldo = saldo + ? WHERE id_agente = ?`,
              [retorno_a_credito, data_meta.id_agente],
            );
          }
          if (id_relacion_db) {
            const [filas_facturas] = await connection.execute(
              `SELECT id_item FROM items_facturas WHERE id_relacion = ? LIMIT 1`,
              [id_relacion_db],
            );
            if (filas_facturas.length > 0) {
              await Promise.all(
                items_con_nuevos_totales.map((item) =>
                  connection.execute(
                    `UPDATE items_facturas SET monto = ? WHERE id_item = ? AND id_relacion = ?`,
                    [item.nuevo_total, item.id_item, id_relacion_db],
                  ),
                ),
              );
            }
          }
        }
        //Inicia verificación de cambios en vuelos
        if (cambios.keys.includes("vuelos")) {
          await connection.execute(
            `DELETE FROM vuelos WHERE id_viaje_aereo = ?`,
            [viaje_aereo_db.id_viaje_aereo],
          );
          const insertVuelosQuery = `
          INSERT INTO vuelos (
            id_viaje_aereo,
            flight_number,
            airline,
            id_proveedor,
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
            has_stops,
            stop_count,
            stops,
            seat_number,
            seat_location,
            id_usuario_creador,
            rate_type,
            comentarios,
            fly_type,
            eq_mano,
            eq_personal,
            eq_documentado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

          console.log("INSERT VUELOS QUERY:", vuelos);

          await Promise.all(
            vuelos.map((vuelo) =>
              connection.execute(insertVuelosQuery, [
                vuelo.id_viaje_aereo || null, // No es NULL, no tiene valor por defecto.
                vuelo.flight_number || null, // Puede ser NULL.
                vuelo.aerolinea.proveedor || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.airline_code || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.departure.airport || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.departure.airport_code || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.departure.city || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.departure.country || "", // No es NULL||null, no tiene valor por defecto.
                vuelo.departure.date || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.departure.time || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.arrival.airport || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.arrival.airport_code || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.arrival.city || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.arrival.country || "", // No es NULL||null, no tiene valor por defecto.
                vuelo.arrival.date || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.arrival.time,
                vuelo.has_stops || null, // Puede ser NULL y tiene un valor por defecto de '0'.
                vuelo.stop_count || null, // Puede ser NULL y tiene un valor por defecto de '0'.
                vuelo.stops || null, // Puede ser NULL.
                vuelo.seat_number || null, // No es NULL||null, no tiene valor por defecto.
                vuelo.seat_location || null, // No es NULL||null, no tiene valor por defecto.
                req?.session?.id || "general" || null, // Puede ser NULL.
                vuelo.rate_type || null, // Puede ser NULL.
                vuelo.comentarios || null, // Puede ser NULL.
                vuelo.fly_type || null, // Puede ser NULL.
                vuelo.eq_mano || null,
                vuelo.eq_personal || null,
                vuelo.eq_documentado || null,
              ]),
            ),
          );
          if (
            vuelosBefore[0].check_in !== vuelos[0].check_in ||
            vuelosBefore[vuelosBefore.length - 1].check_out !==
              vuelos[vuelos.length - 1].check_out
          ) {
            await connection.execute(
              `UPDATE bookings SET check_in = ?, check_out = ? WHERE id_booking = ?`,
              [
                vuelos[0].check_in,
                vuelos[vuelos.length - 1].check_out,
                viaje_aereo_db.id_booking,
              ],
            );
          }
          if (
            viaje_aereo.trip_type !== viaje_aereoBefore.trip_type ||
            viaje_aereo.ida.origen.aeropuerto !==
              viaje_aereoBefore.ida.origen.aeropuerto ||
            viaje_aereo.ida.destino.aeropuerto !==
              viaje_aereoBefore.ida.destino.aeropuerto ||
            viaje_aereo.regreso?.origen.aeropuerto !==
              viaje_aereoBefore.regreso?.origen.aeropuerto ||
            viaje_aereo.regreso?.destino.aeropuerto !==
              viaje_aereoBefore.regreso?.destino.aeropuerto
          ) {
            await connection.execute(
              `UPDATE viajes_aereos SET trip_type = ?, aeropuerto_origen = ?, ciudad_origen = ?, aeropuerto_destino = ?, ciudad_destino = ?, regreso_aeropuerto_origen = ?, regreso_ciudad_origen = ?, regreso_aeropuerto_destino = ?, regreso_ciudad_destino = ? WHERE id_viaje_aereo = ?`,
              [
                viaje_aereo.trip_type,
                viaje_aereo.ida.origen.aeropuerto,
                viaje_aereo.ida.origen.ciudad,
                viaje_aereo.ida.destino.aeropuerto,
                viaje_aereo.ida.destino.ciudad,
                viaje_aereo.regreso?.origen.aeropuerto || null,
                viaje_aereo.regreso?.origen.ciudad || null,
                viaje_aereo.regreso?.destino.aeropuerto || null,
                viaje_aereo.regreso?.destino.ciudad || null,
                viaje_aereo.id_viaje_aereo,
              ],
            );
          }
        }
        console.log(
          "\n\nSe actualiza código de confirmación, intermediario o viajero",
          reserva.viajero?.id_viajero,
        );
        if (
          viaje_aereo.codigo_confirmation !==
            viaje_aereoBefore.codigo_confirmation ||
          reserva?.intermediario?.id !== reservaBefore?.intermediario?.id ||
          reserva?.viajero?.id_viajero !== reservaBefore?.viajero?.id_viajero
        ) {
          await connection.execute(
            `UPDATE viajes_aereos SET codigo_confirmacion = ?, id_intermediario = ?, id_viajero = ? WHERE id_viaje_aereo = ?`,
            [
              viaje_aereo.codigo_confirmation,
              reserva?.intermediario?.id || null,
              reserva?.viajero?.id_viajero || null,
              viaje_aereo.id_viaje_aereo,
            ],
          );
        }
        //Termina verificación de cambios en vuelos
      } catch (error) {
        throw error;
      }
    });

    // // let diferencia;
    // //   let cambio =
    // //     cambios.logs.precio.current - Number(cambios.logs.precio.before);
    // //   diferencia = cambio != 0 ? cambio : undefined;
    // // }
    /**VALIDAR SALDOS */
    /**VALIDAR QUE TENGA CREDITO */
    /**HACER EL COBRO O RETORNO DE DINERO - tomar en cuenta que puede ser regresando un wallet no facurabe y ya, o tambien por credito*/
    /**UPDATEAR LAS COSAS DEL VIAJE Y LOS PRECIOS SI SE EDITARON */

    /*** Si se edita el precio ->
     * - Se actualiza el servicio (agregando solo el nuevo precio, ya sea negativo o positivo)*
     * - Se actualiza el booking (Este entra con el nuevo precio)                             *
     * - Se actualiza el item (Con el nuevo precio)                                           *
     * - Se actualiza el viaje aereo (Con el nuevo precio)                                    *
     * - Se manejan los pagos (credito, wallet, pago directo, pagos_credito, items_pagos)
     * - El que se revisa es lo de facturas y asi
     * */

    /*** Si se edita el costo ->
     * - Se edita el item                                                                         *
     * - Se edita el viaje aereo                                                                  *
     * */

    /*** Si se editan vuelos
     * - Se eliminan  todos los vuelos                                                            *
     * - Se agregan los nuevos vuelos                                                             *
     * - Se edita el viaje aereo                                                                  *
     * - Se edita tambien el booking por el checkin y eso                                         *
     * */

    /*** Si se edita el codigo
     * - Se edita el viaje aereo                                                                  *
     * */

    /*** Si se edita el status
     * - Se debe verificar y en caso de que este cancelada:
     * - Se debe regresar el credito que no esta pagado, y se debe regresar los saldos que fueron pagados,
     * - Se debe cancelar la reserva, cambiando el status en bookings (Verificar como esta escrito y el enum)         *
     * */
    // const [servicio] = await executeQuery(
    //   `SELECT * FROM servicios where id_servicio = ?`,
    //   [viaje_aereo.id_servicio],
    // );

    // const [viaje] = await executeQuery(
    //   `SELECT * FROM viajes_aereos WHERE id_viaje_aereo = ?`,
    //   [viaje_aereo.id_viaje_aereo],
    // );

    // const BEFORE = {
    //   servicio,
    //   viaje_aereo: viaje,
    // };

    // await runTransaction(async (connection) => {
    //   try {
    //     const updateService = Calculo.cleanEmpty({
    //       total: diferencia
    //         ? Number(BEFORE.servicio.total) + diferencia
    //         : undefined,
    //     });
    //     await Servicio.update(connection, {
    //       ...updateService,
    //       id_servicio: BEFORE.viaje_aereo.id_servicio,
    //     });

    //     const updateViajeAereo = Calculo.cleanEmpty({
    //       total: diferencia
    //         ? Number(BEFORE.viaje_aereo.total) + diferencia
    //         : undefined,
    //     });
    //     await ViajeAereo.update(connection, {
    //       ...updateViajeAereo,
    //       id_viaje_aereo: BEFORE.viaje_aereo.id_viaje_aereo,
    //     });

    //     console.log(diferencia, updateService);
    //   } catch (error) {
    //     throw error;
    //   }
    // });

    res.status(200).json({
      message: "Reservación creada con exito",
      data: formaters,
    });
  } catch (error) {
    console.log("this is the message", error.message);
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

module.exports = {
  crearVuelo,
  editarVuelo,
  getVuelos,
  getVueloById,
  getVuelosCupon,
};
