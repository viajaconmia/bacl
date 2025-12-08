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

const createDispersion = async (req, res) => {
  try {
    console.log("📥 Datos recibidos en createDispersion:", req.body);

    const {
      id_dispersion,
      referencia_numerica, // no se usa en esta tabla
      motivo_pago,         // no se usa en esta tabla
      layoutUrl,           // no se usa aquí (va null)
      solicitudes,
    } = req.body;

    // Validaciones básicas
    if (!id_dispersion) {
      return res
        .status(400)
        .json({ ok: false, message: "id_dispersion es requerido" });
    }

    if (!Array.isArray(solicitudes) || solicitudes.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Debe haber al menos una solicitud en la dispersión",
      });
    }

    // Creamos el arreglo de valores
    const values = solicitudes.map((s) => [
      s.id_solicitud_proveedor ?? null,   // id_solicitud_proveedor
      s.costo_proveedor ?? 0,             // monto_solicitado
      s.costo_proveedor ?? 0,             // saldo
      0,                                  // monto_pagado
      id_dispersion,                      // codigo_dispersion
      null,                               // fecha_pago -> null
    ]);

    // Preparamos la consulta dinámica para los placeholders (usamos `?` para cada valor)
    const placeholders = values
      .map(() => "(?, ?, ?, ?, ?, ?)")
      .join(", ");

    // Generamos la consulta SQL para insertar los registros
    const sql = `
      INSERT INTO dispersion_pagos_proveedor (
        id_solicitud_proveedor,
        monto_solicitado,
        saldo,
        monto_pagado,
        codigo_dispersion,
        fecha_pago
      ) VALUES ${placeholders};
    `;

    // Aplanamos el array de valores para pasar en executeQuery
    const flattenedValues = values.flat();

    // Ejecutamos la query para insertar los registros
    const dbResult = await executeQuery(sql, flattenedValues);

    // Obtener el último ID insertado (para las inserciones múltiples)
    // Consulta para obtener todos los id_pago generados
    const lastInsertIdQuery = `
      SELECT id_dispersion_pagos_proveedor
      FROM dispersion_pagos_proveedor 
      WHERE codigo_dispersion = ? ;
    `;

    // Ejecutamos la consulta para obtener los ids generados
    const lastInsertIdResult = await executeQuery(lastInsertIdQuery, [id_dispersion]);
    console.log("busqueda", lastInsertIdResult)
    
    // Extraemos los id_pago de los resultados
    const id_pagos = lastInsertIdResult.map(row => 
      String(row.id_dispersion_pagos_proveedor).padStart(10, '0')
    );
    
    console.log("CAMBIOS",id_pagos)


    res.status(200).json({
      ok: true,
      message: "Dispersión creada y registros guardados correctamente",
      data: {
        id_dispersion,
        id_pagos, // Incluir el id_pago generado
        total_registros: solicitudes.length,
        dbResult,
      },
    });
  } catch (error) {
    console.error("❌ Error en createDispersion:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
};

const createPago = async (req, res) => {
  try {
    // Obtener los datos del payload (según lo que envía el frontend)
    const { frontendData, csvData, montos, codigo_dispersion, isMasivo, user } = req.body;
    
    // Si es modo individual (una sola inserción)
    if (!isMasivo) {
      console.log("📥 Datos recibidos para pago individual:", req.body);
      
      // Usar datos del frontend y los montos
      const pagoData = {
        // Datos del frontend
        id_solicitud_proveedor: frontendData.id_solicitud_proveedor,
        user_created: frontendData.user_created || 'system',
        user_update: frontendData.user_update || 'system',
        concepto: frontendData.concepto,
        descripcion: frontendData.descripcion,
        iva: parseFloat(frontendData.iva) || 0,
        total: parseFloat(frontendData.total) || 0,
        
        // Datos específicos para modo individual
        codigo_dispersion: codigo_dispersion || generarCodigoDispersion(),
        monto: parseFloat(Object.values(montos)[0] || 0), // Tomar el primer monto
        monto_pagado: parseFloat(Object.values(montos)[0] || 0),
        
        // Campos con valores por defecto
        fecha_emision: frontendData.fecha_emision ? new Date(frontendData.fecha_emision) : new Date(),
        fecha_pago: new Date(),
        url_pdf: frontendData.url_pdf || null,
        numero_comprobante: `COMP-${Date.now()}`,
        cuenta_origen: '', // Se pueden dejar vacíos o pedir en frontend
        cuenta_destino: '',
        moneda: 'MXN',
        metodo_de_pago: 'Transferencia',
        referencia_pago: '',
        nombre_pagador: '',
        rfc_pagador: '',
        domicilio_pagador: '',
        nombre_beneficiario: '',
        domicilio_beneficiario: ''
      };

      // Validar campos requeridos para modo individual
      if (!pagoData.id_solicitud_proveedor) {
        return res.status(400).json({
          error: "Bad Request",
          details: "El campo id_solicitud_proveedor es requerido"
        });
      }

      // Preparamos la consulta SQL para insertar los valores
      const query = `
        INSERT INTO pago_proveedores (
          id_solicitud_proveedor, codigo_dispersion, monto_pagado, fecha_pago,
          url_pdf, user_update, user_created, fecha_emision, numero_comprobante,
          cuenta_origen, cuenta_destino, monto, moneda, concepto, metodo_de_pago,
          referencia_pago, nombre_pagador, rfc_pagador, domicilio_pagador,
          nombre_beneficiario, domicilio_beneficiario, descripcion, iva, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        pagoData.id_solicitud_proveedor,
        pagoData.codigo_dispersion,
        pagoData.monto_pagado,
        pagoData.fecha_pago,
        pagoData.url_pdf,
        pagoData.user_update,
        pagoData.user_created,
        pagoData.fecha_emision,
        pagoData.numero_comprobante,
        pagoData.cuenta_origen,
        pagoData.cuenta_destino,
        pagoData.monto,
        pagoData.moneda,
        pagoData.concepto,
        pagoData.metodo_de_pago,
        pagoData.referencia_pago,
        pagoData.nombre_pagador,
        pagoData.rfc_pagador,
        pagoData.domicilio_pagador,
        pagoData.nombre_beneficiario,
        pagoData.domicilio_beneficiario,
        pagoData.descripcion,
        pagoData.iva,
        pagoData.total
      ];

      // Ejecutar la query para insertar el pago
      const [result] = await db.executeQuery(query, values);
      
      const idPagoInsertado = result.insertId;
      const idPagoDispersion = `PD-${String(idPagoInsertado).padStart(6, '0')}`;
      
      // Actualizar la tabla con el id_pago_dispersion
      const updateQuery = `UPDATE pago_proveedores SET id_pago_dispersion = ? WHERE id_pago_proveedores = ?`;
      await db.executeQuery(updateQuery, [idPagoDispersion, idPagoInsertado]);

      // Responder con éxito
      return res.status(201).json({
        success: true,
        message: "Pago creado exitosamente",
        data: {
          id_pago_proveedores: idPagoInsertado,
          id_pago_dispersion: idPagoDispersion,
          codigo_dispersion: pagoData.codigo_dispersion,
          numero_comprobante: pagoData.numero_comprobante,
          monto: pagoData.monto,
          fecha_pago: pagoData.fecha_pago
        }
      });
    }

    // MODO MASIVO: Procesar múltiples inserciones del CSV
    if (isMasivo) {
      const resultados = [];
      const errores = [];
      console.log(csvData, "🐨🐨🐨🐨🐨🐨🐨🐨");

      // Procesar cada fila del CSV
      for (let i = 0; i < csvData.length; i++) {
        try {
          const csvRow = csvData[i];
          
          // Mapear nombres de columnas del CSV a los nombres de la base de datos
          const pagoData = {
            // Datos del frontend (comunes a todos)
            id_pago_dispercion: csvRow["id_pago_dispersion"],
            user_created: frontendData.user_created + `,` + user || 'system',
            user_update: frontendData.user_update + `,` + user || 'system',
            concepto: csvRow["Concepto"] || frontendData.concepto,
            descripcion: csvRow["Descripcion"] || frontendData.descripcion,
            
            // Datos del CSV - mapeo de columnas
            codigo_dispersion: csvRow["codigo_dispersion"] || csvRow["Codigo de dispersion"] || generarCodigoDispersion(),
            monto_pagado: parseFloat(csvRow["Monto"] || csvRow["Total"] || "0"),
            fecha_pago: csvRow["Fecha de pago"] ? parseFecha(csvRow["Fecha de pago"]) : new Date(),
            numero_comprobante: csvRow["Numero de comprobante"] || `COMP-CSV-${Date.now()}-${i}`,
            cuenta_origen: csvRow["Cuenta de origen"] || "",
            cuenta_destino: csvRow["Cuenta de destino"] || "",
            monto: parseFloat(csvRow["Monto"] || csvRow["Total"] || "0"),
            moneda: csvRow["Moneda"] || 'MXN',
            metodo_de_pago: csvRow["Metodo de pago"] || 'Transferencia',
            referencia_pago: csvRow["Referencia de pago"] || "",
            nombre_pagador: csvRow["Nombre del pagador"] || "",
            rfc_pagador: csvRow["RFC del pagador"] || "",
            domicilio_pagador: csvRow["Domicilio del pagador"] || "",
            nombre_beneficiario: csvRow["Nombre del beneficiario"] || "",
            domicilio_beneficiario: csvRow["Domicilio del beneficiario"] || "",
            iva: parseFloat(csvRow["IVA"] || "0"),
            total: parseFloat(csvRow["Total"] || csvRow["Monto"] || "0"),
            
            // Campos con valores por defecto
            fecha_emision: csvRow["Fecha de emisión"] ? parseFecha(csvRow["Fecha de emisión"]) : new Date(),
            url_pdf: null
          };

          // Validar campos requeridos para modo masivo
          if (!pagoData.cuenta_destino || !pagoData.cuenta_origen) {
            errores.push({
              fila: i + 1,
              error: "Las cuentas de origen y destino son requeridas",
              datos: { cuenta_origen: pagoData.cuenta_origen, cuenta_destino: pagoData.cuenta_destino }
            });
            continue;
          }

          // Preparamos la consulta SQL para insertar los valores del CSV
          const query = `
            INSERT INTO pago_proveedores (id_pago_dispersion, codigo_dispersion, monto_pagado, fecha_pago,
              url_pdf, user_update, user_created, fecha_emision, numero_comprobante,
              cuenta_origen, cuenta_destino, monto, moneda, concepto, metodo_de_pago,
              referencia_pago, nombre_pagador, rfc_pagador, domicilio_pagador,
              nombre_beneficiario, domicilio_beneficiario, descripcion, iva, total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          const values = [
            pagoData.id_pago_dispercion,
            pagoData.codigo_dispersion,
            pagoData.monto_pagado,
            pagoData.fecha_pago,
            pagoData.url_pdf,
            pagoData.user_update,
            pagoData.user_created,
            pagoData.fecha_emision,
            pagoData.numero_comprobante,
            pagoData.cuenta_origen,
            pagoData.cuenta_destino,
            pagoData.monto,
            pagoData.moneda,
            pagoData.concepto,
            pagoData.metodo_de_pago,
            pagoData.referencia_pago,
            pagoData.nombre_pagador,
            pagoData.rfc_pagador,
            pagoData.domicilio_pagador,
            pagoData.nombre_beneficiario,
            pagoData.domicilio_beneficiario,
            pagoData.descripcion,
            pagoData.iva,
            pagoData.total
          ];

          // Ejecutar la query para insertar el pago
          const [result] = await executeQuery(query, values);
          console.log("result", result);

          const idPagoInsertado = result.insertId;
          const idPagoDispersion = `PD-${String(idPagoInsertado).padStart(6, '0')}`;
          
          const updateQuery = `UPDATE pago_proveedores SET id_pago_dispersion = ? WHERE id_pago_proveedores = ?`;
          await executeQuery(updateQuery, [idPagoDispersion, idPagoInsertado]);

          resultados.push({
            fila: i + 1,
            success: true,
            id_pago_proveedores: idPagoInsertado,
            id_pago_dispersion: idPagoDispersion,
            codigo_dispersion: pagoData.codigo_dispersion,
            numero_comprobante: pagoData.numero_comprobante,
            monto: pagoData.monto
          });

        } catch (error) {
          errores.push({
            fila: i + 1,
            error: error.message,
            code: error.code
          });
        }
      }

      // Responder con resultados
      return res.status(201).json({
        success: true,
        message: `Procesamiento completado: ${resultados.length} pagos creados, ${errores.length} errores`,
        summary: {
          total_filas: csvData.length,
          exitosas: resultados.length,
          errores: errores.length
        },
        resultados: resultados,
        errores: errores.length > 0 ? errores : undefined
      });
    }

    // Si no es ni individual ni masivo válido
    return res.status(400).json({
      error: "Bad Request",
      details: "Datos inválidos. Verifique el modo de operación y los datos enviados."
    });

  } catch (error) {
    console.error("❌ Error en al momento de crear pago: ", error);
    
    // Manejar errores específicos de duplicados
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: "Conflict",
        details: "Ya existe un registro con estos datos",
        field: error.message.match(/for key '(.+)'/)?.[1]
      });
    }
    
    // Manejar errores de validación de datos
    if (error.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({
        error: "Bad Request",
        details: "Algunos datos exceden la longitud permitida"
      });
    }
    
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Función auxiliar para parsear fechas desde diferentes formatos
function parseFecha(fechaString) {
  if (!fechaString) return new Date();
  
  // Intentar diferentes formatos de fecha
  const fecha = new Date(fechaString);
  
  // Si la fecha es inválida, retornar fecha actual
  if (isNaN(fecha.getTime())) {
    return new Date();
  }
  
  return fecha;
}

