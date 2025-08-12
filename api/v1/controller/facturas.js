const { executeSP, runTransaction } = require("../../../config/db");
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
// const createEmi = async (req, res) => {
//   req.context.logStep(
//     "createCombinada",
//     "Inicio del proceso de creación de factura combinada"
//   );
//   try {
//     const resp = await model.crearFacturaEmi(req, req.body);
//     req.context.logStep("resultado del model.createFacturaCombinada");
//     console.log(resp);
//     return res.status(201).json(resp.data.data);
//   } catch (error) {
//     console.log("ESTE ES EL ERRORRRRRRRRRrrr", error);
//     res.status(400).json({
//       error: "Error en el servidor",
//       details: error.message || error,
//       otherDetails: error || error.response?.data || null,
//     });
//   }
// };



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
        url_xml,
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
        url_xml,
        items
    ])
    if (!response) {
      req.context.logStep('crearFacturaDesdeCarga:', 'Error al crear factura desde carga');
      throw new Error("No se pudo crear la factura desde carga");
    } else {
      res.status(201).json({
        message: "Factura creada correctamente desde carga",
        data: { id_factura, ...response }, 
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
// Este es el endpoint para el caso 1a1
// const crearFacturaDesdeCargaPagos = async(req,res)=>{
//   const { fecha_emision, estado, usuario_creador, id_agente, total, subtotal, impuestos, saldo, rfc, id_empresa, uuid_factura, rfc_emisor, url_pdf, url_xml , raw_id
//   } = req.body;
// // de una validamos el tipo de pago 

//   const id_factura = "fac-"+uuidv4();
//   const query = `INSERT INTO facturas (id_factura, fecha_emision, estado, usuario_creador, id_agente, total, subtotal, impuestos, saldo, rfc, id_empresa, uuid_factura, rfc_emisor, url_pdf, url_xml)
//                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
// if (raw_id.toString().includes("pag-")) {
//   var id = 'id_pago';  
// } else {
//   var id = 'id_saldo_a_favor'; 
// }
// const query2 = `INSERT INTO facturas_pagos_y_saldos (${id}, id_factura, monto)
//                  VALUES (?, ?, ?)`; 
//   try {
//     runTransaction(async (connection) => {
//       const [result] = await connection.query(query, [
//         id_factura,
//         fecha_emision,
//         estado,
//         usuario_creador,
//         id_agente,
//         total,
//         subtotal,
//         impuestos,
//         saldo,
//         rfc,
//         id_empresa,
//         uuid_factura,
//         rfc_emisor,
//         url_pdf,
//         url_xml
//       ]);
//       if (result.affectedRows === 0) {
//         throw new Error("No se pudo crear la factura desde carga");
//       }
//       const [result2] = await connection.query(query2, [
//         raw_id, 
//         id_factura, 
//         total
//       ]);
//       if (result2.affectedRows === 0) {
//         throw new Error("No se pudo asignar el pago o saldo a favor a la factura");
//       }
//       res.status(201).json({
//         message: "Factura creada correctamente desde carga con pago o saldo a favor",
//         data: { id_factura, raw_id }
//       });
//     });
//   } catch (error) {
//     res.status(500).json({
//       error: "Error al crear factura desde carga con pago o saldo a favor", 
//   })
// }
// }

const createEmi = async (req, res) => {
  req.context.logStep("createEmi", "Inicio del proceso de creación de factura (emi)");
  try {
    const resp = await model.crearFacturaEmi(req, req.body);

    console.log("response facturama controller:",resp)

    const facturamaData =
      resp?.facturama?.Id ? resp.facturama :
      resp?.data?.facturama?.Id ? resp.data.facturama :
      resp?.data?.Id ? resp.data :
      resp?.Id ? resp :
      null;

    if (!facturamaData) {
      return res.status(500).json({
        ok: false,
        message: "El modelo no devolvió los datos de Facturama esperados",
        detail: resp
      });
    }

    return res.status(201).json({ data: facturamaData });
  } catch (error) {
    const status = error?.response?.status || error?.statusCode || 500;
    const payload = error?.response?.data || error?.details || { message: error?.message || "Error" };
    return res.status(status).json({
      ok: false,
      message: payload.Message || payload.message || "Error al timbrar",
      detail: payload,
    });
  }
};

// const crearFacturaDesdeCargaPagos = async (req, res) => {
//   // desestructuracion para el case de carga de factura
//   let {
//     fecha_emision,
//     estado,
//     usuario_creador,
//     id_agente,
//     total,
//     subtotal,
//     impuestos,
//     saldo,
//     rfc,
//     id_empresa,
//     uuid_factura,
//     rfc_emisor,
//     url_pdf,
//     url_xml,
//     raw_id, // siempre viene del body: "pag-..." (uuid) o entero (id saldo)
//   } = req.body;
//   // desestructuracion para facturama
//   //const { fecha_emision,total,subtotal,impuestos} = req.body
//   const { info_user } = req.body;
//   const { datos_empresa } = req.body;
//   const facturamaArgs = [fecha_emision, 'Confirmada', info_user.id_user
//     , total, subtotal, impuestos, 0,datos_empresa.rfc,datos_empresa.id_empresa,"","NAL190807BU2",]
//   const {info_pago } = req.body
//   console.log("body", req.body)
//   console.log("raw", info_pago.raw_id)

//   usuario_creador = usuario_creador || id_agente;

//   if (raw_id === undefined || raw_id === null) {
//     if (info_pago.raw_id === undefined) {
//       return res.status(400).json({ error: "Se requiere raw_id para vincular la factura." });
//     } else {
//       raw_id === info_pago.raw_id;
//     }
//   }

//   // Solo para decidir la columna FK; el valor original de raw_id se conserva para el INSERT
//   const rawIdStr = String(raw_id).trim().toLowerCase();
//   const fkColumn = rawIdStr.startsWith("pag-") ? "id_pago" : "id_saldo_a_favor";

//   const id_factura = "fac-" + uuidv4();

//   // ¿El body ya trae datos suficientes de la factura?
//   const bodyTieneFactura =
//     Boolean(fecha_emision) &&
//     (Boolean(uuid_factura) || Boolean(url_xml)) &&
//     (total != null) &&
//     (subtotal != null);

//   const mapFacturamaToFacturaRow = (fd) => {
//     const f = fd || {};
//     const links = f.Links || f.links || {};
//     const comp = f.Complemento || f.complemento || {};
//     const timbre = comp.TimbreFiscalDigital || comp.timbreFiscalDigital || {};
//     const emisor = f.Emisor || f.emisor || {};
//     const totales = f.Totales || f.totales || {};

//     const mTotal = f.Total ?? totales.Total ?? total ?? 0;
//     const mSub   = f.SubTotal ?? f.Subtotal ?? totales.SubTotal ?? subtotal ?? 0;
//     const mImp   = (mTotal != null && mSub != null) ? Number(mTotal) - Number(mSub) : (impuestos ?? 0);

//     return {
//       fecha_emision: f.Fecha || f.fecha || new Date(),
//       estado: estado || "Timbrada",
//       usuario_creador: usuario_creador || id_agente,
//       id_agente,
//       total: mTotal,
//       subtotal: mSub,
//       impuestos: mImp,
//       saldo: saldo ?? 0,
//       rfc,
//       id_empresa: id_empresa ?? null,
//       uuid_factura: timbre.UUID || timbre.Uuid || f.Uuid || f.UUID || uuid_factura || null,
//       rfc_emisor: emisor.Rfc || emisor.RFC || rfc_emisor || null,
//       url_pdf: links.Pdf || links.pdf || f.PdfUrl || f.pdfUrl || url_pdf || null,
//       url_xml: links.Xml || links.xml || f.XmlUrl || f.xmlUrl || url_xml || null,
//     };
//   };

//   let row;
//   let facturamaData = null;
//   let source = "body";

//   try {
//     if (!bodyTieneFactura) {
//       // Timbra con Facturama (lógica de createEmi integrada)
//       const resp = await model.crearFacturaEmi(facturamaArgs);
//       facturamaData =
//         resp?.facturama?.Id ? resp.facturama :
//         resp?.data?.facturama?.Id ? resp.data.facturama :
//         resp?.data?.Id ? resp.data :
//         resp?.Id ? resp :
//         null;

//       if (!facturamaData) {
//         return res.status(500).json({
//           ok: false,
//           message: "El modelo no devolvió los datos de Facturama esperados",
//           detail: resp
//         });
//       }
//       row = mapFacturamaToFacturaRow(facturamaData);
//       source = "facturama";
//     } else {
//       // Usa los datos del body
//       const mTotal = total ?? 0;
//       const mSub   = subtotal ?? 0;
//       const mImp = (impuestos != null) ? impuestos : (Number(mTotal) - Number(mSub));
//       console.log("row", row)
      
//       row = {
//         estado,
//         usuario_creador: usuario_creador || id_agente,
//         id_agente,
//         total: mTotal,
//         subtotal: mSub,
//         impuestos: mImp,
//         saldo: saldo ?? 0,
//         rfc,
//         id_empresa: id_empresa ?? null,
//         uuid_factura: uuid_factura ?? null,
//         rfc_emisor: rfc_emisor ?? null,
//         url_pdf: url_pdf ?? null,
//         url_xml: url_xml ?? null,
//       };
//       if (row.id_agente == null) {
//         row==facturamaArgs
//       }
//     }
    
//       console.log("row", row)

//     const insertFacturaSQL = `
//       INSERT INTO facturas (
//         id_factura, fecha_emision, estado, usuario_creador, id_agente,
//         total, subtotal, impuestos, saldo, rfc, id_empresa,
//         uuid_factura, rfc_emisor, url_pdf, url_xml
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;

//     // fkColumn es seguro (solo "id_pago" o "id_saldo_a_favor")
//     const insertLinkSQL = `
//       INSERT INTO facturas_pagos_y_saldos (${fkColumn}, id_factura, monto)
//       VALUES (?, ?, ?)
//     `;

//     await runTransaction(async (connection) => {
//       const [r1] = await connection.query(insertFacturaSQL, [
//         id_factura,
//         row.fecha_emision,
//         row.estado,
//         row.usuario_creador || row.id_agente,
//         row.id_agente,
//         row.total,
//         row.subtotal,
//         row.impuestos,
//         row.saldo,
//         row.rfc,
//         row.id_empresa,
//         row.uuid_factura,
//         row.rfc_emisor,
//         row.url_pdf,
//         row.url_xml
//       ]);
//       if (!r1?.affectedRows) throw new Error("No se pudo crear la factura");

//       // IMPORTANTE: aquí usamos el valor ORIGINAL de raw_id (uuid o entero)
//       const [r2] = await connection.query(insertLinkSQL, [
//         raw_id,
//         id_factura,
//         row.total
//       ]);
//       if (!r2?.affectedRows) throw new Error("No se pudo vincular el pago/saldo a la factura");

//       return res.status(201).json({
//         message: "Factura creada correctamente",
//         data: {
//           id_factura,
//           raw_id,
//           source,
//           facturama: source === "facturama"
//             ? { Id: facturamaData?.Id, Uuid: row.uuid_factura, links: { pdf: row.url_pdf, xml: row.url_xml } }
//             : undefined
//         }
//       });
//     });
//   } catch (error) {
//     const status  = error?.response?.status || error?.statusCode || 500;
//     const payload = error?.response?.data || error?.details || { message: error?.message || "Error" };
//     return res.status(status).json({
//       ok: false,
//       message: payload.Message || payload.message || "Error al crear la factura",
//       detail: payload,
//     });
//   }
// };

const crearFacturaDesdeCargaPagos = async (req, res) => {
  // desestructuracion para el case de carga de factura
  let {
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
    url_xml,
    raw_id, // siempre viene del body: "pag-..." (uuid) o entero (id saldo)
  } = req.body;
  
  // desestructuracion para facturama
  const { info_user } = req.body;
  const { datos_empresa } = req.body;
  
  // Preparar argumentos por defecto de Facturama
  const facturamaArgs = {
    fecha_emision: fecha_emision || new Date(),
    estado: estado || 'Confirmada',
    usuario_creador: usuario_creador || info_user?.id_user,
    id_agente: id_agente || info_user?.id_user,
    total: total || 0,
    subtotal: subtotal || 0,
    impuestos: impuestos || 0,
    saldo: saldo || 0,
    rfc: rfc || datos_empresa?.rfc,
    id_empresa: id_empresa || datos_empresa?.id_empresa,
    uuid_factura: uuid_factura || "",
    rfc_emisor: rfc_emisor || "NAL190807BU2",
    url_pdf: url_pdf || "",
    url_xml: url_xml || ""
  };

  const {info_pago } = req.body;
  console.log("body", req.body);
  console.log("raw", info_pago?.raw_id);

  usuario_creador = usuario_creador || id_agente;

  if (raw_id === undefined || raw_id === null) {
    if (info_pago?.raw_id === undefined) {
      return res.status(400).json({ error: "Se requiere raw_id para vincular la factura." });
    } else {
      raw_id = info_pago.raw_id; // Aquí había un error (=== en lugar de =)
    }
  }

  // Solo para decidir la columna FK; el valor original de raw_id se conserva para el INSERT
  const rawIdStr = String(raw_id).trim().toLowerCase();
  const fkColumn = rawIdStr.startsWith("pag-") ? "id_pago" : "id_saldo_a_favor";

  const id_factura = "fac-" + uuidv4();

  // ¿El body ya trae datos suficientes de la factura?
  const bodyTieneFactura =
    Boolean(fecha_emision) &&
    (Boolean(uuid_factura) || Boolean(url_xml)) &&
    (total != null) &&
    (subtotal != null);

  const mapFacturamaToFacturaRow = (fd) => {
    const f = fd || {};
    const links = f.Links || f.links || {};
    const comp = f.Complemento || f.complemento || {};
    const timbre = comp.TimbreFiscalDigital || comp.timbreFiscalDigital || {};
    const emisor = f.Emisor || f.emisor || {};
    const totales = f.Totales || f.totales || {};

    const mTotal = f.Total ?? totales.Total ?? total ?? 0;
    const mSub   = f.SubTotal ?? f.Subtotal ?? totales.SubTotal ?? subtotal ?? 0;
    const mImp   = (mTotal != null && mSub != null) ? Number(mTotal) - Number(mSub) : (impuestos ?? 0);

    return {
      fecha_emision: f.Fecha || f.fecha || facturamaArgs.fecha_emision,
      estado: estado || "Timbrada",
      usuario_creador: usuario_creador || facturamaArgs.usuario_creador,
      id_agente: id_agente || facturamaArgs.id_agente,
      total: mTotal,
      subtotal: mSub,
      impuestos: mImp,
      saldo: saldo ?? facturamaArgs.saldo,
      rfc: rfc || facturamaArgs.rfc,
      id_empresa: id_empresa ?? facturamaArgs.id_empresa,
      uuid_factura: timbre.UUID || timbre.Uuid || f.Uuid || f.UUID || uuid_factura || facturamaArgs.uuid_factura,
      rfc_emisor: emisor.Rfc || emisor.RFC || rfc_emisor || facturamaArgs.rfc_emisor,
      url_pdf: links.Pdf || links.pdf || f.PdfUrl || f.pdfUrl || url_pdf || facturamaArgs.url_pdf,
      url_xml: links.Xml || links.xml || f.XmlUrl || f.xmlUrl || url_xml || facturamaArgs.url_xml,
    };
  };

  let row;
  let facturamaData = null;
  let source = "body";

  try {
    if (!bodyTieneFactura) {
      // Timbra con Facturama (lógica de createEmi integrada)
      const resp = await model.crearFacturaEmi(req, req.body);
      console.log("HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",resp,resp.data.facturama.Complement.TaxStamp.Uuid)
      facturamaData =
        resp?.facturama?.Id ? resp.facturama :
        resp?.data?.facturama?.Id ? resp.data.facturama :
        resp?.data?.Id ? resp.data :
        resp?.Id ? resp :
        null;

      if (!facturamaData) {
        return res.status(500).json({
          ok: false,
          message: "El modelo no devolvió los datos de Facturama esperados",
          detail: resp
        });
      }
      row = mapFacturamaToFacturaRow(facturamaData);
      source = "facturama";
    } else {
      // Usa los datos del body o los valores por defecto de facturamaArgs
      const mTotal = total ?? facturamaArgs.total;
      const mSub   = subtotal ?? facturamaArgs.subtotal;
      const mImp = (impuestos != null) ? impuestos : (Number(mTotal) - Number(mSub));
      
      row = {
        fecha_emision: fecha_emision || facturamaArgs.fecha_emision,
        estado: estado || facturamaArgs.estado,
        usuario_creador: usuario_creador || facturamaArgs.usuario_creador,
        id_agente: id_agente || facturamaArgs.id_agente,
        total: mTotal,
        subtotal: mSub,
        impuestos: mImp,
        saldo: saldo ?? facturamaArgs.saldo,
        rfc: rfc || facturamaArgs.rfc,
        id_empresa: id_empresa ?? facturamaArgs.id_empresa,
        uuid_factura: uuid_factura || resp.data.facturama.Complement.TaxStamp.Uuid,
        rfc_emisor: rfc_emisor || facturamaArgs.rfc_emisor,
        url_pdf: url_pdf || facturamaArgs.url_pdf,
        url_xml: url_xml || facturamaArgs.url_xml,
      };
    }
    
    console.log("row final", row);

    const insertFacturaSQL = `
      INSERT INTO facturas (
        id_factura, fecha_emision, estado, usuario_creador, id_agente,
        total, subtotal, impuestos, saldo, rfc, id_empresa,
        uuid_factura, rfc_emisor, url_pdf, url_xml
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // fkColumn es seguro (solo "id_pago" o "id_saldo_a_favor")
    const insertLinkSQL = `
      INSERT INTO facturas_pagos_y_saldos (${fkColumn}, id_factura, monto)
      VALUES (?, ?, ?)
    `;

    await runTransaction(async (connection) => {
      const [r1] = await connection.query(insertFacturaSQL, [
        id_factura,
        row.fecha_emision,
        row.estado,
        row.usuario_creador,
        row.id_agente,
        row.total,
        row.subtotal,
        row.impuestos,
        row.saldo,
        row.rfc,
        row.id_empresa,
        row.uuid_factura,
        row.rfc_emisor,
        row.url_pdf,
        row.url_xml
      ]);
      if (!r1?.affectedRows) throw new Error("No se pudo crear la factura");

      // IMPORTANTE: aquí usamos el valor ORIGINAL de raw_id (uuid o entero)
      const [r2] = await connection.query(insertLinkSQL, [
        raw_id,
        id_factura,
        row.total
      ]);
      if (!r2?.affectedRows) throw new Error("No se pudo vincular el pago/saldo a la factura");

      return res.status(201).json({
        data: facturamaData,
        message: "Factura creada correctamente",
        data: {
          id_factura,
          raw_id,
          source,
          facturama: source === "facturama"
            ? { Id: facturamaData?.Id, Uuid: row.uuid_factura, links: { pdf: row.url_pdf, xml: row.url_xml } }
            : undefined
        }
      });
      
    });
  } catch (error) {
    const status  = error?.response?.status || error?.statusCode || 500;
    const payload = error?.response?.data || error?.details || { message: error?.message || "Error" };
    return res.status(status).json({
      ok: false,
      message: payload.Message || payload.message || "Error al crear la factura",
      detail: payload,
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
  filtrarFacturas,
  createEmi,
  crearFacturaDesdeCargaPagos,
};
