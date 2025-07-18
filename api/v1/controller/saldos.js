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
  sf.comentario,
  sf.link_stripe,
  sf.is_facturable,
  sf.is_descuento,
  sf.comprobante,
  sf.activo
FROM saldos_a_favor AS sf
INNER JOIN agente_details AS a
  ON a.id_agente = sf.id_agente
WHERE sf.id_agente = ?;`,
      [id]
    );
    console.log("Si es esta query 👌👌👌")
    console.log(saldo);
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

    let tipoTarjeta = null;

    if (data.forma_pago === "tarjeta de credito") tipoTarjeta = "credito";
    else if (data.forma_pago === "tarjeta de debito") tipoTarjeta = "debito";
    else tipoTarjeta = null;

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
      tipoTarjeta,
      data.comentario || null,
      data.link_stripe || null,
      data.is_facturable ?? false,
      data.descuento_aplicable ?? false,
      null,
    ];
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
activo
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
        activo
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

module.exports = {
  create,
  read,
  createNewSaldo,
  readSaldoByAgente,
  update_saldo_by_id
};
