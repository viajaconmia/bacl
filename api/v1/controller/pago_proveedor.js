const {
  executeSP,
  executeQuery,
  executeTransaction,
} = require("../../../config/db");
const { STORED_PROCEDURE } = require("../../../lib/constant/stored_procedures");

// Convierte valores "vacíos" a null (undefined, null, "", strings de puros espacios)
const toNullableString = (value) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
};

// Convierte número (venza de CSV o frontend) a número o null
// Opcional: elimina comas de miles: "1,234.56"
const toNullableNumber = (value) => {
  if (value === undefined || value === null) return null;

  const str = String(value).replace(/,/g, "").trim();
  if (str === "") return null;

  const num = Number(str);
  return isNaN(num) ? null : num;
};

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
          estado_pago, // Usamos el valor mapeado
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
          estado_pago, // Usamos el valor mapeado
        ];
        console.log("parametrossss", parametros);
        response = await executeSP(
          STORED_PROCEDURE.POST.SOLICITUD_PAGO_PROVEEDOR,
          parametros
        );
      }
    }

    res.status(200).json({
      message: "Solicitud procesada con éxito",
      ok: true,
      data: solicitud,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    if (error.message == "El hospedaje que tratas de agregar ya existe") {
      return res.status(200).json({
        message: "La reserva ya fue guardada, se estan creando mas",
        details: { message: "se estan generando mas, pero puedes continuar" },
      });
    }
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const createDispersion = async (req, res) => {
  try {
    console.log("📥 Datos recibidos en createDispersion:", req.body);

    const { id_dispersion, solicitudes } = req.body;

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

    // 1) Sacamos ids de solicitud proveedor
    const ids = solicitudes
      .map((s) => s.id_solicitud_proveedor)
      .filter(Boolean)
      .map(String);

    if (ids.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Las solicitudes no traen id_solicitud_proveedor",
      });
    }

    // 2) Consultamos saldo real en solicitudes_pago_proveedor
    const inPlaceholders = ids.map(() => "?").join(", ");
    const saldoSql = `
      SELECT id_solicitud_proveedor, saldo
      FROM solicitudes_pago_proveedor
      WHERE id_solicitud_proveedor IN (${inPlaceholders});
    `;

    const saldoRows = await executeQuery(saldoSql, ids);

    // Mapa: id_solicitud_proveedor -> saldo
    const saldoMap = new Map(
      (saldoRows || []).map((r) => [
        String(r.id_solicitud_proveedor),
        Number(r.saldo ?? 0),
      ])
    );

    // 3) Validamos que existan todos los saldos
    const faltantes = ids.filter((id) => !saldoMap.has(String(id)));
    if (faltantes.length > 0) {
      return res.status(400).json({
        ok: false,
        message:
          "No se encontró saldo para una o más solicitudes en solicitudes_pago_proveedor",
        faltantes,
      });
    }

    // 4) Armamos values usando saldo del DB como monto_solicitado y saldo
    const values = solicitudes.map((s) => {
      const idSol = String(s.id_solicitud_proveedor);
      const saldoDb = Number(saldoMap.get(idSol) ?? 0);

      return [
        idSol, // id_solicitud_proveedor
        saldoDb, // monto_solicitado  <-- sale de solicitudes_pago_proveedor.saldo
        saldoDb, // saldo             <-- igual
        0, // monto_pagado
        id_dispersion, // codigo_dispersion
        null, // fecha_pago
      ];
    });

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");

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

    const flattenedValues = values.flat();
    const dbResult = await executeQuery(sql, flattenedValues);

    // 5) Obtener ids insertados (como ya lo haces)
    const lastInsertIdQuery = `
      SELECT id_dispersion_pagos_proveedor
      FROM dispersion_pagos_proveedor
      WHERE codigo_dispersion = ? ;
    `;
    const lastInsertIdResult = await executeQuery(lastInsertIdQuery, [
      id_dispersion,
    ]);

    const id_pagos = lastInsertIdResult.map((row) =>
      String(row.id_dispersion_pagos_proveedor)
    );

    return res.status(200).json({
      ok: true,
      message: "Dispersión creada y registros guardados correctamente",
      data: {
        id_dispersion,
        id_pagos,
        total_registros: solicitudes.length,
        dbResult,
      },
    });
  } catch (error) {
    console.error("❌ Error en createDispersion:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
};

const createPago = async (req, res) => {
  try {
    const {
      frontendData = {},
      csvData = [],
      montos = {},
      codigo_dispersion,
      isMasivo,
      user,
    } = req.body || {};

    // ===========================
    // Helpers robustos (no rompen 0)
    // ===========================
    const toNull = (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === "string") {
        const s = v.trim();
        if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined")
          return null;
        return s;
      }
      return v;
    };

    const toIntOrNull = (v) => {
      if (v === undefined || v === null) return null;
      const n = parseInt(String(v).trim(), 10);
      return Number.isFinite(n) ? n : null;
    };

    const toDecOrNull = (v) => {
      if (v === undefined || v === null) return null;
      const n = Number(String(v).replace(/,/g, "").trim());
      return Number.isFinite(n) ? n : null;
    };

    const parseFechaSafe = (ddmmyyyy) => {
      if (!ddmmyyyy) return new Date();
      const s = String(ddmmyyyy).trim();
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!m) return new Date(s);
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yyyy = Number(m[3]);
      return new Date(yyyy, mm - 1, dd);
    };

    // ============================================================
    // Helper: aplica el cargo a dispersion_pagos_proveedor + solicitud
    // ============================================================
    const aplicarPagoADispersionYSolicitud = async ({
      id_dispersion_pagos_proveedor,
      codigo_dispersion,
      cargo,
      fecha_pago,
    }) => {
      // 1) SELECT para obtener saldo/monto_solicitado/id_solicitud_proveedor
      const sel = `
        SELECT
          id_solicitud_proveedor,
          monto_solicitado,
          monto_pagado,
          saldo
        FROM dispersion_pagos_proveedor
        WHERE id_dispersion_pagos_proveedor = ?
          AND codigo_dispersion = ?
        LIMIT 1
      `;
      const rows = await executeQuery(sel, [
        id_dispersion_pagos_proveedor,
        codigo_dispersion,
      ]);

      if (!rows || rows.length === 0) {
        throw new Error(
          `No existe en dispersion_pagos_proveedor: id=${id_dispersion_pagos_proveedor}, codigo=${codigo_dispersion}`
        );
      }

      const d = rows[0];
      const idSolicitud = d.id_solicitud_proveedor;
      const montoSolicitado = Number(d.monto_solicitado || 0);
      const montoPagadoActual = Number(d.monto_pagado || 0);

      const cargoNum = Number(cargo || 0);
      const nuevoMontoPagado = montoPagadoActual + cargoNum;
      const nuevoSaldo = Math.max(montoSolicitado - nuevoMontoPagado, 0);

      // 2) UPDATE dispersion: monto_pagado += cargo y saldo = monto_solicitado - monto_pagado
      const updDisp = `
        UPDATE dispersion_pagos_proveedor
        SET
          monto_pagado = ?,
          saldo = ?,
          fecha_pago = COALESCE(?, fecha_pago),
          fecha_update = CURRENT_TIMESTAMP
        WHERE id_dispersion_pagos_proveedor = ?
          AND codigo_dispersion = ?
      `;
      await executeQuery(updDisp, [
        nuevoMontoPagado,
        nuevoSaldo,
        fecha_pago || null,
        id_dispersion_pagos_proveedor,
        codigo_dispersion,
      ]);

      // 3) UPDATE solicitud (pendiente): saldo -= cargo
      //    (si tu saldo fuera "pagado acumulado", sería saldo += cargo)
      if (idSolicitud) {
        const updSol = `
          UPDATE solicitudes_pago_proveedor
          SET saldo = GREATEST(COALESCE(saldo,0) - ?, 0)
          WHERE id_solicitud_proveedor = ?
        `;
        await executeQuery(updSol, [cargoNum, idSolicitud]);
      }

      return {
        id_solicitud_proveedor: idSolicitud,
        monto_solicitado: montoSolicitado,
        monto_pagado_nuevo: nuevoMontoPagado,
        saldo_nuevo: nuevoSaldo,
      };
    };

    // ===========================
    // MODO INDIVIDUAL (lo dejo igual a tu versión)
    // ===========================
    if (!isMasivo) {
      console.log("📥 Datos recibidos para pago individual:", req.body);

      const montoPrimero = Object.values(montos || {})[0];

      const pagoData = {
        id_solicitud_proveedor: frontendData.id_solicitud_proveedor,
        user_created: frontendData.user_created || "system",
        user_update: frontendData.user_update || "system",
        concepto: toNull(frontendData.concepto),
        descripcion: toNull(frontendData.descripcion),
        iva: toDecOrNull(frontendData.iva),
        total: toDecOrNull(frontendData.total),

        codigo_dispersion: codigo_dispersion || generarCodigoDispersion(),
        monto: toDecOrNull(montoPrimero),
        monto_pagado: toDecOrNull(montoPrimero),

        fecha_emision: frontendData.fecha_emision
          ? new Date(frontendData.fecha_emision)
          : new Date(),
        fecha_pago: new Date(),
        url_pdf: toNull(frontendData.url_pdf),
        numero_comprobante: `COMP-${Date.now()}`,

        cuenta_origen: toNull(frontendData.cuenta_origen),
        cuenta_destino: toNull(frontendData.cuenta_destino),
        moneda: toNull(frontendData.moneda) || "MXN",
        metodo_de_pago: toNull(frontendData.metodo_de_pago) || "Transferencia",
        referencia_pago: toNull(frontendData.referencia_pago),
        nombre_pagador: toNull(frontendData.nombre_pagador),
        rfc_pagador: toNull(frontendData.rfc_pagador),
        domicilio_pagador: toNull(frontendData.domicilio_pagador),
        nombre_beneficiario: toNull(frontendData.nombre_beneficiario),
        domicilio_beneficiario: toNull(frontendData.domicilio_beneficiario),
      };

      if (!pagoData.id_solicitud_proveedor) {
        return res.status(400).json({
          error: "Bad Request",
          details: "El campo id_solicitud_proveedor es requerido",
        });
      }

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
        pagoData.total,
      ];

      const result = await executeQuery(query, values);
      const idPagoInsertado = result.insertId;

      return res.status(201).json({
        success: true,
        message: "Pago creado exitosamente",
        data: {
          id_pago_proveedores: idPagoInsertado,
          codigo_dispersion: pagoData.codigo_dispersion,
          numero_comprobante: pagoData.numero_comprobante,
          monto: pagoData.monto,
          fecha_pago: pagoData.fecha_pago,
        },
      });
    }

    // ===========================
    // MODO MASIVO
    // ===========================
    if (isMasivo) {
      if (!Array.isArray(csvData) || csvData.length === 0) {
        return res.status(400).json({
          error: "Bad Request",
          details: "csvData debe ser un arreglo con al menos una fila",
        });
      }

      const resultados = [];
      const errores = [];

      console.log("🐨 csvData recibido en modo masivo:", csvData);

      for (let i = 0; i < csvData.length; i++) {
        try {
          const csvRow = csvData[i] || {};
          const baseUser = user || "system";

          const userCreated =
            frontendData.user_created &&
            String(frontendData.user_created).trim() !== ""
              ? `${frontendData.user_created},${baseUser}`.replace(/,+$/, "")
              : baseUser;

          const userUpdate =
            frontendData.user_update &&
            String(frontendData.user_update).trim() !== ""
              ? `${frontendData.user_update},${baseUser}`.replace(/,+$/, "")
              : baseUser;

          // Lo que llega en tu CSV
          const pagoData = {
            id_pago_dispersion: toIntOrNull(csvRow.id_dispersion), // "105" -> 105
            codigo_dispersion: toNull(csvRow.codigo_dispersion), // "D1EHVX2W"
            referencia_pago:
              toNull(csvRow["Referencia Ampliada"]) ||
              toNull(csvRow["Referencia"]),

            // montos vienen en Cargo
            monto: toDecOrNull(csvRow["Cargo"]),
            monto_pagado: toDecOrNull(csvRow["Cargo"]),
            total: toDecOrNull(csvRow["Cargo"]),
            iva: toDecOrNull(csvRow["IVA"]),

            concepto:
              toNull(csvRow["Concepto"]) || toNull(frontendData.concepto),
            descripcion:
              toNull(csvRow["Descripcion"]) || toNull(frontendData.descripcion),

            fecha_pago: csvRow["Fecha Operación"]
              ? parseFechaSafe(csvRow["Fecha Operación"])
              : new Date(),

            fecha_emision: new Date(),
            url_pdf: null,
            numero_comprobante:
              toNull(csvRow["Numero de comprobante"]) ||
              `COMP-CSV-${Date.now()}-${i}`,

            cuenta_origen: toNull(csvRow["Cuenta de origen"]),
            cuenta_destino: toNull(csvRow["Cuenta de destino"]),

            moneda: toNull(csvRow["Moneda"]) || "MXN",
            metodo_de_pago: toNull(csvRow["Metodo de pago"]) || "SPEI",

            nombre_pagador: toNull(csvRow["Nombre del pagador"]),
            rfc_pagador: toNull(csvRow["RFC del pagador"]),
            domicilio_pagador: toNull(csvRow["Domicilio del pagador"]),
            nombre_beneficiario: toNull(csvRow["Nombre del beneficiario"]),
            domicilio_beneficiario: toNull(
              csvRow["Domicilio del beneficiario"]
            ),

            user_created: userCreated,
            user_update: userUpdate,
          };

          if (!pagoData.id_pago_dispersion) {
            throw new Error(
              `id_dispersion inválido: "${csvRow.id_dispersion}"`
            );
          }
          if (!pagoData.codigo_dispersion) {
            throw new Error(`codigo_dispersion no encontrado en fila ${i + 1}`);
          }
          if (!pagoData.monto_pagado || pagoData.monto_pagado <= 0) {
            throw new Error(
              `Cargo inválido en fila ${i + 1}: "${csvRow["Cargo"]}"`
            );
          }

          // 1) Insert pago_proveedores
          const insPago = `
            INSERT INTO pago_proveedores (
              id_pago_dispersion,
              codigo_dispersion,
              monto_pagado,
              fecha_pago,
              url_pdf,
              user_update,
              user_created,
              fecha_emision,
              numero_comprobante,
              cuenta_origen,
              cuenta_destino,
              monto,
              moneda,
              concepto,
              metodo_de_pago,
              referencia_pago,
              nombre_pagador,
              rfc_pagador,
              domicilio_pagador,
              nombre_beneficiario,
              domicilio_beneficiario,
              descripcion,
              iva,
              total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          const valuesPago = [
            pagoData.id_pago_dispersion,
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
            pagoData.total,
          ];

          const resultPago = await executeQuery(insPago, valuesPago);
          const idPagoInsertado = resultPago.insertId;

          // 2) Ahora el UPDATE a dispersion + solicitud (con SELECT previo)
          const impacto = await aplicarPagoADispersionYSolicitud({
            id_dispersion_pagos_proveedor: pagoData.id_pago_dispersion,
            codigo_dispersion: pagoData.codigo_dispersion,
            cargo: pagoData.monto_pagado,
            fecha_pago: pagoData.fecha_pago,
          });

          resultados.push({
            fila: i + 1,
            success: true,
            id_pago_proveedores: idPagoInsertado,
            id_dispersion_pagos_proveedor: pagoData.id_pago_dispersion,
            codigo_dispersion: pagoData.codigo_dispersion,
            cargo: pagoData.monto_pagado,
            referencia_pago: pagoData.referencia_pago,
            impacto,
          });
        } catch (error) {
          console.error(`❌ Error en fila ${i + 1}:`, error);
          errores.push({
            fila: i + 1,
            error: error.message,
            code: error.code,
          });
        }
      }

      return res.status(201).json({
        success: true,
        message: `Procesamiento completado: ${resultados.length} pagos creados, ${errores.length} errores`,
        summary: {
          total_filas: csvData.length,
          exitosas: resultados.length,
          errores: errores.length,
        },
        resultados,
        errores: errores.length > 0 ? errores : undefined,
      });
    }

    return res.status(400).json({
      error: "Bad Request",
      details: "Datos inválidos. Verifique isMasivo y el payload.",
    });
  } catch (error) {
    console.error("❌ Error al momento de crear pago: ", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "Conflict",
        details: "Ya existe un registro con estos datos",
        field: error.message.match(/for key '(.+)'/)?.[1],
      });
    }

    if (error.code === "ER_DATA_TOO_LONG") {
      return res.status(400).json({
        error: "Bad Request",
        details: "Algunos datos exceden la longitud permitida",
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
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
  return `DISP-${timestamp}-${random.toString().padStart(3, "0")}`;
}

const getSolicitudes = async (req, res) => {
  try {
    const spRows = await executeSP(
      STORED_PROCEDURE.GET.SOLICITUD_PAGO_PROVEEDOR
    );

    const ids = spRows
      .map((r) => r.id_solicitud_proveedor)
      .filter((id) => id !== null && id !== undefined);

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
      (acc[key] ||= []).push(row.dispersiones_json, row.pagos_json);
      return acc;
    }, {});

    console.log(pagosBySolicitud, "◾◾◾◾◾◾◾◾◾◾◾");

    const facturasBySolicitud = facturasRaw.reduce((acc, row) => {
      const key = String(row.id_solicitud_proveedor);
      (acc[key] ||= []).push(row);
      return acc;
    }, {});

    const data = spRows.map(
      ({
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
        const facturas =
          facturasBySolicitud[String(id_solicitud_proveedor)] ?? [];

        const estaPagada =
          estatus_pagos === "pagado" ||
          pagos.some((p) => p.pago_estado_pago === "pagado" || p.saldo == 0);

        let filtro_pago = "todos";

        if (saldo == 0.0) {
          filtro_pago = "pagada";
          console.log("pagada 😘😘😘😘😘😘😘😘😘😘", saldo);
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
      }
    );

    const todos = data;
    const spei_solicitado = data.filter(
      (d) => d.filtro_pago === "spei_solicitado"
    );
    const pago_tdc = data.filter((d) => d.filtro_pago === "pago_tdc");
    const cupon_enviado = data.filter((d) => d.filtro_pago === "cupon_enviado");
    const pagada = data.filter((d) => d.filtro_pago === "pagada");
    res.set({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      Expires: "0",
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
const getDatosFiscalesProveedor = async(req,res)=>{
  
}

module.exports = {
  createSolicitud,
  getSolicitudes,
  createDispersion,
  createPago,
  getDatosFiscalesProveedor
};
