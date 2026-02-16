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
      paymentMethod,   // transfer | card | link (a veces)
      paymentStatus,
      comments,
      comments_cxp,
      date,
      paymentType,     // credit (si aplica)
      selectedCard,
      id_hospedaje,
      usuario_creador,
      paymentSchedule = [],
      moneda,
    } = solicitud;

    // ✅ Determina forma_pago_solicitada para el SP
    const formaPagoDB =
      String(paymentType || "").toLowerCase() === "credit"
        ? "credit"
        : String(paymentMethod || "").toLowerCase();

    const allowed = new Set(["credit", "transfer", "card", "link"]);
    if (!allowed.has(formaPagoDB)) {
      return res.status(400).json({
        ok: false,
        message: `paymentMethod/paymentType inválido. Recibido: ${formaPagoDB}`,
      });
    }

    // ✅ User IDs (evita "Operaciones" si tus columnas son UUID/FK)
    const userId = usuario_creador; // o req.user.id si tienes auth
    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: "Falta usuario_creador (UUID) para registrar la solicitud.",
      });
    }

    // ✅ Mapeos como ya los tienes
    const mapEstadoSolicitud = (status) => {
      const s = String(status || "").trim().toLowerCase();
      if (s === "spei_solicitado") return "transferencia solicitada";
      if (s === "enviada_para_cobro") return "enviada a cobro";
      if (s === "pago_tdc") return "solicitud pago tdc";
      if (s === "cupon_enviado") return "cupon enviado";
      if (s === "pagada") return "pagada";
      return "pendiente";
    };

    const mapEstatusPagos = (estadoSolicitud) => {
      const s = String(estadoSolicitud || "").trim().toLowerCase();
      if (s === "pagada") return "pagado";
      return "enviado_a_pago";
    };

    // ✅ Estado inicial EXACTO como tu enum real:
    const estado_solicitud_db =
      formaPagoDB === "credit"
        ? "CUPON ENVIADO"
        : formaPagoDB === "transfer"
          ? "TRANSFERENCIA_SOLICITADA"
          : (formaPagoDB === "card" || formaPagoDB === "link")
            ? "CARTA_ENVIADA"
            : "CARTA_ENVIADA";

    // ✅ estatus_pagos en tu tabla es varchar(45), puedes dejarlo así:
    const estatus_pagos_db = "enviado_a_pago";


    // ✅ schedule: solo card/link (como ya lo haces)
    const schedule =
      Array.isArray(paymentSchedule) && paymentSchedule.length > 0
        ? paymentSchedule
        : [{ fecha_pago: date, monto: monto_a_pagar }];

    if (formaPagoDB === "card" || formaPagoDB === "link") {
      if (!selectedCard) {
        return res.status(400).json({
          ok: false,
          message: "Falta selectedCard para card/link.",
        });
      }
      const sum = schedule.reduce((acc, it) => acc + Number(it.monto || 0), 0);
      if (Math.abs(sum - Number(monto_a_pagar)) > 0.01) {
        return res.status(400).json({
          ok: false,
          message: `La suma del schedule (${sum.toFixed(2)}) debe igualar monto_a_pagar (${Number(monto_a_pagar).toFixed(2)})`,
        });
      }
    }

    if (!id_hospedaje) {
      return res.status(400).json({ ok: false, message: "Falta id_hospedaje." });
    }
    if (!date) {
      return res.status(400).json({ ok: false, message: "Falta date." });
    }

    const fechaSolicitud =
      formaPagoDB === "card" || formaPagoDB === "link"
        ? (schedule?.[0]?.fecha_pago || date)
        : date;

    // ✅ tarjeta SOLO card/link; transfer/credit => NULL
    const cardId = (formaPagoDB === "card" || formaPagoDB === "link")
      ? String(selectedCard)
      : null;

    const parametrosSP = [
      Number(monto_a_pagar),     // p_monto_solicitado
      formaPagoDB,               // p_forma_pago_solicitada (credit/transfer/card/link)
      cardId,                    // p_id_tarjeta_solicitada (NULL para transfer/credit)
      userId,                    // p_usuario_solicitante (UUID)
      userId,                    // p_usuario_generador (UUID)
      comments || "",            // p_comentarios
      comments_cxp || "",        // p_comentario_cxp
      userId,                    // p_id_creador (UUID)  <-- evita NULL
      id_hospedaje,              // p_id_hospedaje
      fechaSolicitud,            // p_fecha
      estado_solicitud_db,       // p_estado_solicitud
      estatus_pagos_db,          // p_estatus_pagos
    ];

    const spResp = await executeSP(
      STORED_PROCEDURE.POST.SOLICITUD_PAGO_PROVEEDOR,
      parametrosSP
    );

    const idSolicitudProveedor =
      spResp?.[0]?.[0]?.id_solicitud_proveedor ??
      spResp?.[0]?.id_solicitud_proveedor ??
      spResp?.id_solicitud_proveedor ??
      null;

    if (!idSolicitudProveedor) {
      return res.status(500).json({
        ok: false,
        error: "No se pudo obtener id_solicitud_proveedor del SP",
        details: spResp,
      });
    }

    // ✅ OJO: tu lógica de inserts a pago_proveedores la dejas SOLO card/link como ya está
    // Para credit/transfer normalmente no insertas N pagos aquí (depende tu negocio).

    return res.status(200).json({
      ok: true,
      message: "Solicitud creada con éxito",
      id_solicitud_proveedor: Number(idSolicitudProveedor),
    });

  } catch (error) {
    // ✅ logging útil de MySQL
    console.error("❌ Error createSolicitud:", {
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      sqlMessage: error?.sqlMessage,
    });

    return res.status(500).json({
      ok: false,
      error: "Internal Server Error",
      details: error?.sqlMessage || error?.message,
    });
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
    // ---------------- helpers ----------------
    const norm = (v) => String(v ?? "").trim().toLowerCase();
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const safeJsonParse = (v) => {
      if (v == null) return null;
      if (Array.isArray(v) || typeof v === "object") return v;
      if (typeof v !== "string") return null;
      const s = v.trim();
      if (!s) return null;
      if (!(s.startsWith("{") || s.startsWith("["))) return null;
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    };

    const toArray = (v) => {
      const parsed = safeJsonParse(v);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
      return [];
    };

    const flattenPagosArr = (v) => {
      // soporta: array, string JSON, mezcla
      const arr = Array.isArray(v) ? v : toArray(v);
      const lvl1 = arr.flatMap((x) => (Array.isArray(x) ? x : [x]));
      const lvl2 = lvl1.flatMap((x) => (Array.isArray(x) ? x : [x]));
      return lvl2.filter(Boolean);
    };

    const getPagoStats = (pagos) => {
      const p = flattenPagosArr(pagos);
      let solicitado = 0;
      let pagado = 0;
      let conFecha = 0;

      for (const x of p) {
        solicitado += num(x?.monto_solicitado ?? 0);
        pagado += num(x?.monto_pagado ?? 0);
        if (x?.fecha_pago) conFecha += 1;
      }

      const anyPagadoEstado =
        p.some((x) => norm(x?.pago_estado_pago) === "pagado" || norm(x?.estado_pago) === "pagado") || false;

      return {
        count: p.length,
        solicitado,
        pagado,
        conFecha,
        anyPagadoEstado,
      };
    };

    // Facturación en tu SP: no diste esquema fijo.
    // Intentamos detectar en `rest` varios nombres típicos.
    const getFacturaNums = (row) => {
      const solicitado = num(row?.monto_solicitado);
      const fact = num(
        row?.monto_facturado ??
          row?.total_facturado ??
          row?.total_facturado_en_pfp ??
          row?.facturado ??
          row?.monto_facturas ??
          0
      );

      // si existe un "por_facturar" explícito, úsalo; si no, calcula.
      const porFacturarRaw = row?.monto_por_facturar ?? row?.por_facturar ?? row?.saldo_por_facturar;
      const porFacturar = porFacturarRaw != null ? num(porFacturarRaw) : Math.max(0, +(solicitado - fact).toFixed(2));

      return { solicitado, facturado: fact, porFacturar };
    };

    const isSinPagosAsociados = (pagosArray) => {
      const p = flattenPagosArr(pagosArray);
      return p.length === 0;
    };

    // ---------------- inputs ----------------
    const debug = Number(req.query.debug ?? 0) === 1;

    // ---------------- fetch SPs ----------------
    const spRows = await executeSP(STORED_PROCEDURE.GET.SOLICITUD_PAGO_PROVEEDOR);

    const ids = spRows
      .map((r) => r.id_solicitud_proveedor)
      .filter((id) => id !== null && id !== undefined);

    let pagosRaw = [];
    if (ids.length > 0) {
      // NOTE: hoy traes todos los pagos del SP, no filtras por ids.
      // Está OK para funcionalidad, pero puede pegar en performance.
      pagosRaw = await executeSP(STORED_PROCEDURE.GET.OBTENR_PAGOS_PROVEEDOR);
    }

    // ---------------- index pagos by solicitud ----------------
    const pagosBySolicitud = pagosRaw.reduce((acc, row) => {
      const key = String(row.id_solicitud_proveedor);

      // en tu código original: push(row.dispersiones_json, row.pagos_json)
      // aquí: parsea y flatten para que el front tenga un array usable
      const dispersiones = toArray(row.dispersiones_json);
      const pagos = toArray(row.pagos_json);

      (acc[key] ||= []).push(...dispersiones, ...pagos);
      return acc;
    }, {});

    // ---------------- normalize rows ----------------
    const data = spRows.map((r) => {
      // destructuring con tus campos + rest
      const {
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
      } = r;

      const pagos = pagosBySolicitud[String(id_solicitud_proveedor)] ?? [];
      const forma = norm(forma_pago_solicitada);

      const pagoStats = getPagoStats(pagos);

      const saldoNum = num(saldo);
      const estaPagada =
        norm(estatus_pagos) === "pagado" ||
        saldoNum === 0 ||
        pagoStats.anyPagadoEstado ||
        pagoStats.pagado >= num(monto_solicitado);

      // Facturas (si vienen dentro de rest en tu SP)
      const factNums = getFacturaNums({ ...r, ...rest });

      // devolvemos el shape que tu front ya espera + extras para que “muestres todo”
      return {
        ...rest,

        estatus_pagos,
        // NOTA: ya no calculamos filtro_pago en back como antes para no perder registros.
        // Lo vamos a calcular al agrupar, pero dejamos forma/saldo aquí accesibles.
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

        __computed: {
          forma,
          estaPagada,
          pagos_count: pagoStats.count,
          pagos_total_pagado: pagoStats.pagado,
          pagos_total_solicitado_sum: pagoStats.solicitado,
          facturado: factNums.facturado,
          por_facturar: factNums.porFacturar,
          solicitado: factNums.solicitado,
        },
      };
    });

    // ---------------- buckets para front ----------------
    // reglas que pediste (front), pero aquí ya te lo acomodamos en el back
    const todos = data;

    const spei_solicitado = data.filter((d) => {
      const forma = d.__computed?.forma;
      return forma === "transfer" && isSinPagosAsociados(d.pagos);
    });

    const pago_tdc = data.filter((d) => {
      const forma = d.__computed?.forma;
      return forma === "card" && isSinPagosAsociados(d.pagos);
    });

    const pago_link = data.filter((d) => {
      const forma = d.__computed?.forma;
      return forma === "link" && isSinPagosAsociados(d.pagos);
    });

    // Carta enviada: credit y (sin facturar / parcial / por facturar == solicitado)
    const carta_enviada = data.filter((d) => {
      const forma = d.__computed?.forma;
      if (forma !== "credit") return false;

      const solicitado = num(d.__computed?.solicitado);
      const facturado = num(d.__computed?.facturado);
      const porFacturar = num(d.__computed?.por_facturar);

      // condiciones que diste (equivalentes en práctica)
      const sinFacturar = facturado <= 0;
      const parcial = facturado > 0 && facturado < solicitado;
      const porFacturarIgualSolicitado = porFacturar === solicitado;

      return sinFacturar || parcial || porFacturarIgualSolicitado;
    });

    // Carta garantía: credit y (facturado == solicitado) y (por facturar == 0)
    const carta_garantia = data.filter((d) => {
      const forma = d.__computed?.forma;
      if (forma !== "credit") return false;

      const solicitado = num(d.__computed?.solicitado);
      const facturado = num(d.__computed?.facturado);
      const porFacturar = num(d.__computed?.por_facturar);

      return facturado === solicitado && porFacturar === 0;
    });

    // Pagada (carpeta): marcadas como pagadas por regla de negocio
    // Nota: puedes ajustar si “pagada” solo aplica a transfer, etc.
    const pagada = data.filter((d) => !!d.__computed?.estaPagada);

    // Histórico vacío por ahora (como pediste)
    const historico = [];

    // Otros: lo que no cayó en ninguna categoría (para no “perder” registros)
    const inAny = new Set();
    const addIds = (arr) => {
      for (const x of arr) {
        const id = x?.solicitud_proveedor?.id_solicitud_proveedor;
        if (id != null) inAny.add(String(id));
      }
    };
    addIds(spei_solicitado);
    addIds(pago_tdc);
    addIds(pago_link);
    addIds(carta_enviada);
    addIds(carta_garantia);
    addIds(pagada);

    const otros = data.filter((d) => {
      const id = d?.solicitud_proveedor?.id_solicitud_proveedor;
      if (id == null) return true;
      return !inAny.has(String(id));
    });

    // ---------------- debug meta ----------------
    const responseData = {
      todos,
      spei_solicitado,
      pago_tdc,
      pago_link,
      carta_enviada,
      carta_garantia,
      pagada,
      historico,
      otros,
    };

    if (debug) {
      const byForma = data.reduce((acc, d) => {
        const f = d.__computed?.forma || "(vacio)";
        acc[f] = (acc[f] || 0) + 1;
        return acc;
      }, {});

      const counts = {
        spRows_len: spRows.length,
        mapped_len: data.length,
        pagosRaw_len: pagosRaw.length,
        ids_null: spRows.filter((x) => x.id_solicitud_proveedor == null).length,
      };

      const buckets = {
        todos: todos.length,
        spei_solicitado: spei_solicitado.length,
        pago_tdc: pago_tdc.length,
        pago_link: pago_link.length,
        carta_enviada: carta_enviada.length,
        carta_garantia: carta_garantia.length,
        pagada: pagada.length,
        historico: historico.length,
        otros: otros.length,
      };

      responseData.meta = {
        counts,
        byForma,
        buckets,
        ejemplo_otros: otros.slice(0, 15).map((d) => ({
          id: d?.solicitud_proveedor?.id_solicitud_proveedor,
          forma: d?.solicitud_proveedor?.forma_pago_solicitada,
          saldo: d?.solicitud_proveedor?.saldo,
          estatus_pagos: d?.estatus_pagos,
          pagos_count: d.__computed?.pagos_count,
          facturado: d.__computed?.facturado,
          por_facturar: d.__computed?.por_facturar,
          solicitado: d.__computed?.solicitado,
        })),
      };
    }

    // ---------------- response ----------------
    res.set({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      Expires: "0",
    });

    return res.status(200).json({
      message: "Registros obtenidos con exito",
      ok: true,
      data: responseData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      error: "Internal Server Error",
      details: error?.message || error,
    });
  }
};

