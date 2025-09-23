const { executeSP, runTransaction, executeSP2 } = require("../../../config/db");
const model = require("../model/facturas");
const { v4: uuidv4 } = require("uuid");
const { get } = require("../router/mia/reservasClient");
const { ShortError } = require("../../../middleware/errorHandler");

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
      error: error.message || "Error create from v1/mia/factura - GET",
      details: error.response?.data || error.details.data || error,
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

const crearFacturaDesdeCarga = async (req, res) => {
  req.context.logStep(
    "crearFacturaDesdeCarga",
    "Iniciando creación de factura desde carga"
  );
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
    items,
  } = req.body;
  const id_factura = "fac-" + uuidv4();

  try {
    console.log("😒😒😒😒😒", req.bo);
    const response = await executeSP("sp_inserta_factura_desde_carga", [
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
      items,
    ]);

    if (!response) {
      req.context.logStep(
        "crearFacturaDesdeCarga:",
        "Error al crear factura desde carga"
      );
      throw new Error("No se pudo crear la factura desde carga");
    } else {
      console.log(id_factura, response, items);
      res.status(201).json({
        message: "Factura creada correctamente desde carga",
        data: { id_factura, ...response },
      });
    }
  } catch (error) {
    req.context.logStep("Error en crearFacturaDesdeCarga:", error);
    res.status(500).json({
      error: "Error al crear factura desde carga",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
};

const asignarFacturaItems = async (req, res) => {
  const { id_factura, items } = req.body;
  console.log("body", req.body);

  try {
    const response = await executeSP("mia3.sp_asigna_facturas_items", [
      id_factura,
      items,
    ]);
    return res.status(200).json({
      message: "Items asignados correctamente a la factura",
      data: response,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error al asignar items a la factura",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
};

const filtrarFacturas = async (req, res) => {
  const { estatusFactura, id_factura } = req.body;
  try {
    const result = await executeSP("sp_filtrar_facturas", [
      estatusFactura,
      id_factura,
    ]);
    if (!result) {
      return res.status(404).json({
        message: "No se encontraron facturas con el parametro deseado",
      });
    }
    return res.status(200).json({
      message: "Facturas filtradas correctamente",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error al filtrar facturas",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
};
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

const get_agente_facturas = async (req, res) => {
  const { id_agente } = req.query;

  try {
    if (!id_agente) {
      throw new ShortError("No se encontro el id de agente", 404);
    }
    // 2. Ejecutar el Stored Procedure y pasar el ID del agente
    const facturas = await executeSP("get_agente_facturas", [id_agente]);
    // 3. Verificar si se encontraron facturas
    // if (facturas.length === 0) {
    //   return res.status(400).json({
    //     message: "No se encontraron facturas para el agente proporcionado.",
    //     data: [],
    //   });
    // }

    // 4. Enviar la respuesta con las facturas encontradas
    res.status(200).json({
      message: "Facturas del agente obtenidas correctamente.",
      data: facturas,
    });
  } catch (error) {
    // 5. Manejar errores
    req.context.logStep("Error en get_agente_facturas:", error);
    res.status(500).json({
      error: error,
      message: error.message || "Error al obtener facturas",
      data: null,
    });
  }
};

const createEmi = async (req, res) => {
  req.context.logStep(
    "createEmi",
    "Inicio del proceso de creación de factura (emi)"
  );
  try {
    const resp = await model.crearFacturaEmi(req, req.body);

    const facturamaData = resp?.facturama?.Id
      ? resp.facturama
      : resp?.data?.facturama?.Id
      ? resp.data.facturama
      : resp?.data?.Id
      ? resp.data
      : resp?.Id
      ? resp
      : null;

    if (!facturamaData) {
      return res.status(500).json({
        ok: false,
        message: "El modelo no devolvió los datos de Facturama esperados",
        detail: resp,
      });
    }

    return res.status(201).json({ data: facturamaData });
  } catch (error) {
    const status = error?.response?.status || error?.statusCode || 500;
    const payload = error?.response?.data ||
      error?.details || { message: error?.message || "Error" };
    return res.status(status).json({
      ok: false,
      message: payload.Message || payload.message || "Error al timbrar",
      detail: payload,
    });
  }
};

const crearFacturaDesdeCargaPagos = async (req, res) => {
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
    raw_id, // siempre viene del body: "pag-..." (uuid) o entero (id saldo)
  } = req.body;

  if (raw_id === undefined || raw_id === null) {
    return res
      .status(400)
      .json({ error: "Se requiere raw_id para vincular la factura." });
  }

  // Solo para decidir la columna FK; el valor original de raw_id se conserva para el INSERT
  const rawIdStr = String(raw_id).trim().toLowerCase();
  const fkColumn = rawIdStr.startsWith("pag-") ? "id_pago" : "id_saldo_a_favor";

  const id_factura = "fac-" + uuidv4();

  // ¿El body ya trae datos suficientes de la factura?
  const bodyTieneFactura =
    Boolean(fecha_emision) &&
    (Boolean(uuid_factura) || Boolean(url_xml)) &&
    total != null &&
    subtotal != null;

  const mapFacturamaToFacturaRow = (fd) => {
    const f = fd || {};
    const links = f.Links || f.links || {};
    const comp = f.Complemento || f.complemento || {};
    const timbre = comp.TimbreFiscalDigital || comp.timbreFiscalDigital || {};
    const emisor = f.Emisor || f.emisor || {};
    const totales = f.Totales || f.totales || {};

    const mTotal = f.Total ?? totales.Total ?? total ?? 0;
    const mSub = f.SubTotal ?? f.Subtotal ?? totales.SubTotal ?? subtotal ?? 0;
    const mImp =
      mTotal != null && mSub != null
        ? Number(mTotal) - Number(mSub)
        : impuestos ?? 0;

    return {
      fecha_emision: f.Fecha || f.fecha || new Date(),
      estado: estado || "Timbrada",
      usuario_creador: usuario_creador ?? null,
      id_agente,
      total: mTotal,
      subtotal: mSub,
      impuestos: mImp,
      saldo: saldo ?? 0,
      rfc,
      id_empresa: id_empresa ?? null,
      uuid_factura:
        timbre.UUID || timbre.Uuid || f.Uuid || f.UUID || uuid_factura || null,
      rfc_emisor: emisor.Rfc || emisor.RFC || rfc_emisor || null,
      url_pdf:
        links.Pdf || links.pdf || f.PdfUrl || f.pdfUrl || url_pdf || null,
      url_xml:
        links.Xml || links.xml || f.XmlUrl || f.xmlUrl || url_xml || null,
    };
  };

  let row;
  let facturamaData = null;
  let source = "body";

  try {
    if (!bodyTieneFactura) {
      // Timbra con Facturama (lógica de createEmi integrada)
      const resp = await model.crearFacturaEmi(req, req.body);
      facturamaData = resp?.facturama?.Id
        ? resp.facturama
        : resp?.data?.facturama?.Id
        ? resp.data.facturama
        : resp?.data?.Id
        ? resp.data
        : resp?.Id
        ? resp
        : null;

      if (!facturamaData) {
        return res.status(500).json({
          ok: false,
          message: "El modelo no devolvió los datos de Facturama esperados",
          detail: resp,
        });
      }
      row = mapFacturamaToFacturaRow(facturamaData);
      source = "facturama";
    } else {
      // Usa los datos del body
      const mTotal = total ?? 0;
      const mSub = subtotal ?? 0;
      const mImp =
        impuestos != null ? impuestos : Number(mTotal) - Number(mSub);
      row = {
        fecha_emision,
        estado,
        usuario_creador: usuario_creador ?? null,
        id_agente,
        total: mTotal,
        subtotal: mSub,
        impuestos: mImp,
        saldo: saldo ?? facturamaArgs.saldo,
        rfc: rfc || facturamaArgs.rfc,
        id_empresa: id_empresa ?? facturamaArgs.id_empresa,
        uuid_factura: uuid_factura,
        rfc_emisor: rfc_emisor || facturamaArgs.rfc_emisor,
        url_pdf: url_pdf || facturamaArgs.url_pdf,
        url_xml: url_xml || facturamaArgs.url_xml,
      };
    }

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
        row.url_xml,
      ]);
      if (!r1?.affectedRows) throw new Error("No se pudo crear la factura");

      // IMPORTANTE: aquí usamos el valor ORIGINAL de raw_id (uuid o entero)
      const [r2] = await connection.query(insertLinkSQL, [
        raw_id,
        id_factura,
        row.total,
      ]);
      if (!r2?.affectedRows)
        throw new Error("No se pudo vincular el pago/saldo a la factura");

      return res.status(201).json({
        message: "Factura creada correctamente",
        data: {
          id_factura,
          raw_id,
          source,
          facturama:
            source === "facturama"
              ? {
                  Id: facturamaData?.Id,
                  Uuid: row.uuid_factura,
                  links: { pdf: row.url_pdf, xml: row.url_xml },
                }
              : undefined,
        },
      });
    });
  } catch (error) {
    const status = error?.response?.status || error?.statusCode || 500;
    const payload = error?.response?.data ||
      error?.details || { message: error?.message || "Error" };
    return res.status(status).json({
      ok: false,
      message:
        payload.Message || payload.message || "Error al crear la factura",
      detail: payload,
    });
  }
};

// Crea 1 factura y la vincula con N pagos/saldos.
// Si no viene "factura" en el body, timbra con Facturama (model.crearFacturaEmi).
const crearFacturaMultiplesPagos = async (req, res) => {
  const { factura: facturaBody, pagos_asociados } = req.body || {};
  const { info_user, datos_empresa } = req.body;

  if (!Array.isArray(pagos_asociados) || pagos_asociados.length === 0) {
    return res.status(400).json({
      ok: false,
      message: "Se requiere pagos_asociados (array con al menos un elemento).",
    });
  }

  // Normaliza cada pago: { raw_id, monto }
  let pagos;
  try {
    pagos = pagos_asociados.map((p, idx) => {
      const rid = p?.raw_id;
      const mnt = p?.monto ?? p?.monto_facturado ?? p?.amount;
      if (rid === undefined || rid === null || String(rid).trim() === "") {
        throw new Error(`pagos_asociados[${idx}]: raw_id es requerido`);
      }
      if (
        mnt === undefined ||
        mnt === null ||
        isNaN(Number(mnt)) ||
        Number(mnt) < 0
      ) {
        throw new Error(`pagos_asociados[${idx}]: monto inválido`);
      }
      return { raw_id: rid, monto: Number(mnt) };
    });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }

  const id_factura = "fac-" + uuidv4();
  const getFk = (rid) =>
    String(rid).trim().toLowerCase().startsWith("pag-")
      ? "id_pago"
      : "id_saldo_a_favor";

  // ¿La factura ya viene completa en el body?
  const fb = facturaBody || {};
  const bodyTieneFactura =
    Boolean(fb.fecha_emision) &&
    (Boolean(fb.uuid_factura) || Boolean(fb.url_xml)) &&
    fb.total != null &&
    fb.subtotal != null;

  const mapFacturamaToFacturaRow = (fd) => {
    const f = fd || {};
    const links = f.Links || f.links || {};
    const comp = f.Complemento || f.complemento || {};
    const timbre = comp.TimbreFiscalDigital || comp.timbreFiscalDigital || {};
    const emisor = f.Emisor || f.emisor || {};
    const totales = f.Totales || f.totales || {};
    const total = f.Total ?? totales.Total ?? 0;
    const subtotal = f.SubTotal ?? f.Subtotal ?? totales.SubTotal ?? 0;
    const impuestos = Number(total) - Number(subtotal);
    console.log("datos factura 🐨🐨🐨🐨🐨🐨🐨🐨🐨🐨🐨🐨🐨",f)
    return {
      fecha_emision: f.Fecha || f.fecha || new Date(),
      estado: "Confirmada",
      usuario_creador:info_user.id_agente,
      id_agente: fb.id_agente ?? info_user.id_agente,
      total,
      subtotal,
      impuestos,
      saldo: fb.saldo ?? 0,
      rfc: fb.rfc,
      id_empresa: fb.id_empresa ?? null,
      uuid_factura:
        timbre.UUID ||
        timbre.Uuid ||
        f.Uuid ||
        f.UUID ||
        fb.uuid_factura ||
        null,
      rfc_emisor: emisor.Rfc || emisor.RFC || fb.rfc_emisor || null,
      url_pdf:
        links.Pdf || links.pdf || f.PdfUrl || f.pdfUrl || fb.url_pdf || null,
      url_xml:
        links.Xml || links.xml || f.XmlUrl || f.xmlUrl || fb.url_xml || null,
    };
  };

  let rowFactura;
  let facturamaData = null;
  let source = "body";

  try {
    if (!bodyTieneFactura) {
      const resp = await model.crearFacturaEmi(req, req.body);
      facturamaData = resp?.facturama?.Id
        ? resp.facturama
        : resp?.data?.facturama?.Id
        ? resp.data.facturama
        : resp?.data?.Id
        ? resp.data
        : resp?.Id
        ? resp
        : null;

      if (!facturamaData) {
        return res.status(500).json({
          ok: false,
          message: "El modelo no devolvió los datos de Facturama esperados",
          detail: resp,
        });
      }
      rowFactura = mapFacturamaToFacturaRow(facturamaData);
      // console.log("RECEIVER", resp.data.facturama.Receiver);
      // console.log("ISSUER", resp.data.facturama.Issuer);
      rowFactura.rfc_emisor = resp.data.facturama.Issuer.Rfc;
      rowFactura.rfc = resp.data.facturama.Receiver.Rfc;
      rowFactura.id_facturama = resp.data.facturama.Id;
      rowFactura.id_empresa = datos_empresa.id_empresa;
      rowFactura.uuid_factura = resp.data.facturama.Complement.TaxStamp.Uuid;
      source = "facturama";
    } else {
      const total = fb.total ?? 0;
      const subtotal = fb.subtotal ?? 0;
      const impuestos =
        fb.impuestos != null ? fb.impuestos : Number(total) - Number(subtotal);
      rowFactura = {
        fecha_emision: fb.fecha_emision,
        estado: fb.estado,
        usuario_creador: fb.usuario_creador ?? null,
        id_agente: fb.id_agente,
        total,
        subtotal,
        impuestos,
        saldo: fb.saldo ?? 0,
        rfc: fb.rfc,
        id_empresa: fb.id_empresa ?? null,
        uuid_factura: fb.uuid_factura ?? null,
        rfc_emisor: fb.rfc_emisor ?? null,
        url_pdf: fb.url_pdf ?? null,
        url_xml: fb.url_xml ?? null,
      };
    }

    // --------- Validación dura: suma de pagos == total de la factura (en centavos) ----------
    const totalFacturaCents = Math.round(Number(rowFactura.total) * 100);
    const sumPagosCents = pagos.reduce(
      (acc, p) => acc + Math.round(Number(p.monto) * 100),
      0
    );
    if (sumPagosCents !== totalFacturaCents) {
      return res.status(400).json({
        ok: false,
        message: "La suma de los pagos no coincide con el total de la factura.",
        total_factura: Number(rowFactura.total),
        total_vinculado: sumPagosCents / 100,
        diferencia: (totalFacturaCents - sumPagosCents) / 100,
      });
    }
    // ---------------------------------------------------------------------------------------

    const insertFacturaSQL = `
      INSERT INTO facturas (
        id_factura, fecha_emision, estado, usuario_creador, id_agente,
        total, subtotal, impuestos, saldo, rfc, id_empresa,
        uuid_factura, rfc_emisor, url_pdf, url_xml, id_facturama
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
    `;

    await runTransaction(async (connection) => {
      try {
        const [r1] = await connection.query(insertFacturaSQL, [
          id_factura,
          rowFactura.fecha_emision,
          rowFactura.estado,
          rowFactura.usuario_creador,
          rowFactura.id_agente,
          rowFactura.total,
          rowFactura.subtotal,
          rowFactura.impuestos,
          rowFactura.saldo,
          rowFactura.rfc,
          rowFactura.id_empresa,
          rowFactura.uuid_factura,
          rowFactura.rfc_emisor,
          rowFactura.url_pdf,
          rowFactura.url_xml,
          rowFactura.id_facturama || null,
        ]);
        if (!r1?.affectedRows) throw new Error("No se pudo crear la factura");

        // Vincula cada pago/saldo
        for (const { raw_id, monto } of pagos) {
          const fk = getFk(raw_id);
          const insertLinkSQL = `
          INSERT INTO facturas_pagos_y_saldos (${fk}, id_factura, monto)
          VALUES (?, ?, ?)
        `;
          const valorId = fk === "id_pago" ? String(raw_id) : Number(raw_id);
          const [r2] = await connection.query(insertLinkSQL, [
            valorId,
            id_factura,
            monto,
          ]);
          if (!r2?.affectedRows)
            throw new Error("No se pudo vincular un pago/saldo a la factura");
        }

        return res.status(201).json({
          ok: true,
          message: "Factura creada y vinculada con pagos/saldos",
          data: {
            id_factura,
            source,
            total_factura: Number(rowFactura.total),
            total_vinculado: sumPagosCents / 100,
            diferencia: 0,
            facturama:
              source === "facturama"
                ? {
                    Id: facturamaData?.Id,
                    Uuid: rowFactura.uuid_factura,
                    links: { pdf: rowFactura.url_pdf, xml: rowFactura.url_xml },
                  }
                : undefined,
          },
        });
      } catch (error) {
        console.log(error);
        throw error;
      }
    });
  } catch (err) {
    const status = err?.response?.status || err?.statusCode || 500;
    const payload = err?.response?.data ||
      err?.details || { message: err?.message || "Error" };
    return res.status(status).json({
      ok: false,
      message:
        payload.Message ||
        payload.message ||
        "Error al crear la factura con pagos",
      detail: payload,
    });
  }
};

const getDetallesConexionesFactura = async (req, res) => {
  const { id_factura, id_agente } = req.query;
  try {
    const [pagos = [], reservas = []] = await executeSP2(
      "sp_get_detalles_conexion_fcaturas",
      [id_agente, id_factura],
      { allSets: true }
    );
    res.status(200).json({
      message: "Consulta exitosa",
      pagos: pagos,
      reservas: reservas,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error en el servidor", details: error });
  }
};

module.exports = {
  create,
  get_agente_facturas,
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
  crearFacturaMultiplesPagos,
  getDetallesConexionesFactura,
};

//ya quedo "#$%&/()="
