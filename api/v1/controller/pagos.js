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
    console.log("sirvo")
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
    const { SaldoAFavor, items_seleccionados } = req.body;
    if (!SaldoAFavor || !Array.isArray(items_seleccionados)) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    // 1️⃣ Un pago por servicio
    const pagosPorServicio = {};
    items_seleccionados.forEach(item => {
      if (!pagosPorServicio[item.id_servicio]) {
        pagosPorServicio[item.id_servicio] = `pag-${uuidv4()}`;
      }
    });

    // 2️⃣ Inyectar id_pago en cada item
    const itemsConPago = items_seleccionados.map(item => ({
      ...item,
      id_pago: pagosPorServicio[item.id_servicio]
    }));

    // 3️⃣ Montos para la respuesta
    const montoAplicado = itemsConPago
      .reduce((sum, it) => sum + (it.saldo - it.saldonuevo), 0);
    const nuevoSaldo = SaldoAFavor.saldo;

    // 4️⃣ Llamada al SP (12 parámetros)
    await executeSP(
      "sp_asignar_saldosAF_a_pagos",
      [
        SaldoAFavor.id_saldos,               // 1
        SaldoAFavor.id_agente,               // 2
        SaldoAFavor.metodo_pago,             // 3
        SaldoAFavor.fecha_pago,              // 4
        SaldoAFavor.concepto,                // 5
        SaldoAFavor.referencia,              // 6
        SaldoAFavor.currency,                // 7
        SaldoAFavor.tipo_tarjeta,            // 8
        SaldoAFavor.link_stripe,             // 9
        SaldoAFavor.ult_digits ?? null,      // 10
        JSON.stringify(itemsConPago),        // 11 p_items_json
        nuevoSaldo                           // 12 p_nuevo_saldo
      ]
    );

    res.json({
      success: true,
      ids_pagos: Object.values(pagosPorServicio),
      monto_aplicado: montoAplicado,
      nuevo_saldo: nuevoSaldo
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al aplicar pagos", error: err.message });
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
