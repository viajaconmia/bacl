const { executeSP } = require("../../../config/db");
const model = require("../model/facturas");
const { v4: uuidv4 } = require("uuid");

const create = async (req, res) => {
  try {
    const response = await model.createFactura(req.body, req);
    res.status(201).json({
      message: "Factura creado correctamente",
      data: response,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Error create from v1/mia/factura - GET",
      details: error.response?.data || error.message || error,
    });
  }
};

const isFacturada = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await model.isFacturada(id);
    res.status(200).json({
      ok: true,
      message: "Consulta exitosa",
      data: { facturada: response },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: error.message || error,
      details: error || null,
    });
  }
};

const createCombinada = async (req, res) => {
  req.context.logStep(
    "createCombinada",
    "Inicio del proceso de creación de factura combinada"
  );
  try {
    const resp = await model.createFacturaCombinada(req, req.body);
    req.context.logStep("resultado del model.createFacturaCombinada");
    console.log(resp);
    return res.status(201).json(resp.data.data);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Error en el servidor",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
};

const readConsultas = async (req, res) => {
  try {
    const { user_id } = req.query;
    let solicitudes = await model.getFacturasConsultas(user_id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const readAllConsultas = async (req, res) => {
  try {
    let solicitudes = await model.getAllFacturasConsultas();
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const readDetailsFactura = async (req, res) => {
  try {
    const { id_factura } = req.query;
    let facturas = await model.getDetailsFactura(id_factura);
    res.status(200).json(facturas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const readAllFacturas = async (req, res) => {
  try {
    const facturas = await model.getAllFacturas();
    res.status(200).json(facturas);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const deleteFacturas = async (req, res) => {
  try {
    let solicitudes = await model.deleteFacturas(req.params.id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const crearFacturaDesdeCarga = async (req,res) => {
  req.context.logStep('crearFacturaDesdeCarga', 'Iniciando creación de factura desde carga');
  const {
        fecha_emision,
        estado,
        usuario_creador,
        id_agente,
        total,
        subtotal,
        impuestos,
        saldo,
        rfc,
        id_empresa,
        uuid_factura,
        rfc_emisor,
        url_pdf,
        xml_pdf,
        items
  } = req.body;
  const id_factura = "fac-"+uuidv4();
  try {
    const response = await executeSP("sp_inserta_factura_desde_carga",[
      id_factura,
      fecha_emision,
        estado,
        usuario_creador,
        id_agente,
        total,
        subtotal,
        impuestos,
        saldo,
        rfc,
        id_empresa,
        uuid_factura,
        rfc_emisor,
        url_pdf,
        xml_pdf,
        items
    ])
    if (!response) {
      req.context.logStep('crearFacturaDesdeCarga:', 'Error al crear factura desde carga');
      throw new Error("No se pudo crear la factura desde carga");
    } else {
      res.status(201).json({
        message: "Factura creada correctamente desde carga",
        data: { id_factura, ...response }, 
        id_facturacreada:id_factura,
        items:items
      });
    }
  } catch (error) {
    req.context.logStep('Error en crearFacturaDesdeCarga:', error);
    res.status(500).json({
      error: "Error al crear factura desde carga",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
}
const asignarFacturaItems = async (req, res) => {
  const { id_factura, items } = req.body;
  console.log("body", req.body)
  
  try {
    const response = await executeSP("sp_asigna_facturas_items", [id_factura, items]);
    return res.status(200).json({
        message: "Items asignados correctamente a la factura",
        data: response
      });
  } catch (error) {
    return res.status(500).json({
      error: "Error al asignar items a la factura",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
}

const filtrarFacturas = async (req, res) => {
  const {estatusFactura} = req.body;
  try {
    const result = await executeSP("sp_filtrar_facturas",[estatusFactura]);
    if(!result){
      return res.status(404).json({
        message: "No se encontraron facturas con el parametro deseado"
      });}
    return res.status(200).json({
      message: "Facturas filtradas correctamente",
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error al filtrar facturas",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
}
module.exports = {
  create,
  deleteFacturas,
  readAllFacturas,
  createCombinada,
  readConsultas,
  readAllConsultas,
  readDetailsFactura,
  isFacturada,
  crearFacturaDesdeCarga,
  asignarFacturaItems,
  filtrarFacturas
};
