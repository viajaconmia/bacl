const facturama = require("../../Facturama/Facturama/facturama.api")

const listaClientes = () => facturama.Clients.List()

const listaCfdis = (rfc) => facturama.Cfdi.List(rfc)

const descargaCfdi = (idCfdi) => facturama.Cfdi.Download("pdf", "issued", idCfdi)

const mandarCorreo = (idCfdi, email, type = "issued") => facturama.Cfdi.Send(`cfdiId=${idCfdi}&email=${email}&cfdiType=${type}`)

const crearCfdi = (cfdi_data) => facturama.Cfdi.Create3(cfdi_data)

const crearCliente = (data) => facturama.Clients.Create(data)

const cancelarCfdi = (idCfdi, motive = "03", type = "issued") => facturama.Cfdi.Cancel(`${idCfdi}?type=${type}&motive=${motive}`)

module.exports = {
  listaClientes,
  listaCfdis,
  descargaCfdi,
  mandarCorreo,
  crearCfdi,
  crearCliente,
  cancelarCfdi
}