module.exports = { getSolicitudes };



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
  // ✅ nuevo
  "consolidado",
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
  // ✅ nuevo
  "consolidado",
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

const Detalles = async (req, res) => {
  try {
    const {
      id_solicitud_proveedor,
      id_proveedor,
      id_facturas,
      id_pagos,
    } = req.body || {};

    // -----------------------------
    // 1) Validación mínima
    // -----------------------------
    if (!id_solicitud_proveedor) {
      return res.status(400).json({
        ok: false,
        error: "Falta id_solicitud_proveedor en el body",
      });
    }

    // -----------------------------
    // 2) Normalización de arrays
    // -----------------------------
    const normalizeArray = (v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        const s = v.trim();
        if (!s) return [];
        try {
          const parsed = JSON.parse(s);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [s];
        }
      }
      return [v];
    };

    const facturasArr = normalizeArray(id_facturas)
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);

    const pagosArr = normalizeArray(id_pagos)
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);

    // -----------------------------
    // 3) Traer info base de solicitud
    // -----------------------------
    const solicitudSql = `
      SELECT *
      FROM solicitudes_pago_proveedor
      WHERE id_solicitud_proveedor = ?
      LIMIT 1;
    `;

    const solicitudRows = await executeQuery(solicitudSql, [id_solicitud_proveedor]);
    const solicitud =
      Array.isArray(solicitudRows) ? solicitudRows[0] : solicitudRows?.[0] ?? null;

    // -----------------------------
    // 4) FACTURAS
    // -----------------------------
    let facturas = [];

    if (facturasArr.length > 0) {
      const placeholders = facturasArr.map(() => "?").join(",");

      const facturasSqlMain = `
        SELECT *
        FROM facturas_pago_proveedor
        WHERE id_factura_proveedor IN (${placeholders});
      `;

      const factRowsMain = await executeQuery(facturasSqlMain, facturasArr);
      facturas = Array.isArray(factRowsMain) ? factRowsMain : factRowsMain?.[0] ?? [];

      // fallback: id_factura
      if (!facturas || facturas.length === 0) {
        const facturasSqlFallback = `
          SELECT *
          FROM facturas_pago_proveedor
          WHERE id_factura IN (${placeholders});
        `;
        const factRowsFallback = await executeQuery(facturasSqlFallback, facturasArr);
        const fb = Array.isArray(factRowsFallback)
          ? factRowsFallback
          : factRowsFallback?.[0] ?? [];

        if (Array.isArray(fb) && fb.length > 0) facturas = fb;
      }
    }

    // -----------------------------
    // 5) PAGOS
    // -----------------------------
    let pagos = [];

    if (pagosArr.length > 0) {
      const placeholders = pagosArr.map(() => "?").join(",");

      const pagosSqlMain = `
        SELECT *
        FROM pago_proveedores
        WHERE id_pago_proveedores IN (${placeholders});
      `;

      const pagosRowsMain = await executeQuery(pagosSqlMain, pagosArr);
      pagos = Array.isArray(pagosRowsMain) ? pagosRowsMain : pagosRowsMain?.[0] ?? [];

      // fallback: id_pago_proveedor
      if (!pagos || pagos.length === 0) {
        const pagosSqlFallback = `
          SELECT *
          FROM pago_proveedores
          WHERE id_pago_proveedor IN (${placeholders});
        `;
        const pagosRowsFallback = await executeQuery(pagosSqlFallback, pagosArr);
        const fb = Array.isArray(pagosRowsFallback)
          ? pagosRowsFallback
          : pagosRowsFallback?.[0] ?? [];

        if (Array.isArray(fb) && fb.length > 0) pagos = fb;
      }
    }

    // =========================================================
    // ✅ 6) CONSULTA EXTRA: pagos_facturas_proveedores
    // =========================================================
    // Tabla:
    // id, id_pago_proveedor, id_solicitud, id_factura,
    // monto_facturado, monto_pago, created_at, updated_at

    let pfp = [];

    {
      const where = [];
      const params = [];

      // siempre filtramos por id_solicitud (id_solicitud_proveedor de tu payload)
      where.push(`id_solicitud = ?`);
      params.push(Number(id_solicitud_proveedor));

      // filtrar por pagos si viene
      if (pagosArr.length > 0) {
        const ph = pagosArr.map(() => "?").join(",");
        where.push(`id_pago_proveedor IN (${ph})`);
        params.push(...pagosArr.map((x) => Number(x)));
      }

      // filtrar por facturas si viene
      if (facturasArr.length > 0) {
        const ph = facturasArr.map(() => "?").join(",");
        where.push(`id_factura IN (${ph})`);
        params.push(...facturasArr);
      }

      const pfpSql = `
        SELECT *
        FROM pagos_facturas_proveedores
        WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC;
      `;

      const pfpRows = await executeQuery(pfpSql, params);
      pfp = Array.isArray(pfpRows) ? pfpRows : pfpRows?.[0] ?? [];
    }

    // =========================================================
    // ✅ 7) VALIDACIÓN / RESUMEN (cuánto pagado vs facturado)
    // =========================================================
    const toNum = (v) => {
      const n = Number(String(v ?? "").trim());
      return Number.isFinite(n) ? n : 0;
    };

    let total_pagado = 0;
    let total_facturado = 0;

    // resumen por factura: { [id_factura]: { pagado, facturado, diferencia } }
    const por_factura_map = new Map();

    for (const row of pfp) {
      const idFactura = String(row?.id_factura ?? "").trim();
      const pagado = toNum(row?.monto_pago);
      const facturado = toNum(row?.monto_facturado);

      total_pagado += pagado;
      total_facturado += facturado;

      if (!idFactura) continue;

      const prev = por_factura_map.get(idFactura) || { id_factura: idFactura, pagado: 0, facturado: 0 };
      prev.pagado += pagado;
      prev.facturado += facturado;
      por_factura_map.set(idFactura, prev);
    }

    const por_factura = Array.from(por_factura_map.values()).map((x) => ({
      ...x,
      diferencia: Number((x.pagado - x.facturado).toFixed(2)),
      estatus:
        Math.abs(x.pagado - x.facturado) < 0.01
          ? "CUADRADO"
          : x.pagado > x.facturado
          ? "PAGADO_DE_MAS"
          : "FALTA_PAGAR",
    }));

    const resumen_validacion = {
      total_pagado: Number(total_pagado.toFixed(2)),
      total_facturado: Number(total_facturado.toFixed(2)),
      diferencia_total: Number((total_pagado - total_facturado).toFixed(2)),
      por_factura,
    };

    // -----------------------------
    // 8) Response
    // -----------------------------
    return res.status(200).json({
      ok: true,
      message: "Detalles obtenidos correctamente",
      request: {
        id_solicitud_proveedor: String(id_solicitud_proveedor),
        id_proveedor: String(id_proveedor ?? "").trim(),
        id_facturas: facturasArr,
        id_pagos: pagosArr,
      },
      data: {
        solicitud,
        facturas,
        pagos,

        // ✅ tabla de relación (pago-factura)
        pagos_facturas_proveedores: pfp,

        // ✅ validación pagado vs facturado
        resumen_validacion,
      },
    });
  } catch (error) {
    console.error("Error en Detalles:", error);
    return res.status(500).json({
      ok: false,
      error: "Error en el servidor",
      details: error?.message ?? error,
    });
  }
};



module.exports = {
  createSolicitud,
  Detalles,
  getSolicitudes,
  createDispersion,
  createPago,
  getDatosFiscalesProveedor,
  editProveedores,
  getProveedores,
  cargarFactura,
  EditCampos
};