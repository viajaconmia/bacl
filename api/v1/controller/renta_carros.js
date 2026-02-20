const { CustomError } = require("../../../middleware/errorHandler");
const { v4: uuidv4 } = require("uuid");
const { executeQuery, runTransaction } = require("../../../config/db");
const {
  calcularPrecios,
  calcularNoches,
} = require("../../../lib/utils/calculates");
const { verificarSaldos } = require("../../../lib/utils/validates");

class ValidationError extends Error {
  constructor(message, code = 400) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = code;
  }
}

const validateRentaAutosPayload = (payload) => {
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
    recogida_lugar,
    devuelta_lugar,
    faltante,
  };

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

const createRentaAutos = async (req, res) => {
  const formater_payload = req.body;
  const payload = {
    ...req.body,
    costo: Number(formater_payload.costo),
    precio: Number(formater_payload.precio),
    faltante: Number(formater_payload.faltante),
    saldos: req.body.saldos.map((saldo) => ({
      ...saldo,
      saldo: Number(saldo.saldo),
      monto: Number(saldo.monto),
      restante: Number(saldo.restante),
      saldo_usado: Number(saldo.saldo_usado),
    })),
  };
  const { proveedor, recogida_lugar, devuelta_lugar, conductores, saldos } =
    payload;
  try {
    // ## 1A. Validación Síncrona (Esquema y Tipo)
    validateRentaAutosPayload(payload);

    // ## 1B. Validación Asíncrona (Existencia de Recursos en DB)
    console.log(payload);

    // Lista de IDs a verificar en la base de datos
    const proveedorId = proveedor.id;
    const recogidaId = recogida_lugar.id_sucursal;
    const devueltaId = devuelta_lugar.id_sucursal;
    const viajeroIds = conductores.map((c) => c.id_viajero);

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
    const [recogidaDB, devueltaDB] = await Promise.all([
      executeQuery("SELECT id_sucursal FROM sucursales WHERE id_sucursal = ?", [
        recogidaId,
      ]),
      executeQuery("SELECT id_sucursal FROM sucursales WHERE id_sucursal = ?", [
        devueltaId,
      ]),
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

    // C. Conductores/Viajeros
    // Nota: Es más eficiente usar IN en una sola consulta para todos los IDs de viajeros.
    const placeholders = viajeroIds.map(() => "?").join(",");
    const viajerosDB = await executeQuery(
      `SELECT id_viajero FROM viajeros WHERE id_viajero IN (${placeholders})`,
      viajeroIds,
    );

    if (viajerosDB.length !== viajeroIds.length) {
      const foundIds = new Set(viajerosDB.map((v) => v.id_viajero));
      const missingId = viajeroIds.find((id) => !foundIds.has(id));
      return res.status(404).json({
        message: `El viajero (conductor) con ID ${missingId} no fue encontrado en la base de datos.`,
      });
    }

    //D. Precios y formas de pago
    const [agente] = await executeQuery(
      `SELECT * FROM agente_details where id_agente = ?`,
      [payload.id_agente],
    );
    if (!agente) throw new Error("No existe agente");
    if (payload.faltante > 0 && Number(agente.saldo) < payload.faltante)
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
    const precio = calcularPrecios(payload.precio);

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
          payload.faltante > 0, // Puede ser NULL y tiene un valor por defecto de '0'.
          payload.id_agente, // Puede ser NULL.
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
    renta_carro
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

        const solicitudesParams = [
          id_solicitud, // No es NULL, no tiene valor por defecto. Es la clave primaria.
          id_servicio, // Puede ser NULL.
          `car-${(Math.random() * 99999999).toFixed(0)}`, // No es NULL, no tiene valor por defecto.
          payload.conductores[0].id_viajero, // No es NULL, no tiene valor por defecto.
          payload.check_in, // Puede ser NULL.
          payload.check_out, // Puede ser NULL.
          precio.total, // No es NULL, no tiene valor por defecto.
          payload.id_agente, // Puede ser NULL.
          payload.id_agente, // Puede ser NULL.
          req?.session?.id || null, // Puede ser NULL.
          "Operaciones", // Puede ser NULL.
          payload,
        ];

        // Ejemplo de uso:
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
              payload.id_agente, // Puede ser NULL.
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
              payload.faltante > 0 ? null : "contado", // Puede ser NULL.
              saldo.link_stripe, // Puede ser NULL.
              saldo.id_saldos, // Puede ser NULL.
              payload.id_agente, // Puede ser NULL.
              false, // Puede ser NULL y tiene un valor por defecto de '0'.
              saldo.monto, // Puede ser NULL.
              id_transaccion, // Puede ser NULL.
              (payload.precio - payload.faltante).toFixed(2), // Puede ser NULL.
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
        if (payload.faltante > 0) {
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
            payload.id_agente, // No es NULL, no tiene valor por defecto.
            precio.total, // No es NULL, no tiene valor por defecto.
            payload.faltante.toFixed(2), // No es NULL, no tiene valor por defecto.
            precio.total, // No es NULL, no tiene valor por defecto.
            precio.subtotal, // No es NULL, no tiene valor por defecto.
            precio.impuestos, // No es NULL, no tiene valor por defecto.
            "Renta de autos", // No es NULL, no tiene valor por defecto.
          ];

          await connection.execute(insertPagoCreditoQuery, pagoCreditoParams);
        }
        if (payload.faltante > 0 && saldos.length > 0) {
          await Promise.all(
            pagos_to_item_pagos.map(({ id_pago, monto }) =>
              connection.execute(
                `INSERT INTO relacion_credito_pago 
                (id_credito, id_pago, monto_del_pago, restante)
VALUES (?, ?, ?, ?)
`,
                [id_credito, id_pago, monto, payload.faltante],
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
          payload.check_in, // No es NULL, no tiene valor por defecto.
          payload.check_out, // No es NULL, no tiene valor por defecto.
          precio.total, // No es NULL, no tiene valor por defecto.
          precio.subtotal / 1.16, // No es NULL, no tiene un valor por defecto.
          precio.impuestos, // Puede ser NULL.
          payload.status, // Puede ser NULL y tiene un valor por defecto de 'En proceso'.
          payload.costo.toFixed(2), // Puede ser NULL.
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
            usuario_actualizador
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?
        )`;

        const insertParametrosRentaAutos = [
          id_renta_autos,
          payload.proveedor.proveedor,
          payload.proveedor.id,
          payload.intermediario?.id || null,
          payload.codigo,
          payload.auto_descripcion,
          payload.edad,
          payload.max_pasajeros,
          payload.conductores[0].nombre_completo,
          payload.conductores[0].id_viajero,
          payload.conductores,
          payload.comentarios,
          null,
          payload.tipo_vehiculo,
          null,
          null,
          null,
          null,
          payload.tipo_vehiculo,
          null,
          null,
          null,
          null,
          payload.check_in.split("T")[1],
          `${payload.recogida_lugar.nombre} - ${payload.recogida_lugar.direccion}`,
          payload.recogida_lugar.id_sucursal,
          payload.check_out.split("T")[1],
          `${payload.devuelta_lugar.nombre} - ${payload.devuelta_lugar.direccion}`,
          payload.devuelta_lugar.id_sucursal,
          calcularNoches(payload.check_in, payload.check_out),
          payload.seguro,
          null,
          null,
          null,
          payload.conductores.length > 1,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          id_booking,
          req?.session?.id || null,
          true,
          req?.session?.id || null,
        ];

        await connection.execute(
          insertRentaAutosQuery,
          insertParametrosRentaAutos,
        );

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
          payload.check_in, // No es NULL, no tiene valor por defecto.
          payload.costo, // Puede ser NULL.
          payload.faltante.toFixed(2), // Puede ser NULL. siempre va el faltante ya sea a credito o normal // Puede ser NULL.
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
        if (payload.faltante > 0) {
          await connection.execute(
            `UPDATE agentes SET saldo = saldo - ? where id_agente = ?`,
            [payload.faltante, payload.id_agente],
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
