const { CustomError } = require("../../../middleware/errorHandler");
const { v4: uuidv4 } = require("uuid");
const { executeQuery, runTransaction } = require("../../../config/db");
const {
  calcularPrecios,
  calcularNoches,
} = require("../../../lib/utils/calculates");
const { verificarSaldos } = require("../../../lib/utils/validates");
const { error } = require("winston");

class ValidationError extends Error {
  constructor(message, code = 400) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = code;
  }
}

const validateRentaAutosPayload = (payload, es_con_chofer) => {
  const {
    auto_descripcion,
    check_in,
    check_out,
    codigo,
    conductores,
    costo,
    devuelta_lugar,
    precio,
    proveedor,
    recogida_lugar,
    faltante,
  } = payload;

  // 1. Validaciones de Existencia y No-Nulo
  // Lista de campos requeridos
  const requiredFields = {
    codigo,
    status: payload.status,
    costo,
    precio,
    check_in,
    check_out,
    proveedor,
    auto_descripcion,
    tipo_vehiculo: payload.tipo_vehiculo,
    faltante,
  };

  if (es_con_chofer != 1) {
    requiredFields.recogida_lugar = recogida_lugar;
    requiredFields.devuelta_lugar = devuelta_lugar;
  }

  for (const [key, value] of Object.entries(requiredFields)) {
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    ) {
      throw new ValidationError(
        `El campo '${key}' es obligatorio y no puede estar vacío.`,
        400,
      );
    }
  }

  // 2. Validaciones de Tipo y Lógica

  // Costo/Precio
  if (typeof costo !== "number" || costo < 0) {
    throw new ValidationError(
      "El campo 'costo' debe ser un número no negativo.",
      400,
    );
  }
  if (typeof precio !== "number" || precio < 0) {
    throw new ValidationError(
      "El campo 'precio' debe ser un número no negativo.",
      400,
    );
  }
  if (typeof faltante !== "number" || faltante < 0) {
    throw new ValidationError(
      "El campo 'faltante' debe ser un número no negativo.",
      400,
    );
  }

  // Fechas y Lógica Temporal
  const checkInDate = new Date(check_in);
  const checkOutDate = new Date(check_out);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    throw new ValidationError(
      "Las fechas 'check_in' o 'check_out' tienen un formato inválido (ISO 8601 esperado).",
      400,
    );
  }
  if (checkOutDate <= checkInDate) {
    throw new ValidationError(
      "La fecha de 'check_out' debe ser estrictamente posterior a la fecha de 'check_in'.",
      400,
    );
  }

  // Proveedor
  if (
    typeof proveedor !== "object" ||
    !proveedor.id ||
    typeof proveedor.id !== "number"
  ) {
    throw new ValidationError(
      "El objeto 'proveedor' debe contener un 'id' numérico válido.",
      400,
    );
  }

  // Sucursales
  // Solo es necesario para renta de autos con chofer

  if (es_con_chofer != 1) {
    if (typeof recogida_lugar !== "object" || !recogida_lugar.id_sucursal) {
      throw new ValidationError(
        "El 'recogida_lugar' debe contener un 'id_sucursal'.",
        400,
      );
    }

    if (typeof devuelta_lugar !== "object" || !devuelta_lugar.id_sucursal) {
      throw new ValidationError(
        "El 'devuelta_lugar' debe contener un 'id_sucursal'.",
        400,
      );
    }
  }

  // Conductores (Array check y estructura interna)
  if (!Array.isArray(conductores) || conductores.length === 0) {
    throw new ValidationError(
      "El campo 'conductores' debe ser un array con al menos un elemento.",
      400,
    );
  }

  for (const conductor of conductores) {
    if (
      !conductor.id_viajero ||
      !conductor.primer_nombre ||
      !conductor.apellido_paterno
    ) {
      const conductorId = conductor.id_viajero || "Desconocido";
      throw new ValidationError(
        `El conductor con ID ${conductorId} debe tener 'id_viajero', 'primer_nombre', 'apellido_paterno' y 'correo'.`,
        400,
      );
    }
  }
};

const debugParams = (nombre, params) => {
  const undefinedParams = params
    .map((value, index) => ({
      index,
      value,
      tipo: typeof value,
    }))
    .filter((param) => param.value === undefined);

  console.log(`\n========== ${nombre} ==========`);
  console.dir(params, { depth: null });
  console.log(`\n==========           ==========`);
  if (undefinedParams.length > 0) {
    console.error("🔴 PARAMETROS UNDEFINED:");
    console.dir(undefinedParams, { depth: null });
  } else {
    console.log("🟢 No hay undefined");
  }
};

