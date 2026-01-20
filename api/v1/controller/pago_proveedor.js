const {
  executeSP,
  executeQuery,
  executeTransaction,
} = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
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
    // ✅ NUEVO: Validación de saldo ANTES de insertar el pago
    // ============================================================
    const validarSaldoAntesDeInsert = async ({
      id_dispersion_pagos_proveedor, // <- id_dispersion
      codigo_dispersion,
      id_solicitud_proveedor, // fallback si no hay dispersion
    }) => {
      let idSolicitud = id_solicitud_proveedor || null;

      // 1) Validar en dispersion_pagos_proveedor SOLO si hay id_dispersion
      if (id_dispersion_pagos_proveedor) {
        const qDisp = `
          SELECT id_solicitud_proveedor, saldo
          FROM dispersion_pagos_proveedor
          WHERE id_dispersion_pagos_proveedor = ?
            AND codigo_dispersion = ?
          LIMIT 1
        `;
        const rowsDisp = await executeQuery(qDisp, [
          id_dispersion_pagos_proveedor,
          codigo_dispersion,
        ]);

        if (!rowsDisp || rowsDisp.length === 0) {
          throw new Error(
            `No existe registro en dispersion_pagos_proveedor (id=${id_dispersion_pagos_proveedor}, codigo=${codigo_dispersion})`
          );
        }

        const saldoDisp = Number(rowsDisp[0].saldo || 0);
        idSolicitud = rowsDisp[0].id_solicitud_proveedor;

        if (saldoDisp <= 0) {
          throw new Error(
            `Saldo en dispersion_pagos_proveedor es 0. No se permite registrar el pago. (id_dispersion=${id_dispersion_pagos_proveedor})`
          );
        }
      }

      // 2) Si dispersion NO tiene saldo 0 (o no aplica), validar en solicitudes_pago_proveedor
      if (!idSolicitud) {
        throw new Error(
          `No se pudo determinar id_solicitud_proveedor para validar saldo en solicitudes_pago_proveedor`
        );
      }

      const qSol = `
        SELECT saldo
        FROM solicitudes_pago_proveedor
        WHERE id_solicitud_proveedor = ?
        LIMIT 1
      `;
      const rowsSol = await executeQuery(qSol, [idSolicitud]);

      if (!rowsSol || rowsSol.length === 0) {
        throw new Error(
          `No existe registro en solicitudes_pago_proveedor (id=${idSolicitud})`
        );
      }

      const saldoSol = Number(rowsSol[0].saldo || 0);
      if (saldoSol <= 0) {
        throw new Error(
          `Saldo en solicitudes_pago_proveedor es 0. No se permite registrar el pago. (id_solicitud=${idSolicitud})`
        );
      }

      return { id_solicitud_proveedor: idSolicitud };
    };

    // ============================================================
    // ✅ NUEVO: Insert a pagos_facturas_proveedores (después del pago)
    // ============================================================
    const insertarPagoFacturaProveedor = async ({
      id_pago_proveedor,
      id_solicitud,
      monto_pago,
    }) => {
      const ins = `
        INSERT INTO pagos_facturas_proveedores (
          id_pago_proveedor,
          id_solicitud,
          monto_pago,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      await executeQuery(ins, [
        id_pago_proveedor,
        id_solicitud,
        String(monto_pago),
      ]);
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
    // MODO INDIVIDUAL
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
        url_pdf: frontendData.url_pdf,
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

      // ✅ VALIDACIÓN ANTES DEL INSERT (en individual valida solicitud)
      await validarSaldoAntesDeInsert({
        id_dispersion_pagos_proveedor: null, // individual normalmente no trae id_dispersion
        codigo_dispersion: pagoData.codigo_dispersion,
        id_solicitud_proveedor: pagoData.id_solicitud_proveedor,
      });

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

      // ✅ INSERT EXTRA: pagos_facturas_proveedores
      await insertarPagoFacturaProveedor({
        id_pago_proveedor: idPagoInsertado,
        id_solicitud: pagoData.id_solicitud_proveedor,
        monto_pago: pagoData.monto_pagado,
      });

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

          const pagoData = {
            id_pago_dispersion: toIntOrNull(csvRow.id_dispersion),
            codigo_dispersion: toNull(csvRow.codigo_dispersion),
            referencia_pago:
              toNull(csvRow["Referencia Ampliada"]) ||
              toNull(csvRow["Referencia"]),

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
            url_pdf: frontendData.url_pdf,
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
            throw new Error(`id_dispersion inválido: "${csvRow.id_dispersion}"`);
          }
          if (!pagoData.codigo_dispersion) {
            throw new Error(`codigo_dispersion no encontrado en fila ${i + 1}`);
          }
          if (!pagoData.monto_pagado || pagoData.monto_pagado <= 0) {
            throw new Error(
              `Cargo inválido en fila ${i + 1}: "${csvRow["Cargo"]}"`
            );
          }

          // ✅ VALIDACIÓN ANTES DEL INSERT
          const precheck = await validarSaldoAntesDeInsert({
            id_dispersion_pagos_proveedor: pagoData.id_pago_dispersion,
            codigo_dispersion: pagoData.codigo_dispersion,
            id_solicitud_proveedor: null,
          });

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

          // 2) UPDATE a dispersion + solicitud
          const impacto = await aplicarPagoADispersionYSolicitud({
            id_dispersion_pagos_proveedor: pagoData.id_pago_dispersion,
            codigo_dispersion: pagoData.codigo_dispersion,
            cargo: pagoData.monto_pagado,
            fecha_pago: pagoData.fecha_pago,
          });

          // ✅ 3) INSERT EXTRA: pagos_facturas_proveedores
          // id_solicitud sale de dispersion_pagos_proveedor
          await insertarPagoFacturaProveedor({
            id_pago_proveedor: idPagoInsertado,
            id_solicitud: impacto.id_solicitud_proveedor || precheck.id_solicitud_proveedor,
            monto_pago: pagoData.monto_pagado,
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

    // Si quieres distinguir “sin saldo”, normalmente es 409/422
    if (
      typeof error.message === "string" &&
      (error.message.includes("Saldo en dispersion_pagos_proveedor es 0") ||
        error.message.includes("Saldo en solicitudes_pago_proveedor es 0"))
    ) {
      return res.status(409).json({
        error: "Conflict",
        details: error.message,
      });
    }

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

const getDatosFiscalesProveedor = async (req, res) => {
  console.log("Entrando al controller proveedores datos fiscales");
  try {
    const { id_proveedor } = req.query;

    if (!id_proveedor) {
      return res.status(400).json({ error: "Falta id_proveedor en query" });
    }

    const data = await executeQuery(
      `
      SELECT df.*
      FROM proveedores_datos_fiscales_relacion r
      INNER JOIN proveedores_datos_fiscales df
        ON df.id = r.id_datos_fiscales
      WHERE r.id_proveedor = ?;
      `,
      [id_proveedor]
    );

    return res.status(200).json({ data });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      error: "Error en el servidor",
      details: error?.message ?? error,
    });
  }
};

const editProveedores = async(req,res) =>{

}

const getProveedores = async(req,res) =>{

}

const cargarFactura = async (req, res) => {
  req.context.logStep(
    "crearFacturaDesdeCarga",
    "Iniciando creación de factura desde carga (proveedores)"
  );

  const {
    fecha_emision,
    estado,
    usuario_creador,
    id_agente,
    total,
    subtotal,
    impuestos,
    rfc,
    id_empresa,
    uuid_factura,
    rfc_emisor,
    url_pdf,
    url_xml,
    fecha_vencimiento,
    proveedoresData,
  } = req.body;

  const id_factura = "fac-" + uuidv4();

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const toDateOnly = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };

  try {
    const proveedoresArr = Array.isArray(proveedoresData)
      ? proveedoresData
      : proveedoresData
      ? [proveedoresData]
      : [];

    if (proveedoresArr.length === 0) {
      return res.status(400).json({
        error: "Falta proveedoresData",
        message: "No se puede crear la factura sin proveedoresData.",
      });
    }

    const proveedorFirst = proveedoresArr[0];

    const proveedor_razon_social =
      proveedorFirst?.proveedor?.razon_social ??
      proveedorFirst?.razon_social ??
      null;

    const fechaFacturaSQL = toDateOnly(fecha_emision);

    const es_credito = Number(
      proveedorFirst?.is_credito ?? (fecha_vencimiento ? 1 : 0)
    );

    // ✅ Normalizar JSON para SP (ARRAY siempre)
    const detalle = proveedoresArr.map((p, idx) => {
      const id_solicitud_proveedor =
        p?.solicitud_proveedor?.id_solicitud_proveedor ??
        p?.id_solicitud_proveedor ??
        p?.id_solicitud ?? // payload múltiple
        null;

      if (!id_solicitud_proveedor) {
        throw new Error(
          `proveedoresData[${idx}] no trae id_solicitud / id_solicitud_proveedor`
        );
      }

      const monto_solicitado = toNumber(
        p?.solicitud_proveedor?.monto_solicitado ?? p?.monto_solicitado ?? 0
      );

      const monto_facturado = toNumber(
        p?.monto_asociar ?? p?.monto_facturado ?? 0
      );

      if (monto_facturado <= 0) {
        throw new Error(
          `proveedoresData[${idx}] monto_asociar inválido (debe ser > 0)`
        );
      }

      if (monto_solicitado > 0 && monto_facturado > monto_solicitado) {
        throw new Error(
          `proveedoresData[${idx}] monto_asociar (${monto_facturado}) excede monto_solicitado (${monto_solicitado})`
        );
      }

      const pendiente_facturar =
        monto_solicitado > 0 ? monto_solicitado - monto_facturado : null;

      const id_pago =
        p?.detalles_pagos?.[0]?.id_pago ??
        p?.id_pago ??
        p?.id_pago_proveedores ??
        null;

      return {
        id_pago,
        solicitud_proveedor: {
          id_solicitud_proveedor,
          monto_solicitado,
        },
        monto_facturado,      // ✅ lo que el SP lee
        pendiente_facturar,   // opcional
      };
    });

    // ✅ SUMA TOTAL = p_monto_facturado
    const monto_facturado_total = detalle.reduce(
      (acc, x) => acc + toNumber(x.monto_facturado),
      0
    );

    const proveedoresDataSP = JSON.stringify(detalle);

    const totalN = toNumber(total);
    const subtotalN = toNumber(subtotal);
    const impuestosN = toNumber(impuestos);

    const saldo_x_aplicar_items = totalN-monto_facturado_total;
    const estado_factura = estado;

    const response = await executeSP("sp_inserta_factura_desde_carga_proveedores", [
      id_factura,

      uuid_factura,
      rfc_emisor,
      proveedor_razon_social,
      monto_facturado_total, // ✅ AHORA SÍ
      url_xml,
      url_pdf,
      fechaFacturaSQL,
      es_credito,
      estado_factura,

      fechaFacturaSQL,
      estado,
      usuario_creador,
      id_agente,
      totalN,
      subtotalN,
      impuestosN,
      saldo_x_aplicar_items, // ✅ AHORA SÍ
      rfc,
      id_empresa,
      fecha_vencimiento,

      proveedoresDataSP,     // ✅ ARRAY
    ]);

    const idsSolicitudes = [
  ...new Set(
    detalle
      .map((x) => x?.solicitud_proveedor?.id_solicitud_proveedor)
      .filter(Boolean)
  ),
];
if (idsSolicitudes.length > 0) {
  const placeholders = idsSolicitudes.map(() => "?").join(",");

  const updateEstatus = `
    UPDATE solicitudes_pago_proveedor spp
    LEFT JOIN (
      SELECT
        pfp.id_solicitud,
        SUM(
          CAST(COALESCE(NULLIF(pfp.monto_facturado, ''), '0') AS DECIMAL(12,2))
        ) AS total_facturado
      FROM pagos_facturas_proveedores pfp
      WHERE pfp.id_solicitud IN (${placeholders})
      GROUP BY pfp.id_solicitud
    ) agg
      ON agg.id_solicitud = spp.id_solicitud_proveedor
    SET
      -- Guardamos total facturado (opcional, pero recomendado)
      spp.monto_facturado = IFNULL(agg.total_facturado, 0),

      -- Recalculamos monto_por_facturar
      spp.monto_por_facturar = GREATEST(
        CAST(spp.monto_solicitado AS DECIMAL(12,2)) - IFNULL(agg.total_facturado, 0),
        0
      ),

      -- Estado facturacion según tus reglas
      spp.estado_facturacion = CASE
        WHEN GREATEST(
          CAST(spp.monto_solicitado AS DECIMAL(12,2)) - IFNULL(agg.total_facturado, 0),
          0
        ) = 0 THEN 'facturado'
        WHEN GREATEST(
          CAST(spp.monto_solicitado AS DECIMAL(12,2)) - IFNULL(agg.total_facturado, 0),
          0
        ) <> CAST(spp.monto_solicitado AS DECIMAL(12,2)) THEN 'parcial'
        ELSE 'pendiente'
      END,

      -- Estatus pagos: si saldo=0 => pagado
      spp.estatus_pagos = CASE
        WHEN CAST(COALESCE(NULLIF(spp.saldo, ''), '0') AS DECIMAL(12,2)) = 0 THEN 'pagado'
        ELSE spp.estatus_pagos
      END
    WHERE spp.id_solicitud_proveedor IN (${placeholders});
  `;

  // Se usan placeholders 2 veces: IN(subquery) + IN(where)
  await executeQuery(updateEstatus, [...idsSolicitudes, ...idsSolicitudes]);
}


    return res.status(201).json({
      message: "Factura proveedor creada correctamente desde carga",
      data: {
        id_factura_proveedor: id_factura,
        uuid_cfdi: uuid_factura,
        monto_facturado_total,
        detalle_asociacion: detalle,
        response,
      },
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: "Error al crear factura proveedor desde carga",
      details: error?.message || error,
    });
  }
};


const EditCampos = async (req, res) => {
  try {
    const { id_solicitud_proveedor, ...rest } = req.body;

    // 1) Validar ID
    if (!id_solicitud_proveedor) {
      return res.status(400).json({
        error: "Falta id_solicitud_proveedor en el body",
      });
    }

    // 2) Obtener el campo dinámico a editar (debe venir solo 1)
    const keys = Object.keys(rest).filter((k) => rest[k] !== undefined);

    if (keys.length === 0) {
      return res.status(400).json({
        error: "No viene ningún campo para actualizar (además del id_solicitud_proveedor)",
      });
    }

    if (keys.length > 1) {
      return res.status(400).json({
        error: "Solo se permite actualizar 1 campo a la vez",
        campos_recibidos: keys,
      });
    }

    const fieldFromClient = keys[0];
    const value = rest[fieldFromClient];

    // 3) Mapeo opcional (para soportar comentario_cxp -> comentario_CXP)
    const FIELD_MAP = {
      comentarios_cxp: "comentario_CXP",
      comentarios_CXP: "comentario_CXP",
      comentarios_ops:"comentarios"
    };

    const dbField = FIELD_MAP[fieldFromClient] || fieldFromClient;

    // 4) Lista blanca de campos permitidos (SEGURIDAD)
    const ALLOWED_FIELDS = new Set([
      "fecha_solicitud",
      "monto_solicitado",
      "saldo",
      "forma_pago_solicitada",
      "id_tarjeta_solicitada",
      "usuario_solicitante",
      "usuario_generador",
      "comentarios",
      "estado_solicitud",
      "estado_facturacion",
      "estatus_pagos",
      "id_proveedor",
      "monto_facturado",
      "monto_por_facturar",
      "comentario_CXP",
    ]);

    if (!ALLOWED_FIELDS.has(dbField)) {
      return res.status(400).json({
        error: `Campo no permitido para actualizar: ${fieldFromClient}`,
        permitido: Array.from(ALLOWED_FIELDS),
      });
    }

    // 5) Opcional: casteo numérico si lo necesitas
    const NUMERIC_FIELDS = new Set([
      "monto_solicitado",
      "saldo",
      "id_tarjeta_solicitada",
      "id_proveedor",
      "monto_facturado",
      "monto_por_facturar",
    ]);

    const finalValue = NUMERIC_FIELDS.has(dbField)
      ? (value === null || value === "" ? null : Number(value))
      : value;

    if (NUMERIC_FIELDS.has(dbField) && finalValue !== null && Number.isNaN(finalValue)) {
      return res.status(400).json({
        error: `El campo ${fieldFromClient} debe ser numérico`,
      });
    }

    // 6) Ejecutar UPDATE (ojo: el nombre de columna NO va como "?" por seguridad)
    const updateSql = `
      UPDATE solicitudes_pago_proveedor
      SET \`${dbField}\` = ?
      WHERE id_solicitud_proveedor = ?
      LIMIT 1;
    `;

    const result = await executeQuery(updateSql, [
      finalValue,
      id_solicitud_proveedor,
    ]);

    // dependiendo tu helper, puede venir como result.affectedRows o result[0].affectedRows
    const affectedRows = result?.affectedRows ?? result?.[0]?.affectedRows ?? 0;

    if (affectedRows === 0) {
      return res.status(404).json({
        error: "No se encontró la solicitud o no se actualizó nada",
        id_solicitud_proveedor,
      });
    }

    // 7) (Opcional pero recomendado) regresar el registro actualizado
    const selectSql = `
      SELECT *
      FROM solicitudes_pago_proveedor
      WHERE id_solicitud_proveedor = ?
      LIMIT 1;
    `;
    const rows = await executeQuery(selectSql, [id_solicitud_proveedor]);
    const updated = Array.isArray(rows) ? rows[0] : rows?.[0];

    return res.status(200).json({
      ok: true,
      message: "Campo actualizado correctamente",
      updated_field: fieldFromClient,
      db_field: dbField,
      id_solicitud_proveedor,
      data: updated || null,
    });
  } catch (error) {
    console.error("Error en EditCampos:", error);
    return res.status(500).json({
      error: "Error en el servidor",
      details: error?.message ?? error,
    });
  }
};


module.exports = {
  createSolicitud,
  getSolicitudes,
  createDispersion,
  createPago,
  getDatosFiscalesProveedor,
  editProveedores,
  getProveedores,
  cargarFactura,
  EditCampos
};
