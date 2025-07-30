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
  // Simulación del body que debo recibir
  const SaldoAFavor = {
    activo: 1,
    comentario: null,
    comprobante: null,
    concepto: null,
    currency: "MXN",
    fecha_creacion: "2025-07-29T17:10:59.000Z",
    fecha_pago: "2025-07-22T06:00:00.000Z",
    id_agente: "78360a2a-4935-47bd-b2ca-3d1e4d808ccf",
    id_saldos: 98,
    is_descuento: 1,
    is_facturable: 0,
    link_stripe: null,
    metodo_pago: "transferencia",
    monto: "2000.00",
    nombre: "Wendy Rojo Sanchez",
    referencia: "asdfg",
    saldo: "2000.00",
    tipo_tarjeta: "credito",
    last_digits: null
  };

  const items_seleccionados = {
    items: [
      { total: 1009.20, id_item: "ite-2fbf652e-d9ad-4ad5-8868-2e9e85fe7d30", fraccion: 0 },
      { total: 1009.20, id_item: "ite-9d391180-4e68-4c65-a986-18df8a234e24", fraccion:990.80},
    ]
  };

  const id_servicios = [
    "ser-3e87f0f3-46c8-4d0c-a046-fa0b216fd078", // aqui solo era un servicio
    "ser-60575e69-3989-4319-9dbf-3d3f9804b271"
  ];

  try {
    // Generar un id_pago por cada item
    const ids_pago = items_seleccionados.items.map(() => `pag-${uuidv4()}`);

    // Ejecutar SP
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
        SaldoAFavor.last_digits, // last_digits por ahora
        JSON.stringify(items_seleccionados.items),
        JSON.stringify(id_servicios),
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
