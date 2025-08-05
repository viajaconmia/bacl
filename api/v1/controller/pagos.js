const model = require("../model/pagos");
const { CustomError } = require("../../../middleware/errorHandler");
const {
  executeQuery,
  runTransaction,
  executeSP,
} = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
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
    const agentes_encontrados = await executeQuery(
      "select * from agente_details where id_agente = ?;",
      [id_agente]
    );
    if (agentes_encontrados.length == 0)
      throw new CustomError(
        `Parece que no encontramos el agente con el id ${id_agente}`,
        404,
        "ERROR_CLIENT",
        id_agente
      );
    const agente = agentes_encontrados[0];
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
    console.log(pago);
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
    res
      .status(500)
      .json({
        success: false,
        message: "Error al aplicar pagos",
        error: err.message,
      });
  }
};

module.exports = {
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
};
