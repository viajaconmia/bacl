const { response } = require("express");
const { executeTransactionSP, executeQuery } = require("../../../config/db");
const { STORED_PROCEDURE } = require("../../../lib/constant/stored_procedures");
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
  sf.is_descuento,
  sf.comprobante,
  sf.activo,
  sf.numero_autorizacion,
  sf.banco_tarjeta
FROM saldos_a_favor AS sf
INNER JOIN agente_details AS a
  ON a.id_agente = sf.id_agente
WHERE sf.id_agente = ?;`,
      [id]
    );
    console.log("Si es esta query 👌👌👌")
    // console.log(saldo);
    res
      .status(200)
      .json({ message: "Saldos obtenidos correctamente", data: saldo });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
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

    console.log("tipo tarjeta")

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
      data.id_cliente,
      data.monto_pagado,
      data.monto_pagado,
      data.forma_pago.replaceAll(" ", "_"),
      data.fecha_pago,
      data.comentario || null,
      data.referencia || null,
      "MXN",
      data.tipo_tarjeta|| null,
      data.comentario || null,
      data.link_stripe || null,
      data.is_facturable ?? false,
      data.descuento_aplicable ?? false,
      null,
      data.ult_digits || null,
      data.numero_autorizacion || null,
      data.banco_tarjeta || null

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

const update_saldo_by_id = async (req,res) => {
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
banco_tarjeta
  } = req.body;
  console.log("Datos recibidos para actualizar saldo a favor:", req.body);
  try {
    const result =  await executeTransactionSP(
      STORED_PROCEDURE.PATCH.ACTUALIZA_SALDO_A_FAVOR,[
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
        banco_tarjeta
      ]);
    console.log("Resultado de la actualización:", result);
    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No se encontró el saldo a favor para actualizar" });
    }else{
      res.status(200).json({
        message: "Saldo a favor actualizado correctamente",
        data: result,
      });
    }
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
}


const stripe = require('stripe')( process.env.API_STRIPE); 

const getStripeInfo = async (req, res) => {

  const { chargeId } = req.query;
  try {
    const charge = await stripe.charges.retrieve(chargeId);

    const stripeInfo = {
      id: charge.id,
      monto: charge.amount / 100,
      currency: charge.currency.toUpperCase(),
      estado: charge.status,
      fecha_pago: new Date(charge.created * 1000),
      ultimos_4_digitos: charge.payment_method_details.card.last4,
      tipo_tarjeta: charge.payment_method_details.card.brand,
      funding: charge.payment_method_details.card.funding,
      pais: charge.payment_method_details.card.country,
      authorization_code: charge.payment_method_details.card.authorization_code,
    };

    if (!charge) {
      return res.status(404).json({ message: "Cargo no encontrado" });
    }
    res.status(200).json({
      message: "Detalles del pago obtenidos correctamente",
      data: stripeInfo
    });
  } catch (error) {
    console.error("Error al obtener detalles del pago:", error);
    res.status(500).json({ error: "Error en el servidor", details: error.message });
  }
};
module.exports = {
  create,
  read,
  createNewSaldo,
  readSaldoByAgente,
  update_saldo_by_id,
  getStripeInfo
};
