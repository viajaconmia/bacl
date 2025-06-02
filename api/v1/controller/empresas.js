const model = require("../model/empresas")

const create = async (req, res) => {
  try {
    const response = await model.createEmpresa(req.body)
    res.status(201).json({ message: "Agente creado correctamente", data: response })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

const update = async (req, res) => {
  try {
    const response = await model.updateEmpresa(req.body)
    res.status(201).json({ message: "Empresa actualizada correctamente", data: response })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

const deleteEmpresaById = async (req, res) => {
  try {
    const empresa = await model.deleteEmpresa(req.query.id_empresa)
    res.status(201).json({ message: "Empresa eliminada correctamente", data: empresa })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}



const read = async (req, res) => {
  try {
    const agentes = await model.getEmpresas()
    res.status(200).json(agentes)
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

const readAll = async (req, res) => {
  try {
    const agentes = await model.getAllEmpresas()
    res.status(200).json(agentes)
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

const readbyId = async (req, res) => {
  try {
    const agentes = await model.getEmpresaById(req.query)
    res.status(200).json(agentes)
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

module.exports = {
  create,
  read,
  readbyId,
  update,
  deleteEmpresaById,
  readAll,
}