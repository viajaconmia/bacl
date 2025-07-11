const facturama = require("../../Facturama/Facturama/facturama.api");

const listaClientes = () => facturama.Clients.List();

const listaCfdis = (rfc) => facturama.Cfdi.List(rfc);

const descargaCfdi = (idCfdi, type = "pdf") =>
  facturama.Cfdi.Download(type, "issued", idCfdi);

const mandarCorreo = (idCfdi, email, type = "issued") =>
  facturama.Cfdi.Send(`cfdiId=${idCfdi}&email=${email}&cfdiType=${type}`);

const descargaCfdiXML = (idCfdi) =>
  facturama.Cfdi.Download("xml", "issued", idCfdi);

const crearCfdi = (req, cfdi_data) => {
  req.context.logStep("crearCfdi se ha invocado con los sigiuentes datos");
  return facturama.Cfdi.Create3(cfdi_data, req);
};

const crearCliente = (data) => facturama.Clients.Create(data);

const cancelarCfdi = (idCfdi, motive = "03", type = "issued") =>
  facturama.Cfdi.Cancel(`${idCfdi}?type=${type}&motive=${motive}`);

const getCfdi = (idCfdi) => facturama.Cfdi.Get(idCfdi);

module.exports = {
  listaClientes,
  listaCfdis,
  descargaCfdi,
  mandarCorreo,
  crearCfdi,
  crearCliente,
  cancelarCfdi,
  getCfdi,
  descargaCfdiXML,
};
