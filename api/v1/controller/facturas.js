const model = require("../model/facturas")

const create = async (req, res) => {
  try {
    const response = await model.createFactura(req.body)
    res.status(201).json({ message: "Factura creado correctamente", data: response })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error, ohterDetails: error.response.data })
  }
}

const createCombinada = async (req, res) => {
  try {

    const resp = await model.createFacturaCombinada(req.body);

    return res
      .status(resp.status)
      .json(resp.data);
  } catch (error) {
    console.error('Error en createCombinada:', error);

    if (error.response) {
      // 400, 500, o cualquier status que venga de Facturama
      return res
        .status(error.response.status)
        .json(error.response.data);
    }

    return res
      .status(500)
      .json({
        error: 'Error en el servidor',
        message: error.message
      });
  }
};


const readConsultas = async (req, res) => {
  try {
    const { user_id } = req.query
    let solicitudes = await model.getFacturasConsultas(user_id)
    res.status(200).json(solicitudes)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error })
  }
}

const readAllConsultas = async (req, res) => {
  try {
    let solicitudes = await model.getAllFacturasConsultas()
    res.status(200).json(solicitudes)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error })
  }
}

const readDetailsFactura = async (req, res) => {
  try {
    const { id_factura } = req.query;
    let facturas = await model.getDetailsFactura(id_factura);
    res.status(200).json(facturas)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error })
  }
}

const readAllFacturas = async (req, res) => {
  try {
    const facturas = await model.getAllFacturas()
    res.status(200).json(facturas)
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

module.exports = {
  create,
  readAllFacturas,
  createCombinada,
  readConsultas,
  readAllConsultas,
  readDetailsFactura,
}