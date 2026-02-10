const { executeQuery } = require("../../../config/db");
let model = require("../model/facturamaModel");

const obtenerClientePorRfc = async (req, res) => {
  try {
    const { rfc } = req.query;

    let listClient = await model.listaClientes();
    const filtrado = listClient.find(
      ({ Rfc }) => Rfc.toUpperCase() === rfc.toUpperCase(),
    );

    if (!filtrado) {
      return res
        .status(404)
        .json({ error: `No client found with the RFC: ${clientRfc}` });
    }

    res.status(200).json(filtrado);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const obtenerListaCfdis = async (req, res) => {
  try {
    let listClient = await model.listaClientes();
    // const filtrado = listClient.find(
    //   ({ Rfc }) => Rfc.toUpperCase() === rfc.toUpperCase()
    // );

    // if (!filtrado) {
    //   return res
    //     .status(404)
    //     .json({ error: `No client found with the RFC: ${clientRfc}` });
    // }

    res.status(200).json(listClient);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const obtenerClientePorId = async (req, res) => {
  try {
    const { clientId } = req.query;

    const listClients = await model.listaClientes();
    const filtrado = listClients.find(({ Id }) => Id === clientId);

    if (!filtrado) {
      return res
        .status(404)
        .json({ error: `No client found with the Id: ${clientId}` });
    }

    res.status(200).json(filtrado);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const obtenerClientes = async (req, res) => {
  try {
    const listClients = await model.listaClientes();
    res.status(200).json(listClients);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const obtenerCfdiByFechas = async (req, res) => {
  try {
    const { start, end } = req.query || req.params;
    const listClients = await model.listaByFechas(start, end);
    res.status(200).json(listClients);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const obtenerFacturasCliente = async (req, res) => {
  try {
    const { rfc } = req.query;
    const listFacturas = await model.listaCfdis(rfc); // Asegúrate de que esta función devuelva una promesa
    const empresa = await executeQuery(
      `select e.id_empresa from empresas as e inner join datos_fiscales as d on d.id_empresa = e.id_empresa where d.rfc = ?;`,
      [rfc],
    );
    console.log(empresa);
    const id_empresa = empresa[0] ? empresa[0].id_empresa : null;
    const lista = listFacturas
      .map((factura) => {
        // return {
        //   id: factura.Id,
        //   uuid: factura.Uuid,
        // };
        return [factura.Id, factura.Uuid, rfc, id_empresa].join(",");
      })
      .join("\n");

    console.log(lista);
    res.status(200).json({ csv: lista, listFacturas });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const descargarFacturas = async (req, res) => {
  try {
    const { cfdi_id, type } = req.body;
    const dataDownload = await model.descargaCfdi(cfdi_id, type); // Asegúrate de que esta función también devuelva una promesa

    res.status(200).json(dataDownload);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const newDescargarFacturas = async (req, res) => {
  try {
    const { id, type } = req.body;
    const dataDownload = await model.descargaCfdi(id, type); // Asegúrate de que esta función también devuelva una promesa

    res
      .status(200)
      .json({ message: "cfdi obtenido con exito", data: dataDownload });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || error.status).json({
      message: error.message || "error al obtener la factura",
      data: null,
      error: error.response.data || {},
    });
  }
};

const descargarFacturasXML = async (req, res) => {
  try {
    const { cfdi_id } = req.body;
    const dataDownload = await model.descargaCfdiXML(cfdi_id); // Asegúrate de que esta función también devuelva una promesa
    console.log(dataDownload);

    res.status(200).json(dataDownload);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const mandarCorreo = async (req, res) => {
  try {
    const { id_cfdi, email } = req.body;
    const response = await model.mandarCorreo(id_cfdi, email); // Asegúrate de que esta función sea async o retorne una promesa

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const crearCfdi = async (req, res) => {
  try {
    const { cfdi } = req.body;
    const response = await model.crearCfdi(req, cfdi); // Asegúrate de que esta función sea async o retorne una promesa
    res.status(200).json(response);
  } catch (error) {
    console.log(error.response.data);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const crearCliente = async (req, res) => {
  try {
    const { client } = req.body;
    const response = await model.crearCliente(client); // Asegúrate de que esta función sea async o retorne una promesa

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const cancelarCfdi = async (req, res) => {
  try {
    const { id_cfdi, motive, type } = req.query;

    if (!id_cfdi || !motive)
      throw new Error("Falta el id o el motivo de cancelación");

    const response = await model.cancelarCfdi(id_cfdi, motive, type);

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

const getCdfi = async (req, res) => {
  try {
    const { id, type = "issued" } = req.query;

    if (!id) throw new Error("Falta el id del CFDI");

    const response = await model.getCfdi(id, type);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.response.data });
  }
};

module.exports = {
  obtenerClientes,
  crearCfdi,
  crearCliente,
  descargarFacturas,
  newDescargarFacturas,
  mandarCorreo,
  obtenerClientePorId,
  obtenerClientePorRfc,
  obtenerFacturasCliente,
  cancelarCfdi,
  descargarFacturasXML,
  getCdfi,
  obtenerCfdiByFechas,
};
