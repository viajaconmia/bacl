const { executeSP } = require("../../../config/db");
const model = require("../model/saldos");

const create = async (req, res) => {
  try {
    const response = await model.createSaldo(req.body)
    res.status(201).json({ message: "Saldo creado correctamente", data: response })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

const read = async (req, res) => {
  try {
    const saldos = await model.readSaldos()
    res.status(200).json(saldos)
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

module.exports = {
  create,
  read,
}