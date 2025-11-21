// const { response } = require("express");
const { executeTransactionSP, executeQuery } = require("../../../config/db");
const { STORED_PROCEDURE } = require("../../../lib/constant/stored_procedures");
const { sumarHoras } = require("../../../lib/utils/calculates");
const { CustomError } = require("../../../middleware/errorHandler");
const model = require("../model/saldos");

const create = async (req, res) => {
  try {
    const response = await model.createSaldo(req.body);
    res
      .status(201)
      .json({ message: "Saldo creado correctamente", data: response });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const read = async (req, res) => {
  try {
    const saldos = await model.readSaldos();
    res.status(200).json(saldos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const stripe = require("stripe")(process.env.API_STRIPE);

const getStripeInfo = async (req, res) => {
  const { chargeId } = req.query;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    console.log("this is the charge about stripe:", charge);

    const stripeInfo = {
      id: charge.id,
      monto: charge.amount / 100,
      currency: charge.currency.toUpperCase(),
      estado: charge.status,
      fecha_pago: sumarHoras(charge.created * 1000, -6),
      ultimos_4_digitos: charge.payment_method_details.card.last4,
      tipo_tarjeta: charge.payment_method_details.card.brand,
      funding: charge.payment_method_details.card.funding,
      pais: charge.payment_method_details.card.country,
      authorization_code: charge.payment_method_details.card.authorization_code,
    };
    console.log("chargeId recibido:", stripeInfo);

    if (!charge) {
      return res.status(404).json({ message: "Cargo no encontrado" });
    }
    res.status(200).json({
      message: "Detalles del pago obtenidos correctamente",
      data: stripeInfo,
    });
  } catch (error) {
    console.error("Error al obtener detalles del pago:", error);
    res
      .status(500)
      .json({ error: "Error en el servidor", details: error.message });
  }
};

/**
 *
 * Este endpoint se utiliza en:
 * 1.- La parte del admin cuando se maneja el precio de venta de una reservación
 *
 */
const saldosAgrupadosPorMetodoPorIdClient = async (req, res) => {
  const { id_agente } = req.query;
  console.log(id_agente);
  try {
    if (!id_agente) {
      throw new CustomError("Falta el id_agente", 400, "CLIENT_ERROR", null);
    }
    const agente = await executeQuery(
      `SELECT * from agente_details where id_agente = ?`,
      [id_agente]
    );
    if (!agente[0]) {
      throw new CustomError("No existe ese agente", 404, "CLIENT_ERROR", null);
    }
    const saldo = await executeQuery(
      `select metodo_pago, SUM(saldo) as saldo 
      from saldos_a_favor
      where
        id_agente = ?
        and metodo_pago not in("tarjeta_de_credito","tarjeta_de_debito","")
        and activo = 1
      group by metodo_pago;`,
      [id_agente]
    );
    if (saldo.length == 0) {
      throw new CustomError(
        "No se encontraron registros en el saldo del usuario",
        404,
        "NO_DATA_FOUND",
        null
      );
    }
    res
      .status(200)
      .json({ message: "Saldos obtenidos correctamente", data: saldo });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      error,
      message:
        error.message ||
        "Error desconocido en servidor, read saldo by agente type",
      data: null,
    });
  }
};
/**
 *
 * Este endpoint se utiliza en:
 * 1.- La parte del admin cuando se maneja el precio de venta de una reservación
 *
 */
const saldosByType = async (req, res) => {
  const { type, id_agente, id_hospedaje } = req.query;
  try {
    if (!type || !id_agente || !id_hospedaje) {
      throw new CustomError(
        "Falta el tipo de saldo o el id_agente o el id_hospedajje",
        400,
        "CLIENT_ERROR",
        req.query
      );
    }
    const saldos = await executeQuery(
      // `SELECT saf.*,fps.id_factura FROM saldos_a_favor saf
      //   inner join facturas_pagos_y_saldos fps on fps.id_saldo_a_favor = saf.id_saldos
      //   WHERE saf.metodo_pago = ?
      //   AND saf.id_agente = ? AND saf.saldo > 0 AND saf.activo = 1;`,
      `SELECT * FROM saldos_a_favor WHERE metodo_pago = ? AND id_agente = ? AND saldo > 0 AND activo = 1;`,
      [type, id_agente]
    );

    if (saldos.length == 0)
      throw new Error(
        `No hay encontramos saldos, muestra a sistemas esto: ${id_agente}, ${type}`
      );

    const items = await executeQuery(
      `SELECT * FROM items WHERE id_hospedaje = ? LIMIT 1`,
      [id_hospedaje]
    );

    if (items.length == 0)
      throw new Error(
        `No hay items, muestra a sistemas este mensaje y el id hospedaje siguiente: ${id_hospedaje}`
      );

    const item = items[0];
    res.status(200).json({
      message: "Saldos obtenidos correctamente",
      data: { saldos, item },
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      error,
      message:
        error.message || "Error desconocido en servidor, read saldos by type",
      data: null,
    });
  }
};
const readSaldoByAgente = async (req, res) => {
  const { id } = req.params;
  try {
    const saldo = await executeQuery(
      `SELECT
  sf.id_agente,
  a.nombre,
  sf.id_saldos,
  sf.fecha_creacion,
  sf.saldo,
  sf.monto,
  sf.metodo_pago,
  sf.fecha_pago,
  sf.concepto,
  sf.referencia,
  sf.currency,
  sf.tipo_tarjeta,
  sf.ult_digits,
  sf.comentario,
  sf.link_stripe,
  sf.is_facturable,
  sf.is_wallet_credito,
  sf.comprobante,
  sf.activo,
  sf.numero_autorizacion,
  sf.banco_tarjeta,
  COALESCE(v.monto_facturado, 0)     AS monto_facturado,
  COALESCE(v.monto_por_facturar, 0)  AS monto_por_facturar
FROM saldos_a_favor AS sf
INNER JOIN agente_details AS a
  ON a.id_agente = sf.id_agente
LEFT JOIN vw_pagos_prepago_facturables AS v
  ON v.raw_id = sf.id_saldos
  where sf.id_agente = ? and sf.is_cancelado =0
  ;`,
      [id]
    );
    // console.log(saldo);
    res
      .status(200)
      .json({ message: "Saldos obtenidos correctamente", data: saldo });
  } catch (error) {
    console.log(error);
    res.status(error.status || 500).json({
      error,
      message:
        error.message || "Error desconocido en servidor, read saldo by agente",
      data: null,
    });
  }
};

const createNewSaldo = async (req, res) => {
  const data = req.body;
  try {
    console.log("Datos recibidos para crear saldo a favor:", data);
    if (
      !data.id_cliente ||
      !data.monto_pagado ||
      !data.forma_pago ||
      !data.fecha_pago
    ) {
      return res.status(400).json({ error: "Campos requeridos faltantes." });
    }

    console.log("tipo tarjeta");

    switch (data.tipo_tarjeta) {
      case "credit":
        data.tipo_tarjeta = "credito";
        break;
      case "debit":
        data.tipo_tarjeta = "debito";
        break;
      case "credito":
        data.tipo_tarjeta = "credito";
        break;
      case "debito":
        data.tipo_tarjeta = "debito";
        break;
      default:
        data.tipo_tarjeta = "";
        break;
    }
    // Preparar valores para el stored procedure
    const values = [
      data.id_cliente, // p_id_agente
      data.monto_pagado, // p_saldo
      data.monto_pagado, // p_monto
      data.forma_pago.replaceAll(" ", "_"), // p_metodo_pago
      data.fecha_pago, // p_fecha_pago
      null, // p_concepto
      data.referencia || null, // p_referencia
      "MXN", // p_currency
      data.tipo_tarjeta || null, // p_tipo_tarjeta
      data.comentario || null, // p_comentario
      data.link_stripe || null, // p_link_stripe
      data.is_facturable ?? false, // p_is_facturable
      data.is_wallet_credito ?? false, // p_is_descuento
      null, // p_comprobante
      data.ult_digits || null, // p_ult_digits
      data.numero_autorizacion || null, // p_numero_autorizacion
      data.banco_tarjeta || null, // p_banco_tarjeta
    ];
    console.log("Valores para el stored procedure:", values);
    const response = await executeTransactionSP(
      STORED_PROCEDURE.POST.SALDO_A_FAVOR_INSERTAR,
      values
    );
    res
      .status(201)
      .json({ message: "Nuevo saldo creado correctamente", data: response });
  } catch (error) {
    console.error("Error al crear nuevo saldo:", error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const update_saldo_by_id = async (req, res) => {
  console.log("Llegando al endpoint de update_saldo_by_id");
  const {
    id_saldos,
    id_agente,
    saldo,
    monto,
    metodo_pago,
    fecha_pago,
    concepto,
    referencia,
    currency,
    tipo_tarjeta,
    comentario,
    link_stripe,
    is_facturable,
    is_descuento,
    comprobante,
    activo,
    ult_digits,
    numero_autorizacion,
    banco_tarjeta,
    is_cancelado
  } = req.body;

  console.log("Datos recibidos para actualizar saldo a favor:", req.body);
  
  try {
    const result = await executeTransactionSP(
      STORED_PROCEDURE.PATCH.ACTUALIZA_SALDO_A_FAVOR,
      [
        id_saldos,
        id_agente,
        saldo,
        monto,
        metodo_pago,
        fecha_pago,
        concepto,
        referencia,
        currency,
        tipo_tarjeta,
        comentario,
        link_stripe,
        is_facturable,
        is_descuento,
        comprobante,
        activo,
        ult_digits,
        numero_autorizacion,
        banco_tarjeta,
        is_cancelado
      ]
    );
    console.log("Resultado de la actualización:", result);
    if (!result || result.length === 0) {
      return res
        .status(404)
        .json({ message: "No se encontró el saldo a favor para actualizar" });
    } else {
      res.status(200).json({
        message: "Saldo a favor actualizado correctamente",
        data: result,
      });
    }
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

module.exports = {
  create,
  read,
  createNewSaldo,
  readSaldoByAgente,
  update_saldo_by_id,
  saldosAgrupadosPorMetodoPorIdClient,
  saldosByType,
  getStripeInfo,
};