// Función para generar código de dispersión
function generarCodigoDispersion() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `DISP-${timestamp}-${random.toString().padStart(3, '0')}`;
}

const getSolicitudes = async (req, res) => {
  try {
    const spRows = await executeSP(STORED_PROCEDURE.GET.SOLICITUD_PAGO_PROVEEDOR);

    const ids = spRows
      .map(r => r.id_solicitud_proveedor)
      .filter(id => id !== null && id !== undefined);

    let pagosRaw = [];
    let facturasRaw = [];

    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");

      // pagosRaw = await executeQuery(
      //   `SELECT 
      //      ps.*, 
      //      pp.id_pago_proveedor       AS pago_id_pago_proveedor,
      //      pp.monto_pagado            AS pago_monto_pagado,
      //      pp.forma_pago_ejecutada    AS pago_forma_pago_ejecutada,
      //      pp.id_tarjeta_pagada       AS pago_id_tarjeta_pagada,
      //      pp.id_cuenta_bancaria      AS pago_id_cuenta_bancaria,
      //      pp.url_comprobante_pago    AS pago_url_comprobante_pago,
      //      pp.fecha_pago              AS pago_fecha_pago,
      //      pp.fecha_transaccion_tesoreria AS pago_fecha_transaccion_tesoreria,
      //      pp.usuario_tesoreria_pago  AS pago_usuario_tesoreria_pago,
      //      pp.comentarios_tesoreria   AS pago_comentarios_tesoreria,
      //      pp.numero_autorizacion     AS pago_numero_autorizacion,
      //      pp.creado_en               AS pago_creado_en,
      //      pp.actualizado_en          AS pago_actualizado_en,
      //      pp.estado_pago             AS pago_estado_pago
      //    FROM pagos_solicitudes ps
      //    LEFT JOIN pagos_proveedor pp 
      //      ON pp.id_pago_proveedor = ps.id_pago_proveedor
      //    WHERE ps.id_solicitud_proveedor IN (${placeholders});`,
      //   ids
      // );

      pagosRaw = await executeSP(STORED_PROCEDURE.GET.OBTENR_PAGOS_PROVEEDOR);


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
      (acc[key] ||= []).push(row.dispersiones_json,row.pagos_json);
      return acc;
    }, {});

    console.log(pagosBySolicitud,"◾◾◾◾◾◾◾◾◾◾◾")

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
      estatus_pagos,
      ...rest
    }) => {
      const pagos = pagosBySolicitud[String(id_solicitud_proveedor)] ?? [];
      const facturas = facturasBySolicitud[String(id_solicitud_proveedor)] ?? [];

      const estaPagada =
        estatus_pagos === "pagado" ||
        pagos.some(p => p.pago_estado_pago === "pagado" || p.saldo == 0);

      let filtro_pago = "todos";

      if (saldo == 0.00) {
        filtro_pago = "pagada";
        console.log("pagada 😘😘😘😘😘😘😘😘😘😘", saldo)
      } else if (forma_pago_solicitada === "transfer") {
        filtro_pago = "spei_solicitado";
      } else if (forma_pago_solicitada === "card") {
        filtro_pago = "pago_tdc";
      } else if (forma_pago_solicitada === "link") {
        filtro_pago = "cupon_enviado";
      }

      return {
        ...rest,
        estatus_pagos,
        filtro_pago,
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
        pagos,
        facturas,
      };
    });

    const todos = data;
    const spei_solicitado = data.filter(
      d => d.filtro_pago === "spei_solicitado"
    );
    const pago_tdc = data.filter(
      d => d.filtro_pago === "pago_tdc"
    );
    const cupon_enviado = data.filter(
      d => d.filtro_pago === "cupon_enviado"
    );
    const pagada = data.filter(
      d => d.filtro_pago === "pagada"
    );
    res.set({
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      "Expires": "0"
    });

    res.status(200).json({
      message: "Registros obtenidos con exito",
      ok: true,
      data: {
        todos,
        spei_solicitado,
        pago_tdc,
        cupon_enviado,
        pagada,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

module.exports = {
  createSolicitud,
  getSolicitudes,
  createDispersion,
  createPago
};
