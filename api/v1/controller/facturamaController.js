let model = require("../model/facturamaModel")

const obtenerClientePorRfc = async (req, res) => {
  try {
    const { clientRfc } = req.query

    let listClient = await model.listaClientes()
    const filtrado = listClient.find(({ Rfc }) => Rfc.toUpperCase() === clientRfc.toUpperCase())

    if (!filtrado) {
      return res.status(404).json({ error: `No client found with the RFC: ${clientRfc}` })
    }

    res.status(200).json(filtrado)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error.response.data })
  }
}

const obtenerClientePorId = async (req, res) => {
  try {
    const { clientId } = req.query

    const listClients = await model.listaClientes()
    const filtrado = listClients.find(({ Id }) => Id === clientId)

    if (!filtrado) {
      return res.status(404).json({ error: `No client found with the Id: ${clientId}` })
    }

    res.status(200).json(filtrado)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error.response.data })
  }
}

const obtenerClientes = async (req, res) => {
  try {
    const listClients = await model.listaClientes()
    res.status(200).json(listClients)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error.response.data })
  }
}

const obtenerFacturasCliente = async (req, res) => {
  try {
    const { rfc } = req.query
    const listFacturas = await model.listaCfdis(rfc)  // Asegúrate de que esta función devuelva una promesa

    res.status(200).json(listFacturas)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error.response.data })
  }
}

const descargarFacturas = async (req, res) => {
  try {
    const { cfdi_id } = req.body
    const dataDownload = await model.descargaCfdi(cfdi_id)  // Asegúrate de que esta función también devuelva una promesa

    res.status(200).json(dataDownload)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error.response.data })
  }
}

const mandarCorreo = async (req, res) => {
  try {
    const { id_cfdi, email } = req.body
    const response = await model.mandarCorreo(id_cfdi, email)  // Asegúrate de que esta función sea async o retorne una promesa

    res.status(200).json(response)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error.response.data })
  }
}

const crearCfdi = async (req, res) => {
  try {
    const { cfdi } = req.body
    const response = await model.crearCfdi(cfdi)  // Asegúrate de que esta función sea async o retorne una promesa
    res.status(200).json(response)
  } catch (error) {
    console.log(error.response.data)
    res.status(500).json({ error: 'Internal Server Error', details: error.response.data })
  }
}

const crearCliente = async (req, res) => {
  try {
    const { client } = req.body
    const response = await model.crearCliente(client)  // Asegúrate de que esta función sea async o retorne una promesa

    res.status(200).json(response)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error.response.data })
  }
}

const cancelarCfdi = async (req, res) => {
  try {
    const { id_cfdi, motive, type } = req.body

    if (!id_cfdi || !motive) throw new Error("Falta el id o el motivo de cancelación")

    const response = await model.cancelarCfdi(id_cfdi, motive, type)

    res.status(200).json(response)

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error.response.data })
  }
}

module.exports = {
  obtenerClientes,
  crearCfdi,
  crearCliente,
  descargarFacturas,
  mandarCorreo,
  obtenerClientePorId,
  obtenerClientePorRfc,
  obtenerFacturasCliente,
  cancelarCfdi
}
