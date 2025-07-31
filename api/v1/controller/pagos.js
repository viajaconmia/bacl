const model = require("../model/pagos");
const { v4: uuidv4 } = require("uuid");
const { executeSP } = require("../../../config/db");
const create = async (req, res) => {
  try {
    const response = await model.createPagos(req.body);
    res.status(201).json({ message: "Pago creados correctamente", data: response });
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
    const { user_id } = req.query
    let solicitudes = await model.getPagosConsultas(user_id)
    res.status(200).json(solicitudes)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error })
  }
}

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

const pagoPorSaldoAFavor = async (req, res) => {
  try {
    const {
      SaldoAFavor,
      items_seleccionados // [{ total, id_item, fraccion, id_servicio }]
    } = req.body;

    if (!SaldoAFavor || !items_seleccionados || !Array.isArray(items_seleccionados)) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos requeridos en el body"
      });
    }

    // Generar un id_pago para cada item/servicio
    const ids_pago = items_seleccionados.map(() => `pag-${uuidv4()}`);

    // Ejecutar el SP
    await executeSP(
      "sp_asignar_saldosAF_a_pagos",
      [
        SaldoAFavor.id_saldos,
        SaldoAFavor.id_agente,
        SaldoAFavor.metodo_pago,
        SaldoAFavor.fecha_pago,
        SaldoAFavor.concepto,
        SaldoAFavor.referencia,
        SaldoAFavor.currency,
        SaldoAFavor.tipo_tarjeta,
        SaldoAFavor.link_stripe,
        SaldoAFavor.ult_digits ?? SaldoAFavor.last_digits ?? null, // soporte para ambos nombres
        JSON.stringify(items_seleccionados), // ahora ya trae id_servicio dentro de cada item
        JSON.stringify(ids_pago)
      ]
    );

    res.status(200).json({
      success: true,
      message: "Pagos aplicados correctamente",
      ids_pagos: ids_pago
    });

  } catch (error) {
    console.error("Error al aplicar pagos:", error);
    res.status(500).json({
      success: false,
      message: "Error al aplicar pagos",
      error: error.message
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
  pagoPorSaldoAFavor,
};
