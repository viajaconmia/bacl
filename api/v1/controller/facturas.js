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
    const response = await model.createFacturaCombinada(req.body)
    res.status(201).json({ message: "Factura creado correctamente", data: response })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error, ohterDetails: error.response.data })
  }
}

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
}