const {
  executeSP,
  executeQuery,
  executeTransaction,
} = require("../../../config/db");
const { STORED_PROCEDURE } = require("../../../lib/constant/stored_procedures");

const createSolicitud = async (req, res) => {
  try {
    const { solicitud } = req.body;
    const {
      monto_a_pagar,
      paymentMethod,
      paymentStatus, // Recibido del frontend
      comments,
      date,
      paymentType,
      selectedCard,
      id_hospedaje,
    } = solicitud;

    console.log("📥 Datos recibidos:", solicitud);

    let response;
    if (paymentType !== "credit") {
      const estado_pago = paymentStatus; 
      
      if (paymentMethod === "transfer") {
        const parametros = [
          monto_a_pagar,
          "transfer",
          null,
          "Operaciones",
          "Operaciones",
          comments,
          id_hospedaje,
          date,
          estado_pago // Usamos el valor mapeado
        ];
        
        response = await executeSP(
          STORED_PROCEDURE.POST.SOLICITUD_PAGO_PROVEEDOR,
          parametros
        );
      } else if (paymentMethod === "card" || paymentMethod === "link") {
        const parametros = [
          monto_a_pagar,
          paymentMethod,
          selectedCard,
          "Operaciones",
          "Operaciones",
          comments,
          id_hospedaje,
          date,
          estado_pago // Usamos el valor mapeado
        ];
        console.log("parametrossss",parametros)
        response = await executeSP(
          STORED_PROCEDURE.POST.SOLICITUD_PAGO_PROVEEDOR,
          parametros
        );
      }
    }
    
    res.status(200).json({
      message: "Solicitud procesada con éxito",
      ok: true,
      data: solicitud
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};

const getSolicitudes = async (req, res) => {
  try {
    const spRows = await executeSP(STORED_PROCEDURE.GET.SOLICITUD_PAGO_PROVEEDOR);

    const ids = spRows
      .map(r => r.id_solicitud_proveedor)
      .filter(id => id !== null && id !== undefined);

    // Evita IN() vacío
    let pagosRaw = [];
    let facturasRaw = [];

    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");

      pagosRaw = await executeQuery(
        `SELECT 
           ps.*, 
           pp.id_pago_proveedor       AS pago_id_pago_proveedor,
           pp.monto_pagado            AS pago_monto_pagado,
           pp.forma_pago_ejecutada    AS pago_forma_pago_ejecutada,
           pp.id_tarjeta_pagada       AS pago_id_tarjeta_pagada,
           pp.id_cuenta_bancaria      AS pago_id_cuenta_bancaria,
           pp.url_comprobante_pago    AS pago_url_comprobante_pago,
           pp.fecha_pago              AS pago_fecha_pago,
           pp.fecha_transaccion_tesoreria AS pago_fecha_transaccion_tesoreria,
           pp.usuario_tesoreria_pago  AS pago_usuario_tesoreria_pago,
           pp.comentarios_tesoreria   AS pago_comentarios_tesoreria,
           pp.numero_autorizacion     AS pago_numero_autorizacion,
           pp.creado_en               AS pago_creado_en,
           pp.actualizado_en          AS pago_actualizado_en,
           pp.estado_pago             AS pago_estado_pago
         FROM pagos_solicitudes ps
         LEFT JOIN pagos_proveedor pp 
           ON pp.id_pago_proveedor = ps.id_pago_proveedor
         WHERE ps.id_solicitud_proveedor IN (${placeholders});`,
        ids
      );

      facturasRaw = await executeQuery(
        `SELECT 
           fs.*,
           fpp.id_factura_proveedor    AS fac_id_factura_proveedor,
           fpp.uuid_cfdi               AS fac_uuid_cfdi,
           fpp.rfc_emisor              AS fac_rfc_emisor,
           fpp.razon_social_emisor     AS fac_razon_social_emisor,
           fpp.monto_facturado         AS fac_monto_facturado,
           fpp.url_xml                 AS fac_url_xml,
           fpp.url_pdf                 AS fac_url_pdf,
           fpp.fecha_factura           AS fac_fecha_factura,
           fpp.es_credito              AS fac_es_credito,
           fpp.estado_factura          AS fac_estado_factura
         FROM facturas_solicitudes fs
         LEFT JOIN facturas_pago_proveedor fpp 
           ON fpp.id_factura_proveedor = fs.id_factura_proveedor
         WHERE fs.id_solicitud_proveedor IN (${placeholders});`,
        ids
      );
    }

    const pagosBySolicitud = pagosRaw.reduce((acc, row) => {
      const key = String(row.id_solicitud_proveedor);
      (acc[key] ||= []).push(row);
      return acc;
    }, {});

    const facturasBySolicitud = facturasRaw.reduce((acc, row) => {
      const key = String(row.id_solicitud_proveedor);
      (acc[key] ||= []).push(row);
      return acc;
    }, {});

    const data = spRows.map(({
      id_solicitud_proveedor,
      fecha_solicitud,
      monto_solicitado,
      saldo,
      forma_pago_solicitada,
      id_tarjeta_solicitada,
      usuario_solicitante,
      usuario_generador,
      comentarios,
      estado_solicitud,
      estado_facturacion,
      ultimos_4,
      banco_emisor,
      tipo_tarjeta,
      rfc,
      razon_social,
      ...rest
    }) => ({
      ...rest,
      solicitud_proveedor: {
        id_solicitud_proveedor,
        fecha_solicitud,
        monto_solicitado,
        saldo,
        forma_pago_solicitada,
        id_tarjeta_solicitada,
        usuario_solicitante,
        usuario_generador,
        comentarios,
        estado_solicitud,
        estado_facturacion,
      },
      tarjeta: { ultimos_4, banco_emisor, tipo_tarjeta },
      proveedor: { rfc, razon_social },
      // Siempre arreglos, nunca undefined:
      pagos: pagosBySolicitud[String(id_solicitud_proveedor)] ?? [],
      // 🚫 eliminado el bug:
      // estado_pago: pagos.estado_pago,
      facturas: facturasBySolicitud[String(id_solicitud_proveedor)] ?? [],
    }));

    // Evita confusiones de cache lado cliente
    res.set({
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      "Expires": "0"
    });

    res.status(200).json({
      message: "Registros obtenidos con exito",
      ok: true,
      data,
    });

    // Este log no ayuda (imprime el objeto de respuesta de Express)
    // console.log("inforvrrrr...", res);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};


module.exports = {
  createSolicitud,
  getSolicitudes,
};