const createRentaAutos = async (req, res) => {
  const formater_payload = req.body;

  console.log("========== BODY RECIBIDO ==========");
  console.dir(req.body, { depth: null });

  console.log("costo:", formater_payload.costo);
  console.log("precio:", formater_payload.precio);
  console.log("faltante:", formater_payload.faltante);
  const payload = {
    ...req.body,
    renta: {
      ...formater_payload.renta,
      costo: Number(formater_payload.renta.costo),
      precio: Number(formater_payload.renta.precio),
      faltante: Number(formater_payload.renta.faltante),
    },

    saldos: (formater_payload.saldos || []).map((saldo) => ({
      ...saldo,
      saldo: Number(saldo.saldo),
      monto: Number(saldo.monto),
      restante: Number(saldo.restante),
      saldo_usado: Number(saldo.saldo_usado),
    })),
  };

  const { renta, viajes = [], saldos = [], es_con_chofer } = payload;

  const { proveedor, recogida_lugar, devuelta_lugar, conductores } = renta;

  try {
    // ## 1A. Validación Síncrona (Esquema y Tipo)
    validateRentaAutosPayload(renta, es_con_chofer);

    // ## 1B. Validación Asíncrona (Existencia de Recursos en DB)
    console.log(renta);

    // Lista de IDs a verificar en la base de datos
    const proveedorId = proveedor?.id;

    // Renta con chofer
    if (es_con_chofer == 1) {
      if (!Array.isArray(viajes) || viajes.length == 0) {
        throw new CustomError(
          "Una renta de autos con chofer debe tener al menos un viaje",
        );
      }

      for (const viaje of viajes) {
        // Validamos por cada viaje

        // aun queda pendiente revisar si la direccion destino y fecha destino podran ser null junto con coordenadas destino (latitud y longitud)

        if (!viaje.direccion_origen) {
          throw new CustomError("El viaje debe tener una direccion de origen");
        }

        if (!viaje.fecha_origen) {
          throw new CustomError("El viaje requiere una fecha de origen.");
        }

        if (!viaje.latitud_origen) {
          throw new CustomError("El viaje requiere una latitud de origen");
        }
        if (!viaje.longitud_origen) {
          throw new CustomError("El viaje requiere una longitud de origen");
        }
      }
    }

    // A. Proveedor
    const [proveedorDB] = await executeQuery(
      "SELECT id FROM proveedores WHERE id = ?",
      [proveedorId],
    );
    if (!proveedorDB) {
      return res.status(404).json({
        message: `El proveedor con ID ${proveedorId} no fue encontrado.`,
      });
    }

    // B. Sucursales (Recogida y Devolución)

    if (es_con_chofer != 1) {
      const recogidaId = recogida_lugar?.id_sucursal;
      const devueltaId = devuelta_lugar?.id_sucursal;
      const [recogidaDB, devueltaDB] = await Promise.all([
        executeQuery(
          "SELECT id_sucursal FROM sucursales WHERE id_sucursal = ?",
          [recogidaId],
        ),
        executeQuery(
          "SELECT id_sucursal FROM sucursales WHERE id_sucursal = ?",
          [devueltaId],
        ),
      ]);

      if (!recogidaDB) {
        return res.status(404).json({
          message: `La sucursal de recogida con ID ${recogidaId} no fue encontrada.`,
        });
      }
      if (!devueltaDB) {
        return res.status(404).json({
          message: `La sucursal de devolución con ID ${devueltaId} no fue encontrada.`,
        });
      }
    }

    // C. Conductores/Viajeros
    // Nota: Es más eficiente usar IN en una sola consulta para todos los IDs de viajeros.

    const viajeroIds = (conductores || [])
      .map((c) => c.id_viajero)
      .filter(Boolean);

    if (viajeroIds.length > 0) {
      const placeholders = viajeroIds.map(() => "?").join(",");

      const viajerosDB = await executeQuery(
        `SELECT id_viajero
     FROM viajeros
     WHERE id_viajero IN (${placeholders})`,
        viajeroIds,
      );

      if (viajerosDB.length !== viajeroIds.length) {
        const foundIds = new Set(viajerosDB.map((v) => v.id_viajero));

        const missingId = viajeroIds.find((id) => !foundIds.has(id));

        return res.status(404).json({
          message: `El viajero/conductor con ID ${missingId} no fue encontrado.`,
        });
      }
    }

    //D. Precios y formas de pago
    const [agente] = await executeQuery(
      `SELECT * FROM agente_details where id_agente = ?`,
      [renta.id_agente],
    );
    if (!agente) throw new Error("No existe agente");
    if (renta.faltante > 0 && Number(agente.saldo) < renta.faltante)
      throw new Error("El agente no tiene el credito suficiente");
    if (saldos.length > 0) {
      const saldosDB = await executeQuery(
        `SELECT * FROM saldos_a_favor where id_saldos in (${saldos
          .map(() => "?")
          .join(",")})`,
        saldos.map((s) => s.id_saldos),
      );
      if (saldosDB.length < saldos.length)
        throw new CustomError(
          "La cantidad de saldos no coincide con la que se tiene",
        );
      const isValidateSaldos = verificarSaldos([...saldosDB, ...saldos]);
      if (!isValidateSaldos)
        throw new Error("Los saldos no coinciden con los recibidos");
    }

    // ## 2. Formateo (ya esta,  desde antes de mandarlo a validación) pero si podemos crear los ids
    const id_servicio = `ser-${uuidv4()}`;
    const id_booking = `boo-${uuidv4()}`;
    const id_renta_autos = `ren-${uuidv4()}`;
    const id_solicitud = `sol-${uuidv4()}`;
    const id_transaccion = `tra-${uuidv4()}`;
    const precio = calcularPrecios(renta.precio);

    // ## 3. Creación (Creación del Recurso)
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
  ) VALUES (?, ?, ?, ?, ?, ?);
`;
        const paramsInsertService = [
          id_servicio, // No es NULL, no tiene un valor por defecto.
          precio.total, // No es NULL, no tiene un valor por defecto.
          precio.subtotal / 1.16, // No es NULL, no tiene un valor por defecto.
          precio.impuestos, // Puede ser NULL.
          renta.faltante > 0, // Puede ser NULL y tiene un valor por defecto de '0'.
          renta.id_agente, // Puede ser NULL.
        ];

        debugParams("INSERT SERVICIOS", paramsInsertService);
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
    renta_carro
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

        const solicitudesParams = [
          id_solicitud, // No es NULL, no tiene valor por defecto. Es la clave primaria.
          id_servicio, // Puede ser NULL.
          `car-${(Math.random() * 99999999).toFixed(0)}`, // No es NULL, no tiene valor por defecto.
          renta.conductores[0].id_viajero, // No es NULL, no tiene valor por defecto.
          renta.check_in, // Puede ser NULL.
          renta.check_out, // Puede ser NULL.
          precio.total, // No es NULL, no tiene valor por defecto.
          renta.id_agente, // Puede ser NULL.
          renta.id_agente, // Puede ser NULL.
          req?.session?.id || null, // Puede ser NULL.
          "Operaciones", // Puede ser NULL.
          renta,
        ];

        // Ejemplo de uso:
        debugParams("INSERT SOLICITUDES", solicitudesParams);
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
  ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, NOW(), ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;
          const pagosToInsert = saldos.map((saldo) => {
            const id_pago = `pag-${uuidv4()}`;
            const precio_saldo = calcularPrecios(Number(saldo.saldo_usado));
            pagos_to_item_pagos.push({ id_pago, monto: saldo.saldo_usado });

            return [
              id_pago, // No es NULL, no tiene valor por defecto. Es la clave primaria.
              id_servicio, // No es NULL, no tiene valor por defecto. Es parte de la clave primaria.
              renta.id_agente, // Puede ser NULL.
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
              renta.faltante > 0 ? null : "contado", // Puede ser NULL.
              saldo.link_stripe, // Puede ser NULL.
              saldo.id_saldos, // Puede ser NULL.
              renta.id_agente, // Puede ser NULL.
              false, // Puede ser NULL y tiene un valor por defecto de '0'.
              saldo.monto, // Puede ser NULL.
              id_transaccion, // Puede ser NULL.
              (renta.precio - renta.faltante).toFixed(2), // Puede ser NULL.
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
        if (renta.faltante > 0) {
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

          const pagoCreditoParams = [
            id_credito, // No es NULL, no tiene valor por defecto. Es la clave primaria.
            id_servicio, // No es NULL, no tiene valor por defecto.
            precio.total, // No es NULL, no tiene valor por defecto.
            renta.id_agente, // No es NULL, no tiene valor por defecto.
            precio.total, // No es NULL, no tiene valor por defecto.
            renta.faltante.toFixed(2), // No es NULL, no tiene valor por defecto.
            precio.total, // No es NULL, no tiene valor por defecto.
            precio.subtotal, // No es NULL, no tiene valor por defecto.
            precio.impuestos, // No es NULL, no tiene valor por defecto.
            "Renta de autos", // No es NULL, no tiene valor por defecto.
          ];

          await connection.execute(insertPagoCreditoQuery, pagoCreditoParams);
        }
        if (renta.faltante > 0 && saldos.length > 0) {
          await Promise.all(
            pagos_to_item_pagos.map(({ id_pago, monto }) =>
              connection.execute(
                `INSERT INTO relacion_credito_pago 
                (id_credito, id_pago, monto_del_pago, restante)
VALUES (?, ?, ?, ?)
`,
                [id_credito, id_pago, monto, renta.faltante],
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
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?);
`;

        const paramsInsertBooking = [
          id_booking, // No es NULL, no tiene valor por defecto. Es parte de la clave primaria.
          id_servicio, // No es NULL, no tiene valor por defecto. Es parte de la clave primaria.
          renta.check_in, // No es NULL, no tiene valor por defecto.
          renta.check_out, // No es NULL, no tiene valor por defecto.
          precio.total, // No es NULL, no tiene valor por defecto.
          precio.subtotal / 1.16, // No es NULL, no tiene un valor por defecto.
          precio.impuestos, // Puede ser NULL.
          renta.status, // Puede ser NULL y tiene un valor por defecto de 'En proceso'.
          renta.costo.toFixed(2), // Puede ser NULL.
          id_solicitud, // Puede ser NULL.
          req?.session?.user?.id,
        ];

        await connection.execute(sqlInsertBooking, paramsInsertBooking);

        //AQUI ME QUEDE

        const insertRentaAutosQuery = `
        INSERT INTO renta_autos (
            id_renta_autos,
            nombre_proveedor,
            id_proveedor,
            id_intermediario,
            codigo_renta_carro,
            descripcion_auto,
            edad,
            max_pasajeros,
            conductor_principal,
            id_conductor_principal,
            conductores_adicionales,
            comentarios,
            vehicle_id,
            tipo_auto,
            nombre_auto,
            marca_auto,
            modelo,
            anio_auto,
            transmission,
            fuel_type,
            doors,
            seats,
            air_conditioning,
            hora_recoger_auto,
            lugar_recoger_auto,
            id_sucursal_recoger_auto,
            hora_dejar_auto,
            lugar_dejar_auto,
            id_sucursal_dejar_auto,
            dias,
            seguro_incluido,
            monto_seguro,
            gps,
            child_seat,
            additional_driver,
            wifi_hotspot,
            gps_price,
            child_seat_price,
            additional_driver_price,
            wifi_price,
            fuel_policy,
            mileage_limit,
            free_cancellation,
            id_booking,
            usuario_creador,
            is_operaciones_last_move,
            usuario_actualizador,
            es_con_chofer
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,?
        )`;

        const insertParametrosRentaAutos = [
          id_renta_autos,

          renta.proveedor?.proveedor || null,
          renta.proveedor?.id || null,
          renta.intermediario?.id || null,

          renta.codigo || null,
          renta.auto_descripcion || null,
          renta.edad || null,
          renta.max_pasajeros || null,

          renta.conductores?.[0]?.nombre_completo || null,
          renta.conductores?.[0]?.id_viajero || null,
          renta.conductores || null,

          renta.comentarios || null,

          null, // vehicle_id

          renta.tipo_vehiculo || null,
          null, // nombre_auto
          null, // marca_auto
          null, // modelo
          null, // anio_auto
          renta.tipo_vehiculo || null, // transmission

          null, // fuel_type
          null, // doors
          null, // seats
          null, // air_conditioning

          renta.check_in?.split("T")[1] || null,

          renta.recogida_lugar
            ? `${renta.recogida_lugar.nombre} - ${renta.recogida_lugar.direccion}`
            : null,

          renta.recogida_lugar?.id_sucursal || null,

          renta.check_out?.split("T")[1] || null,

          renta.devuelta_lugar
            ? `${renta.devuelta_lugar.nombre} - ${renta.devuelta_lugar.direccion}`
            : null,

          renta.devuelta_lugar?.id_sucursal || null,

          renta.check_in && renta.check_out
            ? calcularNoches(renta.check_in, renta.check_out)
            : null,

          renta.seguro || null,

          null, // monto_seguro
          null, // gps
          null, // child_seat

          renta.conductores?.length > 1 || false,

          null, // wifi_hotspot
          null, // gps_price
          null, // child_seat_price
          null, // additional_driver_price
          null, // wifi_price
          null, // fuel_policy
          null, // mileage_limit
          null, // free_cancellation

          id_booking,
          req?.session?.id || null,
          true,
          req?.session?.id || null,

          es_con_chofer || 0,
        ];

        debugParams("INSERT RENTA AUTOS", insertParametrosRentaAutos);

        await connection.execute(
          insertRentaAutosQuery,
          insertParametrosRentaAutos,
        );

        // insert para viajes de renta de autos (en el caso de renta de autos por chofer)

        // Se insertan los datos de los distintos viajes en la tabla viajes_renta_autos

        const insertViajesQuery = `
          INSERT INTO viajes_renta_autos(
            id_renta_autos,
            direccion_origen,
            latitud_origen,
            longitud_origen,
            fecha_origen,
            direccion_destino,
            latitud_destino,
            longitud_destino,
            fecha_destino,
            comentario_viaje,
            created_at,
            updated_at
          )VALUES (?,?,?,?,?,?,?,?,?,?,?,?);
        `;

        if (es_con_chofer === 1) {
          for (const viaje of viajes) {
            const viajeParams = [
              id_renta_autos,
              viaje.direccion_origen,
              viaje.latitud_origen,
              viaje.longitud_origen,
              viaje.fecha_origen,
              viaje.direccion_destino || null,
              viaje.latitud_destino || null,
              viaje.longitud_destino || null,
              viaje.fecha_destino || null,
              viaje.comentario_viaje,
              viaje.created_at || null,
              viaje.updated_at || null,
            ];

            debugParams("INSERT VIAJE", viajeParams);
            await connection.execute(insertViajesQuery, viajeParams);
          }
        }
        const insertItemsQuery = `
  INSERT INTO items (
    id_item,
    total,
    subtotal,
    impuestos,
    fecha_uso,
    costo_total,
    saldo,
    id_renta_carro
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
`;

        const id_item = `ite-${uuidv4()}`;
        //TODO: REVISAR EL ID_FACTURA, PORQUE SI EL SALDO YA FUE FACTURADO DEBE TENER ID_FACTURA PERO PUEDE QUE TENGA MUCHOS SALDOS Y MUCHAS FACTURAS Y ESO AUN NO SE PUEDE
        const itemsParams = [
          id_item, // No es NULL, no tiene valor por defecto. Es la clave primaria.
          precio.total, // No es NULL, no tiene valor por defecto.
          precio.subtotal, // No es NULL, no tiene valor por defecto.
          precio.impuestos, // No es NULL, no tiene valor por defecto.
          renta.check_in, // No es NULL, no tiene valor por defecto.
          renta.costo, // Puede ser NULL.
          renta.faltante.toFixed(2), // Puede ser NULL. siempre va el faltante ya sea a credito o normal // Puede ser NULL.
          id_renta_autos,
        ];

        await connection.execute(insertItemsQuery, itemsParams);

        const insertItemsPagosQuery = `
  INSERT INTO items_pagos (
    id_item,
    id_pago,
    monto
  ) VALUES (?, ?, ?);
`;
        await Promise.all(
          pagos_to_item_pagos.map(({ id_pago, monto }) =>
            connection.execute(insertItemsPagosQuery, [
              id_item,
              id_pago,
              monto,
            ]),
          ),
        );

        //Falta editar credito y asi
        if (renta.faltante > 0) {
          await connection.execute(
            `UPDATE agentes SET saldo = saldo - ? where id_agente = ?`,
            [renta.faltante, renta.id_agente],
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

    // ## 4. Respuesta Exitosa
    res.status(201).json({
      message: "Reserva de renta de autos creada con éxito.",
      // data: { id: newRentalId } // Devolver el ID del recurso creado
      data: null,
    });
  } catch (error) {
    res.status(error.statusCode | 500).json({
      error: error,
      data: null,
      message: error.message || "Error interno",
    });
  }
};

module.exports = {
  createRentaAutos,
};
