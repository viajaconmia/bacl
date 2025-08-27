const model = require("../model/pagos");
const { CustomError } = require("../../../middleware/errorHandler");
const {
  executeQuery,
  runTransaction,
  executeSP,
} = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const { get } = require("../router/mia/reservasClient");

const { calcularPrecios } = require("../../../lib/utils/calculates");

const create = async (req, res) => {
  try {
    const response = await model.createPagos(req.body);
    res
      .status(201)
      .json({ message: "Pago creados correctamente", data: response });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const crearItemdeAjuste = async (req, res) => {
  try {
    const response = await runTransaction(async (connection) => {
      try {
        await connection.beginTransaction();

        // 0) Preparar datos
        const id_item_ajuste = "ite-" + uuidv4();
        const {
          updatedItem,
          updatedSaldos,
          diferencia,
          precioActualizado,
          id_booking,
          id_servicio,
        } = req.body;

        updatedItem.id_item = id_item_ajuste;

        // 1) Insertar el item de ajuste
        await connection.query(
          `INSERT INTO items (
         id_item, id_catalogo_item, id_factura,
         total, subtotal, impuestos, is_facturado,
         fecha_uso, id_hospedaje,
         created_at, updated_at,
         costo_total, costo_subtotal, costo_impuestos,
         saldo, costo_iva, is_ajuste
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            updatedItem.id_item,
            updatedItem.id_catalogo_item,
            updatedItem.id_factura,
            updatedItem.total,
            updatedItem.subtotal,
            updatedItem.impuestos,
            updatedItem.is_facturado,
            updatedItem.fecha_uso,
            updatedItem.id_hospedaje,
            updatedItem.created_at,
            updatedItem.updated_at,
            updatedItem.costo_total,
            updatedItem.costo_subtotal,
            updatedItem.costo_impuestos,
            updatedItem.saldo,
            updatedItem.costo_iva,
            updatedItem.is_ajuste,
          ]
        );

        // 2) Actualizar servicios
        await connection.query(
          `UPDATE servicios
         SET total     = total + ?,
             impuestos = (total + ?) * 0.16,
             subtotal  = (total + ?) - ((total + ?) * 0.16)
       WHERE id_servicio = ?`,
          [diferencia, diferencia, diferencia, diferencia, id_servicio]
        );

        // 3) Actualizar bookings
        await connection.query(
          `UPDATE bookings
         SET total     = ?,
             impuestos = ? * 0.16,
             subtotal  = ? - (? * 0.16)
       WHERE id_booking = ?`,
          [
            precioActualizado,
            precioActualizado,
            precioActualizado,
            precioActualizado,
            id_booking,
          ]
        );

        // 4) Actualizar saldos a favor
        for (const saldoObj of updatedSaldos) {
          // parseo de fecha (ISO o YYYY-MM-DD)
          const fechaCreacion =
            saldoObj.fecha_creacion.length === 10
              ? `${saldoObj.fecha_creacion} 00:00:00`
              : new Date(saldoObj.fecha_creacion)
                  .toISOString()
                  .slice(0, 19)
                  .replace("T", " ");

          const activo = saldoObj.saldo <= 0 ? 0 : 1;

          await connection.query(
            `UPDATE saldos_a_favor
           SET fecha_creacion = ?,
               saldo          = ?,
               activo         = ?
         WHERE id_saldos = ?`,
            [fechaCreacion, saldoObj.saldo, activo, saldoObj.id_saldos]
          );
        }

        // 5) Registrar pagos e items_pagos
        const idsPagos = [];
        for (const saldoObj of updatedSaldos) {
          const id_pago = "pag-" + uuidv4();
          idsPagos.push(id_pago);

          // parseo de fecha de pago
          const fechaPago =
            saldoObj.fecha_pago.length === 10
              ? `${saldoObj.fecha_pago} 00:00:00`
              : new Date(saldoObj.fecha_pago)
                  .toISOString()
                  .slice(0, 19)
                  .replace("T", " ");

          // insertar en pagos
          await connection.query(
            `INSERT INTO pagos (
           id_pago, id_servicio, id_saldo_a_favor, id_agente,
           metodo_de_pago, fecha_pago, concepto, referencia,
           currency, tipo_de_tarjeta, link_pago, last_digits, total
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id_pago,
              id_servicio,
              saldoObj.id_saldos,
              saldoObj.id_agente,
              saldoObj.metodo_pago,
              fechaPago,
              saldoObj.concepto,
              saldoObj.referencia,
              saldoObj.currency,
              saldoObj.tipo_tarjeta,
              saldoObj.link_stripe,
              saldoObj.ult_digits,
              saldoObj.monto_cargado_al_item,
            ]
          );

          // insertar en items_pagos
          await connection.query(
            `INSERT INTO items_pagos (id_pago, id_item, monto)
         VALUES (?, ?, ?)`,
            [id_pago, id_item_ajuste, saldoObj.monto_cargado_al_item]
          );
        }

        await connection.commit();

        // 6) Devolver IDs de pagos creados
        return {
          message: "Item de ajuste creado correctamente",
          item_creado: id_item_ajuste,
          ids_pagos_creados: idsPagos,
        };
      } catch (error) {
        console.error(error);
        throw error; // Lanzar error para que se maneje en el bloque catch
      }
    });
    res.status(204).json({ message: "Actualizado correctamente", data: null });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      message:
        error.message || "Error desconocido al actualizar precio de credito",
      error: error || "ERROR_BACK",
      data: null,
    });
  }
};
const read = async (req, res) => {
  try {
    const datosFiscales = await model.readPagos();
    res.status(200).json(datosFiscales);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getPagosAgente = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const pagos = await model.getPagos(id_agente);
    res.status(200).json(pagos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getAllPagos = async (req, res) => {
  try {
    const pagos = await model.getAllPagos();
    res.status(200).json(pagos);
    console.log("sirvo");
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const readConsultas = async (req, res) => {
  try {
    const { user_id } = req.query;
    let solicitudes = await model.getPagosConsultas(user_id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const getMetodosPago = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id)
      throw new CustomError("Falta el id de usuario", 400, "MISSING_ID", null);
    const agente = await executeQuery(
      `SELECT * FROM agentes WHERE id_agente = ?`,
      [id]
    );
    if (agente.length == 0)
      throw new CustomError("No se encontro el agente", 404, "NOT_FOUND", null);
    const saldos = await executeQuery(
      `select id_agente, SUM(saldo) as saldo 
      from saldos_a_favor
      where
        id_agente = ?
        and metodo_pago not in("tarjeta_de_credito","tarjeta_de_debito","")
        and activo = 1
      group by id_agente;`,
      [id]
    );

    console.log(saldos);

    res.status(200).json({
      message: "Saldos obtenidos con exito",
      data: {
        credito: agente[0].saldo,
        wallet: saldos.length == 0 ? 0 : saldos[0].saldo,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(error.statusCode || 500).json({
      message:
        error.response ||
        error.message ||
        "Error desconocido en verificar registro del usuario",
      error,
      data: null,
    });
  }
};

const getPendientesAgente = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const pagos = await model.getPendientes(id_agente);
    res.status(200).json(pagos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getAllPendientes = async (req, res) => {
  try {
    const pagos = await model.getAllPendientes();
    res.status(200).json(pagos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getEmpresaCredito = async (req, res) => {
  try {
    const response = await model.getCreditoEmpresa(req.query);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const getAgenteCredito = async (req, res) => {
  try {
    const response = await model.getCreditoAgente(req.query);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const getAgenteAgentesYEmpresas = async (req, res) => {
  try {
    const response = await model.getCreditoTodos();
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const updateCreditAgent = async (req, res) => {
  try {
    const response = await model.editCreditoAgente(req.body);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const updateCreditEmpresa = async (req, res) => {
  try {
    const response = await model.editCreditoEmpresa(req.body);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const pagoPorCredito = async (req, res) => {
  try {
    const response = await model.pagoConCredito(req.body);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const pagarCarritoConCredito = async (req, res) => {
  try {
    const { id_agente, monto, id_viajero, itemsCart } = req.body;

    if (!id_agente || !monto || !id_viajero) {
      throw new CustomError("Faltan parametros", 400, "MISSING_PARAMS", {
        id_agente,
        monto,
        id_viajero,
      });
    }

    //Obtenemos el cliente de stripe
    const rows = await executeQuery(
      "SELECT * FROM agentes WHERE id_agente = ?;",
      [id_agente]
    );
    if (rows.length === 0)
      throw new ShortError("No se encontro el agente", 404);

    let saldo_agente = rows[0].saldo;
    if (saldo_agente < monto)
      throw new ShortError("No se cuenta con credito suficiente", 402);
    /* TERMINA VALIDACION DE DATOS */

    /* INICIA TRANSACTION DE ACCIONES */
    const response = await runTransaction(async (conn) => {
      try {
        /* INICIA EL GUARDADO EN LA BASE DEDATOS Y LA ASIGNACIóN DE SERVICIO */
        const id_servicio = `ser-${uuidv4()}`;
        const precio_venta = calcularPrecios(monto);
        const query_create_service = `
    INSERT INTO servicios
    (id_servicio, id_agente, total, subtotal, impuestos) VALUES (?, ?, ?, ?,?)`;
        const params_create_service = [
          id_servicio,
          id_agente,
          precio_venta.total,
          precio_venta.subtotal,
          precio_venta.impuestos,
        ];
        await conn.execute(query_create_service, params_create_service);

        const id_credito = `cre-${uuidv4()}`;
        const query_agregar_credito_pago = `
      INSERT INTO pagos_credito
      (
        id_credito,
        id_servicio,
        responsable_pago_agente,
        fecha_creacion,
        monto_a_credito,
        pago_por_credito,
        pendiente_por_cobrar,
        total,
        subtotal,
        impuestos,
        usuario_generador,
        concepto
      ) 
      VALUES (?,?,?,NOW(),?,?,?,?,?,?,?,?)`;

        const params_agregar_pago_credito = [
          id_credito,
          id_servicio, // Requerido de la relación con servicios
          id_agente, // Requerido
          precio_venta.total || "0",
          precio_venta.total || "0",
          precio_venta.total || "0",
          precio_venta.total || "0",
          precio_venta.subtotal || "0",
          precio_venta.impuestos || "0",
          id_viajero,
          `Ejecución de pago a credito por los servicios con el id: ${
            id_servicio || "Error al obtener el id"
          }`,
        ];

        await conn.execute(
          query_agregar_credito_pago,
          params_agregar_pago_credito
        );

        const ids_solicitudes = itemsCart.map(
          (item) => item.details.id_solicitud
        );
        const ids_carrito = itemsCart.map((item) => item.id);

        await Promise.all(
          ids_solicitudes.map((id) =>
            conn.execute(
              `UPDATE solicitudes SET id_servicio = ? WHERE id_solicitud = ?`,
              [id_servicio, id]
            )
          )
        );
        await Promise.all(
          ids_carrito.map((id) =>
            conn.execute(`UPDATE cart SET active = 0 WHERE id = ?`, [id], [id])
          )
        );
        await conn.execute(`UPDATE agentes SET saldo = ? WHERE id_agente = ?`, [
          (Number(saldo_agente) - monto).toFixed(2),
          id_agente,
        ]);

        return { current_saldo: (Number(saldo_agente) - monto).toFixed(2) };
      } catch (error) {
        throw new CustomError(
          error.message || "Error al intentar hacer el pago",
          error.status || error.statusCode || 500,
          "CREATE_PAYMENT_ERROR",
          error
        );
      }
    });

    res.status(200).json({
      message: "Pago procesado exitosamente",
      data: response,
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Error desconocido al pagar a credito",
      error: error || "ERROR_BACK",
      data: null,
    });
  }
};

const handlerPagoContadoRegresarSaldo = async (req, res) => {
  try {
    let {
      id_agente,
      diferencia,
      id_servicio,
      id_hospedaje,
      id_booking,
      precio_actualizado,
      id_pago,
    } = req.body;
    if (
      !id_agente ||
      !diferencia ||
      !id_servicio ||
      !id_hospedaje ||
      !id_booking ||
      !precio_actualizado ||
      !id_pago
    ) {
      throw new CustomError(
        "Parece que faltan datos o hay datos nulos",
        400,
        "ERROR_FRONT",
        Object.entries({
          id_agente,
          diferencia,
          id_servicio,
          id_hospedaje,
          id_booking,
          precio_actualizado,
          id_pago,
        }).filter(([_, value]) => !value)
      );
    }
    diferencia = diferencia * -1;
    // const agentes_encontrados = await executeQuery(
    //   "select * from agente_details where id_agente = ?;",
    //   [id_agente]
    // );
    // if (agentes_encontrados.length == 0)
    //   throw new CustomError(
    //     `Parece que no encontramos el agente con el id ${id_agente}`,
    //     404,
    //     "ERROR_CLIENT",
    //     id_agente
    //   );
    // const agente = agentes_encontrados[0];
    const pagos_encontrados = await executeQuery(
      "select * from pagos where id_pago = ?;",
      [id_pago]
    );
    if (pagos_encontrados.length == 0)
      throw new CustomError(
        `Parece que no encontramos el pago con el id ${id_pago}`,
        404,
        "ERROR_CLIENT",
        id_pago
      );
    const pago = pagos_encontrados[0];

    const pagos_facturas_saldos = await executeQuery(
      `SELECT * FROM facturas_pagos_y_saldos WHERE id_pago = ?`,
      [pago.id_pago]
    );

    if (pago.id_saldo_a_favor != null)
      throw new CustomError(
        `Lo siento, el pago se realizo con saldo a favor, no se podra modificar por este medio, el id del saldo a favor es:${pago.id_saldo_a_favor}, se puede hacer el cambio pero tomara tiempo, avisar si se desea agregar eso, para eso se agregaria un wallet pero ese no seria facturable ya que hay un saldo a favor que paso por eso`,
        402,
        "ERROR_PAYMENT",
        pago
      );

    const response = await runTransaction(async (connection) => {
      try {
        //* 1.- Crear saldo a favor con el saldo sobrante
        const query = `
          INSERT INTO saldos_a_favor (
            id_agente, fecha_creacion, saldo, monto, metodo_pago,
            fecha_pago, concepto, referencia, currency, tipo_tarjeta,
            comentario, link_stripe, is_facturable, is_descuento,
            comprobante, activo, ult_digits, numero_autorizacion, banco_tarjeta
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const valores = [
          pago.id_agente || pago.responsable_pago_agente || null, // id_agente
          pago.created_at || new Date(), // fecha_creacion
          parseFloat(diferencia) || 0, // saldo
          parseFloat(pago.total) || 0, // monto
          pago.metodo_de_pago || "transferencia", // metodo_pago
          pago.fecha_pago || pago.fecha_transaccion || null, // fecha_pago
          pago.concepto || null, // concepto
          pago.referencia || null, // referencia
          (pago.currency || "MXN").toUpperCase(), // currency
          pago.tipo_de_tarjeta === "credit"
            ? "credito"
            : pago.tipo_de_tarjeta === "debit"
            ? "debito"
            : null, // tipo_tarjeta
          null, // comentario (ajustable)
          pago.link_pago || null, // link_stripe
          1, // is_facturable
          0, // is_descuento
          null, // comprobante
          1, // activo
          pago.last_digits ? parseInt(pago.last_digits) : null, // ult_digits
          pago.autorizacion_stripe || null, // numero_autorizacion
          pago.banco || null, // banco_tarjeta
        ];
        const [result] = await connection.execute(query, valores);
        const id_saldo_creado = result.insertId;

        if (pagos_facturas_saldos.length > 0) {
          await connection.execute(
            `UPDATE facturas_pagos_y_saldos SET id_saldo_a_favor = ? WHERE id_pago = ?`,
            [id_saldo_creado, id_pago]
          );
        }

        const query_update_pago = `
        UPDATE pagos
          SET
            id_saldo_a_favor = ?,
            total = ?,
            subtotal = ?,
            impuestos = ?
          WHERE id_pago = ?`;
        const newTotal = Number(pago.total) - diferencia;
        //* 2.- Editar pago y agregar los datos del wallet
        await connection.execute(query_update_pago, [
          id_saldo_creado,
          newTotal,
          newTotal / 1.16,
          newTotal - newTotal / 1.16,
          pago.id_pago,
        ]);
        // 3.- Editar valores, items, reservas
        const [items] = await connection.execute(
          `SELECT * FROM items WHERE id_hospedaje = ?`,
          [id_hospedaje]
        );

        if (items.length == 0)
          throw new Error(
            `No hay items, muestra a sistemas este mensaje y el id hospedaje siguiente: ${id_hospedaje}`
          );
        let update_precio = precio_actualizado;

        let nuevo_monto_item = Number(
          (update_precio / items.length).toFixed(2)
        );

        const newItems = items.map((item, index) => {
          if (index == items.length - 1) {
            return {
              ...item,
              saldo: Number(item.saldo) + diferencia,
              total: update_precio.toFixed(2),
              subtotal: (update_precio / 1.16).toFixed(2),
              impuestos: (update_precio - update_precio / 1.16).toFixed(2),
            };
          }
          update_precio -= nuevo_monto_item;
          const subtotal = (nuevo_monto_item / 1.16).toFixed(2);
          const impuestos = (
            nuevo_monto_item -
            nuevo_monto_item / 1.16
          ).toFixed(2);

          return {
            ...item,
            total: nuevo_monto_item.toFixed(2),
            subtotal,
            impuestos,
          };
        });

        const query_item_agregar_credito = `
                UPDATE items
                  SET
                  saldo = ?,
                  total = ?,
                  subtotal = ?,
                  impuestos = ?
                WHERE id_item = ?`;

        await Promise.all(
          newItems.map((item) =>
            connection.execute(query_item_agregar_credito, [
              item.saldo,
              item.total,
              item.subtotal,
              item.impuestos,
              item.id_item,
            ])
          )
        );

        /* SERVICIO */

        const [[servicio]] = await connection.execute(
          `SELECT * FROM servicios WHERE id_servicio = ?`,
          [id_servicio]
        );
        if (!servicio)
          throw new Error(
            `No existe el servicio, muestra a sistemas el siguiente mensaje y ID: ${id_servicio}`
          );

        const query_servicio_to_update = `
                UPDATE servicios
                  SET
                    total = ?,
                    subtotal = ?,
                    impuestos = ?
                WHERE id_servicio = ?`;
        const nuevo_total_servicio = Number(servicio.total) - diferencia;
        const parametros_servicio = [
          nuevo_total_servicio,
          nuevo_total_servicio / 1.16,
          nuevo_total_servicio - nuevo_total_servicio / 1.16,
          id_servicio,
        ];

        await connection.execute(query_servicio_to_update, parametros_servicio);

        const [[booking]] = await connection.execute(
          `SELECT * FROM bookings WHERE id_booking = ?`,
          [id_booking]
        );
        if (!booking)
          throw new Error(
            `No existe el booking, muestra a sistemas el siguiente mensaje y ID: ${id_booking}`
          );

        const query_booking_to_update = `
                UPDATE bookings
                  SET
                    total = ?,
                    subtotal = ?,
                    impuestos = ?
                WHERE id_booking = ?`;
        const nuevo_total_booking = Number(servicio.total) - diferencia;
        const parametros_booking = [
          nuevo_total_booking,
          nuevo_total_booking / 1.16,
          nuevo_total_booking - nuevo_total_booking / 1.16,
          id_booking,
        ];

        await connection.execute(query_booking_to_update, parametros_booking);
        return { saldo: id_saldo_creado, pago };
      } catch (error) {
        throw error;
      }
    });
    res.status(200).json({
      message:
        "Se ha procesado con exito la actualización del credito del cliente",
      data: response,
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      message:
        error.message || "Error desconocido al actualizar precio de credito",
      error: error || "ERROR_BACK",
      data: null,
    });
  }
};

const pagoPorSaldoAFavor = async (req, res) => {
  try {
    const { SaldoAFavor, items_seleccionados } = req.body;
    if (!SaldoAFavor || !Array.isArray(items_seleccionados)) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    // 1️⃣ Un pago por servicio
    const pagosPorServicio = {};
    items_seleccionados.forEach((item) => {
      if (!pagosPorServicio[item.id_servicio]) {
        pagosPorServicio[item.id_servicio] = `pag-${uuidv4()}`;
      }
    });

    // 2️⃣ Inyectar id_pago en cada item
    const itemsConPago = items_seleccionados.map((item) => ({
      ...item,
      id_pago: pagosPorServicio[item.id_servicio],
    }));

    // 3️⃣ Montos para la respuesta
    const montoAplicado = itemsConPago.reduce(
      (sum, it) => sum + (it.saldo - it.saldonuevo),
      0
    );
    const nuevoSaldo = SaldoAFavor.saldo;

    // 4️⃣ Llamada al SP (12 parámetros)
    await executeSP("sp_asignar_saldosAF_a_pagos", [
      SaldoAFavor.id_saldos, // 1
      SaldoAFavor.id_agente, // 2
      SaldoAFavor.metodo_pago, // 3
      SaldoAFavor.fecha_pago, // 4
      SaldoAFavor.concepto, // 5
      SaldoAFavor.referencia, // 6
      SaldoAFavor.currency, // 7
      SaldoAFavor.tipo_tarjeta, // 8
      SaldoAFavor.link_stripe, // 9
      SaldoAFavor.ult_digits ?? null, // 10
      JSON.stringify(itemsConPago), // 11 p_items_json
      nuevoSaldo, // 12 p_nuevo_saldo
    ]);

    res.json({
      success: true,
      ids_pagos: Object.values(pagosPorServicio),
      monto_aplicado: montoAplicado,
      nuevo_saldo: nuevoSaldo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error al aplicar pagos",
      error: err.message,
    });
  }
};

const getAllPagosPrepago = async (req, res) => {
  try {
    const pagos = await executeQuery(
      `SELECT * FROM vw_pagos_prepago_facturables;`
    );
    const balance = await executeQuery(
      `SELECT * FROM vw_balance_pagos_facturas;`
    );

    res.status(200).json({
      message: "Pagos de prepago obtenidos correctamente",
      data: pagos,
      balance: balance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al obtener los pagos de prepago",
      error: error.message || "Error desconocido",
    });
  }
};

const get_pagos_prepago_by_ID = async (req, res) => {
  try {
    const id_agente =
      req.params.id_agente ??
      req.params.id ??
      req.query.id_agente ??
      req.body.id_agente ??
      "";

    const sql = "CALL sp_get_pagos_prepago(?)";
    const result = await executeQuery(sql, [id_agente]);

    const data =
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;

    return res.status(200).json({
      ok: true,
      id_agente,
      count: Array.isArray(data) ? data.length : 0,
      data,
    });
  } catch (error) {
    console.error("Error en get_pagos_prepago_by_ID:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener pagos de prepago",

      details: error?.message || error,
    });
  }
};

module.exports = {
  get_pagos_prepago_by_ID,
  create,
  read,
  getAgenteCredito,
  getEmpresaCredito,
  getAgenteAgentesYEmpresas,
  updateCreditAgent,
  updateCreditEmpresa,
  pagoPorCredito,
  getPagosAgente,
  getPendientesAgente,
  getAllPendientes,
  getAllPagos,
  readConsultas,
  handlerPagoContadoRegresarSaldo,
  pagoPorSaldoAFavor,
  crearItemdeAjuste,
  getAllPagosPrepago,
  getMetodosPago,
  pagarCarritoConCredito,
};
