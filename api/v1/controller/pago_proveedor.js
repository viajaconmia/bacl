const {
  executeSP,
  executeSP2,
  executeQuery,
  executeTransaction,
} = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
const {
  ajustarSolicitudPorDisminucionCostoProveedor,
  ajustarSolicitudPorAumentoCostoProveedor,
} = require("../../../v2/controller/reservas.controller");

const { STORED_PROCEDURE } = require("../../../lib/constant/stored_procedures");

//helpers

function money2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  // redondeo a 2 decimales
  return Math.round(x * 100) / 100;
}

function mapPagoStatusFromFormaPago(formaPago) {
  const fp = String(formaPago || "")
    .trim()
    .toLowerCase();
  if (fp === "card") return "PAGADO TARJETA";
  if (fp === "link") return "PAGADO LINK";
  if (fp === "transfer") return "PAGADO TRANSFERENCIA";
  // si "credit" en tu negocio se paga como transferencia:
  if (fp === "credit") return "PAGADO TRANSFERENCIA";
  return null;
}

function mapFormaPagoSolicitudToSaldo(formaPagoSolicitada) {
  const fp = String(formaPagoSolicitada || "")
    .trim()
    .toLowerCase();
  if (fp === "transfer") return "SPEI";
  if (fp === "link") return "LINK";
  if (fp === "card") return "LINK";
  return "TRANSFERENCIA";
}

// Si YA tienes estas funcs, usa las tuyas:
function makeIdSaldo() {
  return `SAL_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function randomTransactionId() {
  return `TX_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function mapPaidStatusFromFormaPagoExceptCredit(formaPago) {
  const fp = String(formaPago || "")
    .trim()
    .toLowerCase();
  if (fp === "transfer") return "PAGADO TRANSFERENCIA";
  if (fp === "card") return "PAGADO TARJETA";
  if (fp === "link") return "PAGADO LINK";
  // credit => NO cambiar estado
  return null;
}

async function finalizarSiSaldoCero({
  executeQuery,
  id_solicitud_proveedor,
  saldo_new,
  forma_pago_solicitada,
  EPS = 0.01,
}) {
  if (Math.abs(Number(saldo_new)) > EPS) {
    return { did: false };
  }

  const fp = String(forma_pago_solicitada || "")
    .trim()
    .toLowerCase();

  // siempre normaliza saldo a 0 cuando quedó en 0
  const paidStatus = mapPaidStatusFromFormaPagoExceptCredit(fp);

  if (!paidStatus) {
    // credit (o desconocido): NO tocar estado, solo saldo=0
    const q = `
      UPDATE solicitudes_pago_proveedor
      SET saldo = 0
      WHERE id_solicitud_proveedor = ?
    `;
    await executeQuery(q, [id_solicitud_proveedor]);
    return { did: true, estado_final: null, saldo_final: 0, keep_estado: true };
  }

  const q = `
    UPDATE solicitudes_pago_proveedor
    SET estado_solicitud = ?, saldo = 0
    WHERE id_solicitud_proveedor = ?
  `;
  await executeQuery(q, [paidStatus, id_solicitud_proveedor]);

  return {
    did: true,
    estado_final: paidStatus,
    saldo_final: 0,
    keep_estado: false,
  };
}

//========cambio para controlar aumento o disminucion
async function ajustarSolicitudPorAumentoMontoSolicitudDirecto({
  executeQuery,
  id_solicitud_proveedor,
  nuevoMonto,
  EPS = 0.01,
}) {
  const id = Number(id_solicitud_proveedor);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      ok: false,
      reason: "INVALID_ID_SOLICITUD",
      id_solicitud_proveedor,
    };
  }

  const total_new = Number(nuevoMonto);
  if (!Number.isFinite(total_new)) {
    return { ok: false, reason: "INVALID_TOTAL", nuevoMonto };
  }

  const qSol = `
    SELECT
      id_solicitud_proveedor,
      estado_solicitud,
      monto_solicitado,
      saldo,
      forma_pago_solicitada
    FROM solicitudes_pago_proveedor
    WHERE id_solicitud_proveedor = ?
    LIMIT 1
    FOR UPDATE
  `;
  const rSol = await executeQuery(qSol, [id]);
  if (!rSol?.length) return { ok: false, reason: "SOLICITUD_NOT_FOUND", id };

  const estado = String(rSol[0].estado_solicitud ?? "").trim();
  const forma_pago_solicitada = String(
    rSol[0].forma_pago_solicitada ?? "",
  ).trim();
  const monto_old = Number(rSol[0].monto_solicitado ?? 0);
  const saldo_old = Number(rSol[0].saldo ?? 0);

  const delta = money2(total_new - monto_old);
  if (Math.abs(delta) <= EPS) {
    return {
      ok: true,
      action: "NO_CHANGE",
      id,
      estado,
      monto_old,
      total_new,
      saldo_old,
    };
  }
  if (delta < -EPS) {
    return {
      ok: false,
      reason: "NOT_AN_INCREASE",
      id,
      delta,
      monto_old,
      total_new,
    };
  }

  const isPagado =
    estado === "PAGADO LINK" ||
    estado === "PAGADO TARJETA" ||
    estado === "PAGADO TRANSFERENCIA";

  const isCartaCupon = estado === "CUPON ENVIADO" || estado === "CARTA_ENVIADA";

  let action = "";
  let estado_anterior = null;

  if (isCartaCupon) {
    const qUp = `
      UPDATE solicitudes_pago_proveedor
      SET
        monto_solicitado = ?,
        saldo = COALESCE(saldo, 0) + ?
      WHERE id_solicitud_proveedor = ?
    `;
    await executeQuery(qUp, [money2(total_new), money2(delta), id]);
    action = "UPDATE_MONTO_SALDO";
  } else if (isPagado) {
    const qUp = `
      UPDATE solicitudes_pago_proveedor
      SET
        monto_solicitado = ?,
        saldo = COALESCE(saldo, 0) + ?,
        estado_solicitud = 'CARTA_ENVIADA',
        is_ajuste = 1,
        comentario_ajuste = 'Ajuste por aumento de monto (estaba pagado)'
      WHERE id_solicitud_proveedor = ?
    `;
    await executeQuery(qUp, [money2(total_new), money2(delta), id]);
    action = "PAGADO_TO_CARTA_ENVIADA_AJUSTE";
    estado_anterior = estado;
  } else if (estado === "DISPERSION") {
    const qUp = `
      UPDATE solicitudes_pago_proveedor
      SET
        monto_solicitado = ?,
        saldo = COALESCE(saldo, 0) + ?,
        is_ajuste = 1,
        comentario_ajuste = 'Ajuste por aumento de monto (en dispersión)'
      WHERE id_solicitud_proveedor = ?
    `;
    await executeQuery(qUp, [money2(total_new), money2(delta), id]);
    action = "DISPERSION_UPDATE_AND_MARK_AJUSTE";
  } else {
    const qUp = `
      UPDATE solicitudes_pago_proveedor
      SET
        monto_solicitado = ?,
        saldo = COALESCE(saldo, 0) + ?,
        is_ajuste = 1,
        comentario_ajuste = 'Ajuste por aumento de monto'
      WHERE id_solicitud_proveedor = ?
    `;
    await executeQuery(qUp, [money2(total_new), money2(delta), id]);
    action = "UPDATE_MONTO_SALDO_AND_MARK_AJUSTE";
  }

  // ✅ NUEVO: si saldo queda 0, marcar PAGADO según forma_pago_solicitada (excepto credit)
  const saldo_new = money2(saldo_old + delta);
  const fin = await finalizarSiSaldoCero({
    executeQuery,
    id_solicitud_proveedor: id,
    saldo_new,
    forma_pago_solicitada,
    EPS,
  });

  return {
    ok: true,
    action,
    id_solicitud_proveedor: id,
    estado,
    estado_anterior,
    forma_pago_solicitada,
    monto_old,
    monto_new: total_new,
    delta,
    saldo_old,
    saldo_new: fin.did ? 0 : saldo_new,
    estado_final: fin.did ? fin.estado_final : null, // null cuando credit (se mantiene)
  };
}

const obteneSrReservaDesdeSolicitud = async (
  executeQuery,
  id_solicitud_proveedor,
) => {
  const qBookingReserva = `
    SELECT id_booking
    FROM booking_solicitud
    WHERE id_solicitud = ?
    LIMIT 1
  `;
  const rBookingReserva = await executeQuery(qBookingReserva, [
    id_solicitud_proveedor,
  ]);

  return rBookingReserva?.length ? rBookingReserva[0].id_booking ?? null : null;
};

const obteneSrRelacionDesdeSolicitud = async (
  executeQuery,
  id_solicitud_proveedor,
) => {
  const qBookingReserva = `
    SELECT id_booking
    FROM booking_solicitud
    WHERE id_solicitud = ?
    LIMIT 1
  `;

  const q_relacion = `
    SELECT id_relacion
    FROM vw_new_reservas
    WHERE id_booking = ?
    LIMIT 1
  `;

  const rBookingReserva = await executeQuery(qBookingReserva, [
    id_solicitud_proveedor,
  ]);

  if (!rBookingReserva?.length) return null;

  const id_booking = rBookingReserva[0].id_booking;

  const relacopm = await executeQuery(q_relacion, [id_booking]);

  return relacopm?.length ? relacopm[0].id_relacion ?? null : null;
};

async function ajustarSolicitudPorDisminucionMontoSolicitudDirecto({
  executeQuery, // idealmente txExecuteQuery
  executeSP2, // opcional
  id_solicitud_proveedor,
  nuevoMonto,
  EPS = 0.01,
}) {
  const id = Number(id_solicitud_proveedor);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      ok: false,
      reason: "INVALID_ID_SOLICITUD",
      id_solicitud_proveedor,
    };
  }

  const total_new = Number(nuevoMonto);
  if (!Number.isFinite(total_new)) {
    return { ok: false, reason: "INVALID_TOTAL", nuevoMonto };
  }

  // 1) Leer fila (FOR UPDATE)
  const qSol = `
    SELECT
      id_solicitud_proveedor,
      id_proveedor,
      estado_solicitud,
      monto_solicitado,
      saldo,
      forma_pago_solicitada,
      comentarios
    FROM solicitudes_pago_proveedor
    WHERE id_solicitud_proveedor = ?
    LIMIT 1
    FOR UPDATE
  `;
  const rSol = await executeQuery(qSol, [id]);
  if (!rSol?.length) return { ok: false, reason: "SOLICITUD_NOT_FOUND", id };

  const row = rSol[0];

  const estado = String(row.estado_solicitud ?? "").trim();
  const forma_pago_solicitada = String(row.forma_pago_solicitada ?? "").trim();
  const monto_old = Number(row.monto_solicitado ?? 0);
  const saldo_old = Number(row.saldo ?? 0);
  const id_proveedor = String(row.id_proveedor ?? "").trim();
  const comentarios_solicitud = row.comentarios ?? null;

  const delta = money2(total_new - monto_old);
  if (Math.abs(delta) <= EPS) {
    return {
      ok: true,
      action: "NO_CHANGE",
      id,
      estado,
      monto_old,
      total_new,
      saldo_old,
    };
  }

  if (delta > EPS) {
    return {
      ok: false,
      reason: "NOT_A_DECREASE",
      id,
      delta,
      monto_old,
      total_new,
    };
  }

  // 2) Si está CANCELADA, normalmente no tocar (ajusta si tu negocio sí permite)
  if (estado === "CANCELADA") {
    return { ok: true, action: "NO_ACTION_CANCELADA", id, estado };
  }

  // 3) Primero: siempre actualiza monto + saldo
  const qUpBase = `
    UPDATE solicitudes_pago_proveedor
    SET
      monto_solicitado = ?,
      saldo = COALESCE(saldo, 0) + ?
    WHERE id_solicitud_proveedor = ?
  `;
  await executeQuery(qUpBase, [money2(total_new), money2(delta), id]);

  // 4) Calcular saldo_new (puedes releer o derivar)
  const saldo_new = money2(saldo_old + delta);

  // 4.1) saldo ~ 0 => marcar pagado según forma_pago
  if (Math.abs(saldo_new) <= EPS) {
    const nuevoEstado = mapPagoStatusFromFormaPago(forma_pago_solicitada);
    if (nuevoEstado) {
      const qPaid = `
        UPDATE solicitudes_pago_proveedor
        SET estado_solicitud = ?, saldo = 0
        WHERE id_solicitud_proveedor = ?
      `;
      await executeQuery(qPaid, [nuevoEstado, id]);

      return {
        ok: true,
        action: "UPDATE_MONTO_SALDO_AND_MARK_PAID",
        id_solicitud_proveedor: id,
        estado_anterior: estado,
        nuevoEstado,
        forma_pago_solicitada,
        monto_old,
        monto_new: total_new,
        delta,
        saldo_new: 0,
      };
    }

    return {
      ok: true,
      action: "SALDO_ZERO_UNKNOWN_PAYMENT",
      id_solicitud_proveedor: id,
      estado,
      forma_pago_solicitada,
      monto_old,
      monto_new: total_new,
      delta,
      saldo_new,
    };
  }

  // 4.2) saldo NEGATIVO => saldo a favor
  if (saldo_new < -EPS) {
    // marcar ajuste
    const qAdj = `
      UPDATE solicitudes_pago_proveedor
      SET
        is_ajuste = 1,
        comentario_ajuste = 'Ajuste por disminución de monto (saldo a favor)'
      WHERE id_solicitud_proveedor = ?
    `;
    await executeQuery(qAdj, [id]);

    const credito = money2(Math.abs(saldo_new));
    const id_saldo = makeIdSaldo();
    const transaction_id = randomTransactionId();

    const forma_pago_saldo = mapFormaPagoSolicitudToSaldo(
      forma_pago_solicitada,
    );

    const referencia = `AJUSTE_LOW
    }`;
    const motivo = "Ajuste por disminución de monto proveedor";
    const comentarios = [
      `Saldo quedó negativo: ${money2(saldo_new)}`,
      `Monto anterior: ${money2(monto_old)} | Nuevo: ${money2(total_new)} | Delta: ${money2(delta)}`,
      comentarios_solicitud
        ? `Comentarios solicitud: ${comentarios_solicitud}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");

      const reserva = await obteneSrReservaDesdeSolicitud(executeQuery, id);
      const id_hospedaje = await obteneSrRelacionDesdeSolicitud(executeQuery, id);
      
    const qInsSaldo = `
      INSERT INTO saldos
        (id_saldo, id_proveedor, monto, restante, forma_pago, fecha_procesamiento,
         referencia, id_hospedaje, transaction_id, motivo, comentarios, estado,reserva)
      VALUES
        (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, 'pending')
    `;

    await executeQuery(qInsSaldo, [
      id_saldo,
      id_proveedor,
      credito,
      credito,
      forma_pago_saldo,
      referencia,
      id_hospedaje,
      transaction_id,
      motivo,
      comentarios,
      reserva
    ]);

    return {
      ok: true,
      action: "UPDATE_MONTO_SALDO_AND_INSERT_SALDO_FAVOR",
      id_solicitud_proveedor: id,
      estado,
      forma_pago_solicitada,
      monto_old,
      monto_new: total_new,
      delta,
      saldo_new,
      id_saldo,
      transaction_id,
      credito,
    };
  }

  // 4.3) saldo POSITIVO => si el estado está “fuera de lista” puedes marcar ajuste + SP si transfer
  if (
    estado !== "CUPON ENVIADO" &&
    estado !== "CARTA_ENVIADA" &&
    estado !== "DISPERSION"
  ) {
    const qAdj = `
      UPDATE solicitudes_pago_proveedor
      SET
        is_ajuste = 1,
        comentario_ajuste = 'Ajuste por disminución de monto'
      WHERE id_solicitud_proveedor = ?
    `;
    await executeQuery(qAdj, [id]);

    const fp = String(forma_pago_solicitada || "")
      .trim()
      .toLowerCase();
    if (fp === "transfer" && typeof executeSP2 === "function") {
      await executeSP2("sp_saldo_a_favor_proveedor", [id]);
      return {
        ok: true,
        action: "MARK_AJUSTE_AND_CALL_SP_TRANSFER",
        id_solicitud_proveedor: id,
        estado,
        forma_pago_solicitada,
        monto_old,
        monto_new: total_new,
        delta,
        saldo_new,
      };
    }

    return {
      ok: true,
      action:
        fp === "transfer" ? "MARK_AJUSTE_TRANSFER_NO_SP" : "MARK_AJUSTE_NO_SP",
      id_solicitud_proveedor: id,
      estado,
      forma_pago_solicitada,
      monto_old,
      monto_new: total_new,
      delta,
      saldo_new,
    };
  }

  // En CUPON/CARTA/DISPERSION con saldo>0, solo base update (ya hecho)
  return {
    ok: true,
    action: "UPDATE_MONTO_SALDO",
    id_solicitud_proveedor: id,
    estado,
    forma_pago_solicitada,
    monto_old,
    monto_new: total_new,
    delta,
    saldo_new,
  };
}

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
      paymentMethod, // transfer | card | link (a veces)
      paymentStatus,
      comments,
      comments_cxp,
      date,
      paymentType, // credit (si aplica)
      selectedCard,
      id_hospedaje,
      usuario_creador,
      paymentSchedule = [],
      moneda,
      documento,
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

    // ✅ 1) Session seguro (no revienta si no hay sesión)
    const session = req.session?.user?.id ?? "";

    // ✅ 2) Fallback configurable: "" (vacío) o "cliente"
    const USER_FALLBACK = "cliente"; // <-- si quieres vacío: pon "";

    // ✅ 3) Resolver userId: prioriza session, luego usuario_creador, luego fallback
    const resolveUserId = (...candidates) => {
      const found = candidates
        .map((v) => String(v ?? "").trim())
        .find((v) => v.length > 0);

      return found || USER_FALLBACK;
    };

    let userId = resolveUserId(session, usuario_creador);

    // (Opcional) si quieres que a DB llegue NULL en vez de "" cuando esté vacío:
    const userIdDB = userId === "" ? null : userId;

    console.log("session:", session, " userId:", userId);

    // ✅ Mapeos como ya los tienes
    const mapEstadoSolicitud = (status) => {
      const s = String(status || "")
        .trim()
        .toLowerCase();
      if (s === "spei_solicitado") return "transferencia solicitada";
      if (s === "enviada_para_cobro") return "enviada a cobro";
      if (s === "pago_tdc") return "solicitud pago tdc";
      if (s === "cupon_enviado") return "cupon enviado";
      if (s === "pagada") return "pagada";
      return "pendiente";
    };

    const mapEstatusPagos = (estadoSolicitud) => {
      const s = String(estadoSolicitud || "")
        .trim()
        .toLowerCase();
      if (s === "pagada") return "pagado";
      return "enviado_a_pago";
    };

    const insertPagoProveedorLinkSql = `
  INSERT INTO pago_proveedores (
    id_pago_dispersion,
    
    id_solicitud_proveedor,
    codigo_dispersion,
    monto_pagado,
    fecha_pago,
    url_pdf,
    monto_facturado,
    url_factura,
    fecha_update,
    id_factura,
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
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, NOW(), ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?
  );
`;
    const insertPagoProveedorCardSql = `
  INSERT INTO pago_proveedores (
    id_pago_dispersion,
    id_solicitud_proveedor,
    codigo_dispersion,
    fecha_pago,
    url_pdf,
    monto_facturado,
    url_factura,
    fecha_update,
    id_factura,
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
  ) VALUES (
    ?, ?, ?, ?,
    ?, ?, ?, NOW(), ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?
  );
`;

    // ✅ Estado inicial EXACTO como tu enum real:
    const estado_solicitud_db =
      formaPagoDB === "credit"
        ? "CUPON ENVIADO"
        : formaPagoDB === "transfer"
          ? "TRANSFERENCIA_SOLICITADA"
          : formaPagoDB === "card"
            ? "CARTA_ENVIADA"
            : formaPagoDB === "link"
              ? "PAGADO_LINK"
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
      return res
        .status(400)
        .json({ ok: false, message: "Falta id_hospedaje." });
    }
    if (!date) {
      return res.status(400).json({ ok: false, message: "Falta date." });
    }

    const fechaSolicitud =
      formaPagoDB === "card" || formaPagoDB === "link"
        ? schedule?.[0]?.fecha_pago || date
        : date;

    // ✅ tarjeta SOLO card/link; transfer/credit => NULL
    const cardId =
      formaPagoDB === "card" || formaPagoDB === "link"
        ? String(selectedCard)
        : null;

    const documentoId = String(documento ?? "").trim() || null;

    const parametrosSP = [
      Number(monto_a_pagar), // p_monto_solicitado
      formaPagoDB, // p_forma_pago_solicitada (credit/transfer/card/link)
      cardId, // p_id_tarjeta_solicitada (NULL para transfer/credit)
      userId, // p_usuario_solicitante (UUID)
      userId, // p_usuario_generador (UUID)
      comments || "", // p_comentarios
      comments_cxp || "", // p_comentario_cxp
      userId, // p_id_creador (UUID)  <-- evita NULL
      id_hospedaje, // p_id_hospedaje
      fechaSolicitud, // p_fecha
      estado_solicitud_db, // p_estado_solicitud
      estatus_pagos_db, // p_estatus_pagos
      documentoId,
    ];

    const spResp = await executeSP(
      STORED_PROCEDURE.POST.SOLICITUD_PAGO_PROVEEDOR,
      parametrosSP,
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
    // ... ya tienes idSolicitudProveedor validado arriba

    // Inserta en pago_proveedores SOLO para card/link (según lo que pediste)
    if (formaPagoDB === "link" || formaPagoDB === "card") {
      // normaliza schedule (ya lo traes como `schedule`)
      const rows = (Array.isArray(schedule) ? schedule : [])
        .map((it) => ({
          fecha_pago: it?.fecha_pago || date,
          monto: Number(it?.monto || 0),
        }))
        .filter(
          (it) => it.fecha_pago && Number.isFinite(it.monto) && it.monto > 0,
        );

      if (rows.length === 0) {
        return res.status(400).json({
          ok: false,
          message:
            "paymentSchedule inválido: no hay fechas/montos válidos para insertar en pago_proveedores",
        });
      }

      const conceptoBase = `Pago proveedor (${formaPagoDB})`;
      const descripcionBase = comments || "";
      const monedaDB = moneda ?? null;

      // Usa el SQL correcto
      const sql =
        formaPagoDB === "link"
          ? insertPagoProveedorLinkSql
          : insertPagoProveedorCardSql;

      for (let i = 0; i < rows.length; i++) {
        const { fecha_pago, monto } = rows[i];

        // Valores comunes (campos que NO tienes => NULL)
        const common = {
          id_pago_dispersion: null,
          id_solicitud_proveedor: Number(idSolicitudProveedor),
          codigo_dispersion: null, // si quieres, aquí puedes generar un código
          fecha_pago,
          url_pdf: null,
          monto_facturado: 0, // no hay factura todavía
          url_factura: null,
          id_factura: null,
          user_update: null, // o userId si tú quieres
          user_created: userId,
          fecha_emision: null,
          numero_comprobante: null,
          cuenta_origen: null,
          cuenta_destino: null,
          monto, // el monto del schedule
          moneda: monedaDB,
          concepto: conceptoBase,
          metodo_de_pago: formaPagoDB, // "link" o "card"
          referencia_pago: selectedCard ? String(selectedCard) : null,
          nombre_pagador: null,
          rfc_pagador: null,
          domicilio_pagador: null,
          nombre_beneficiario: null,
          domicilio_beneficiario: null,
          descripcion: descripcionBase,
          iva: null,
          total: monto, // si prefieres NULL, cámbialo aquí
        };

        if (formaPagoDB === "link") {
          // LINK: sí mandamos monto_pagado = monto
          const params = [
            common.id_pago_dispersion,
            common.id_solicitud_proveedor,
            common.codigo_dispersion,
            monto, // monto_pagado (LINK)
            common.fecha_pago,
            common.url_pdf,
            common.monto_facturado,
            common.url_factura,
            common.id_factura,
            common.user_update,
            common.user_created,
            common.fecha_emision,
            common.numero_comprobante,
            common.cuenta_origen,
            common.cuenta_destino,
            common.monto,
            common.moneda,
            common.concepto,
            common.metodo_de_pago,
            common.referencia_pago,
            common.nombre_pagador,
            common.rfc_pagador,
            common.domicilio_pagador,
            common.nombre_beneficiario,
            common.domicilio_beneficiario,
            common.descripcion,
            common.iva,
            common.total,
          ];

          await executeQuery(sql, params);
        } else {
          // CARD: NO mandamos monto_pagado
          const params = [
            common.id_pago_dispersion,
            common.id_solicitud_proveedor,
            common.codigo_dispersion,
            common.fecha_pago,
            common.url_pdf,
            common.monto_facturado,
            common.url_factura,
            common.id_factura,
            common.user_update,
            common.user_created,
            common.fecha_emision,
            common.numero_comprobante,
            common.cuenta_origen,
            common.cuenta_destino,
            common.monto,
            common.moneda,
            common.concepto,
            common.metodo_de_pago,
            common.referencia_pago,
            common.nombre_pagador,
            common.rfc_pagador,
            common.domicilio_pagador,
            common.nombre_beneficiario,
            common.domicilio_beneficiario,
            common.descripcion,
            common.iva,
            common.total,
          ];

          await executeQuery(sql, params);
        }
      }
    }

    return res.status(200).json({
      ok: true,
      message: "Solicitud creada con éxito",
      id_solicitud_proveedor: Number(idSolicitudProveedor),
    });
  } catch (error) {
    // ✅ logging útil de MySQL
    console.error("❌ Error createSolicitud:", error);

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

    const {
      id_dispersion,
      referencia_numerica,
      motivo_pago,
      layoutUrl,
      solicitudes = [],
    } = req.body;

    const idDispersion = String(id_dispersion ?? "").trim();
    const referenciaNumerica = String(referencia_numerica ?? "").trim() || null;
    const motivoPago = String(motivo_pago ?? "").trim() || null;
    const layoutUrlSafe = String(layoutUrl ?? "").trim() || null;

    if (!idDispersion) {
      return res.status(400).json({
        ok: false,
        message: "id_dispersion es requerido",
      });
    }

    if (!Array.isArray(solicitudes) || solicitudes.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Debe haber al menos una solicitud en la dispersión",
      });
    }

    // 1) IDs únicos válidos
    const ids = [
      ...new Set(
        solicitudes
          .map((s) => Number(s?.id_solicitud_proveedor))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];

    if (ids.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Las solicitudes no traen id_solicitud_proveedor válido",
      });
    }

    // 2) Normalizar payload recibido
    const solicitudMap = new Map(
      solicitudes.map((s) => {
        const idSolProv = Number(s?.id_solicitud_proveedor);

        return [
          idSolProv,
          {
            ...s,
            id_solicitud:
              s?.id_solicitud != null ? String(s.id_solicitud) : null,
            id_solicitud_proveedor:
              Number.isInteger(idSolProv) && idSolProv > 0 ? idSolProv : null,
            id_pago: s?.id_pago != null ? String(s.id_pago) : null,

            id_proveedor:
              s?.id_proveedor != null && s.id_proveedor !== ""
                ? Number(s.id_proveedor)
                : null,

            clave_proveedor:
              s?.clave_proveedor != null && s.clave_proveedor !== ""
                ? String(s.clave_proveedor).trim()
                : null,

            cuenta_de_deposito:
              s?.cuenta_de_deposito != null && s.cuenta_de_deposito !== ""
                ? String(s.cuenta_de_deposito).trim()
                : null,

            tipo_cuenta:
              s?.tipo_cuenta != null && s.tipo_cuenta !== ""
                ? String(s.tipo_cuenta).trim()
                : null,

            costo_proveedor:
              s?.costo_proveedor != null && s.costo_proveedor !== ""
                ? Number(s.costo_proveedor)
                : null,

            codigo_hotel:
              s?.codigo_hotel != null && s.codigo_hotel !== ""
                ? String(s.codigo_hotel).trim()
                : null,

            fecha_pago:
              s?.fecha_pago != null && s.fecha_pago !== ""
                ? s.fecha_pago
                : null,
          },
        ];
      }),
    );

    const inPlaceholders = ids.map(() => "?").join(", ");

    // 3) Obtener saldo y estado actual de las solicitudes
    const saldoSql = `
      SELECT
        id_solicitud_proveedor,
        saldo,
        estado_solicitud
      FROM solicitudes_pago_proveedor
      WHERE id_solicitud_proveedor IN (${inPlaceholders});
    `;

    const saldoRows = await executeQuery(saldoSql, ids);

    const saldoMap = new Map(
      (saldoRows || []).map((r) => [
        Number(r.id_solicitud_proveedor),
        {
          saldo: Number(r.saldo ?? 0),
          estado_solicitud: String(r.estado_solicitud ?? "").trim(),
        },
      ]),
    );

    const faltantes = ids.filter((id) => !saldoMap.has(id));
    if (faltantes.length > 0) {
      return res.status(400).json({
        ok: false,
        message:
          "No se encontró saldo para una o más solicitudes en solicitudes_pago_proveedor",
        faltantes,
      });
    }

    // 4) Evitar repetir solicitudes en el mismo código de dispersión
    const duplicateSql = `
      SELECT id_solicitud_proveedor
      FROM dispersion_pagos_proveedor
      WHERE codigo_dispersion = ?
        AND id_solicitud_proveedor IN (${inPlaceholders});
    `;

    const duplicateRows = await executeQuery(duplicateSql, [
      idDispersion,
      ...ids,
    ]);

    if ((duplicateRows || []).length > 0) {
      return res.status(400).json({
        ok: false,
        message:
          "Ya existen solicitudes registradas en dispersion_pagos_proveedor para este codigo_dispersion",
        duplicados: duplicateRows.map((r) => Number(r.id_solicitud_proveedor)),
      });
    }

    // 5) Insertar registros en dispersion_pagos_proveedor
    // Aquí seguimos usando el saldo de DB como monto oficial
    const values = ids.map((idSol) => {
      const dataDb = saldoMap.get(idSol);
      const itemPayload = solicitudMap.get(idSol);

      const saldoDb = Number(dataDb?.saldo ?? 0);
      const fechaPago = itemPayload?.fecha_pago ?? null;

      return [
        idSol, // id_solicitud_proveedor
        saldoDb, // monto_solicitado
        saldoDb, // saldo
        0, // monto_pagado
        idDispersion, // codigo_dispersion
        fechaPago, // fecha_pago
      ];
    });

    const insertPlaceholders = values
      .map(() => "(?, ?, ?, ?, ?, ?)")
      .join(", ");

    const insertSql = `
      INSERT INTO dispersion_pagos_proveedor (
        id_solicitud_proveedor,
        monto_solicitado,
        saldo,
        monto_pagado,
        codigo_dispersion,
        fecha_pago
      ) VALUES ${insertPlaceholders};
    `;

    const insertResult = await executeQuery(insertSql, values.flat());

    // 6) Actualizar estado de las solicitudes
    const updateSql = `
      UPDATE solicitudes_pago_proveedor
      SET estado_solicitud = 'DISPERSION'
      WHERE id_solicitud_proveedor IN (${inPlaceholders});
    `;

    await executeQuery(updateSql, ids);

    // 7) Reconstruir IDs insertados
    const firstInsertId = Number(insertResult?.insertId ?? 0);
    const insertedCount = Number(insertResult?.affectedRows ?? 0);

    const id_pagos =
      firstInsertId > 0 && insertedCount > 0
        ? Array.from({ length: insertedCount }, (_, i) =>
            String(firstInsertId + i),
          )
        : [];

    // 8) Resumen útil para revisar qué recibió el backend
    const solicitudesProcesadas = ids.map((idSol, index) => {
      const payload = solicitudMap.get(idSol);
      const saldoInfo = saldoMap.get(idSol);

      return {
        id_pago: id_pagos[index] ?? null,
        id_solicitud_proveedor: idSol,
        id_solicitud: payload?.id_solicitud ?? null,
        id_proveedor: payload?.id_proveedor ?? null,
        clave_proveedor: payload?.clave_proveedor ?? null,
        cuenta_de_deposito: payload?.cuenta_de_deposito ?? null,
        tipo_cuenta: payload?.tipo_cuenta ?? null,
        codigo_hotel: payload?.codigo_hotel ?? null,
        fecha_pago: payload?.fecha_pago ?? null,
        saldo_db: Number(saldoInfo?.saldo ?? 0),
      };
    });

    return res.status(200).json({
      ok: true,
      message: "Dispersión creada y registros guardados correctamente",
      data: {
        id_dispersion: idDispersion,
        referencia_numerica: referenciaNumerica,
        motivo_pago: motivoPago,
        layoutUrl: layoutUrlSafe,
        id_pagos,
        total_registros: ids.length,
        solicitudes_procesadas: solicitudesProcesadas,
      },
    });
  } catch (error) {
    console.error("❌ Error en createDispersion:", error);

    return res.status(500).json({
      ok: false,
      error: "Internal Server Error",
      details: error?.sqlMessage || error?.message,
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
            `No existe registro en dispersion_pagos_proveedor (id=${id_dispersion_pagos_proveedor}, codigo=${codigo_dispersion})`,
          );
        }

        const saldoDisp = Number(rowsDisp[0].saldo || 0);
        idSolicitud = rowsDisp[0].id_solicitud_proveedor;

        if (saldoDisp <= 0) {
          throw new Error(
            `Saldo en dispersion_pagos_proveedor es 0. No se permite registrar el pago. (id_dispersion=${id_dispersion_pagos_proveedor})`,
          );
        }
      }

      // 2) Si dispersion NO tiene saldo 0 (o no aplica), validar en solicitudes_pago_proveedor
      if (!idSolicitud) {
        throw new Error(
          `No se pudo determinar id_solicitud_proveedor para validar saldo en solicitudes_pago_proveedor`,
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
          `No existe registro en solicitudes_pago_proveedor (id=${idSolicitud})`,
        );
      }

      const saldoSol = Number(rowsSol[0].saldo || 0);
      if (saldoSol <= 0) {
        throw new Error(
          `Saldo en solicitudes_pago_proveedor es 0. No se permite registrar el pago. (id_solicitud=${idSolicitud})`,
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
          `No existe en dispersion_pagos_proveedor: id=${id_dispersion_pagos_proveedor}, codigo=${codigo_dispersion}`,
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
              csvRow["Domicilio del beneficiario"],
            ),

            user_created: userCreated,
            user_update: userUpdate,
          };

          if (!pagoData.id_pago_dispersion) {
            throw new Error(
              `id_dispersion inválido: "${csvRow.id_dispersion}"`,
            );
          }
          if (!pagoData.codigo_dispersion) {
            throw new Error(`codigo_dispersion no encontrado en fila ${i + 1}`);
          }
          if (!pagoData.monto_pagado || pagoData.monto_pagado <= 0) {
            throw new Error(
              `Cargo inválido en fila ${i + 1}: "${csvRow["Cargo"]}"`,
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
            id_solicitud:
              impacto.id_solicitud_proveedor || precheck.id_solicitud_proveedor,
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

const createComprobantePago = async (req, res) => {
  try {
    const {
      frontendData = {},
      csvData = [],
      isMasivo = false,
    } = req.body || {};

    const SOLICITUDES_TABLE = "solicitudes_pago_proveedor";

    const toNull = (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === "string") {
        const s = v.trim();
        if (
          !s ||
          s.toLowerCase() === "null" ||
          s.toLowerCase() === "undefined"
        ) {
          return null;
        }
        return s;
      }
      return v;
    };

    const toDecOrNull = (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).replace(/,/g, "").trim();
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };

    const parseFechaSafe = (value) => {
      if (!value) return new Date();

      const s = String(value).trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return new Date(`${s}T00:00:00`);
      }

      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const dd = Number(m[1]);
        const mm = Number(m[2]);
        const yyyy = Number(m[3]);
        return new Date(yyyy, mm - 1, dd);
      }

      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    };

    const round2 = (n) => Number(Number(n || 0).toFixed(2));

    const insertarPago = async ({
      id_solicitud_proveedor,
      monto_pagado,
      fecha_pago,
      url_pdf,
      concepto,
    }) => {
      const query = `
        INSERT INTO pago_proveedores (
          id_solicitud_proveedor,
          monto_pagado,
          fecha_pago,
          url_pdf,
          monto,
          total,
          concepto
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        id_solicitud_proveedor,
        monto_pagado,
        fecha_pago,
        url_pdf,
        monto_pagado,
        monto_pagado,
        concepto,
      ];

      return await executeQuery(query, values);
    };

    const getSolicitudById = async (id_solicitud_proveedor) => {
      const query = `
        SELECT
          spp.id_solicitud_proveedor,
          spp.monto_solicitado,
          COALESCE(pp.total_pagado, 0) AS total_pagado
        FROM ${SOLICITUDES_TABLE} spp
        LEFT JOIN (
          SELECT
            id_solicitud_proveedor,
            SUM(COALESCE(monto_pagado, 0)) AS total_pagado
          FROM pago_proveedores
          GROUP BY id_solicitud_proveedor
        ) pp
          ON pp.id_solicitud_proveedor = spp.id_solicitud_proveedor
        WHERE spp.id_solicitud_proveedor = ?
        LIMIT 1
      `;

      const rows = await executeQuery(query, [id_solicitud_proveedor]);
      return Array.isArray(rows) ? rows : [];
    };

    const getSolicitudesByCodigoConfirmacion = async (codigo_confirmacion) => {
      const query = `
        SELECT DISTINCT
          bs.id_solicitud_proveedor,
          spp.monto_solicitado,
          COALESCE(pp.total_pagado, 0) AS total_pagado,
          vnr.id_booking,
          vnr.codigo_confirmacion
        FROM vw_new_reservas vnr
        INNER JOIN booking_solicitud bs
          ON bs.id_booking = vnr.id_booking
        INNER JOIN ${SOLICITUDES_TABLE} spp
          ON spp.id_solicitud_proveedor = bs.id_solicitud_proveedor
        LEFT JOIN (
          SELECT
            id_solicitud_proveedor,
            SUM(COALESCE(monto_pagado, 0)) AS total_pagado
          FROM pago_proveedores
          GROUP BY id_solicitud_proveedor
        ) pp
          ON pp.id_solicitud_proveedor = bs.id_solicitud_proveedor
        WHERE TRIM(vnr.codigo_confirmacion) = TRIM(?)
      `;

      const rows = await executeQuery(query, [codigo_confirmacion]);
      return Array.isArray(rows) ? rows : [];
    };

    const resolvePagoRows = async ({
      rawRow,
      defaultUrlPdf,
      defaultConcepto = null,
    }) => {
      const id_solicitud_proveedor =
        toNull(rawRow.id_solicitud_proveedor) ||
        toNull(rawRow.id_solicitud) ||
        toNull(rawRow["id_solicitud_proveedor"]) ||
        toNull(rawRow["id_solicitud"]);

      const codigo_confirmacion =
        toNull(rawRow.codigo_confirmacion) ||
        toNull(rawRow["codigo_confirmacion"]);

      const monto_pagado_input =
        toDecOrNull(rawRow.monto_pagado) ?? toDecOrNull(rawRow["monto_pagado"]);

      const fecha_pago = parseFechaSafe(
        rawRow.fecha_pago || rawRow["fecha_pago"],
      );

      const concepto =
        toNull(rawRow.concepto) ||
        toNull(rawRow["concepto"]) ||
        toNull(defaultConcepto);

      const url_pdf =
        toNull(rawRow.url_pdf) ||
        toNull(rawRow["url_pdf"]) ||
        toNull(defaultUrlPdf);

      if (!id_solicitud_proveedor && !codigo_confirmacion) {
        throw new Error(
          "Debes enviar id_solicitud_proveedor / id_solicitud o codigo_confirmacion",
        );
      }

      if (!url_pdf) {
        throw new Error("El campo url_pdf es obligatorio");
      }

      let solicitudes = [];

      if (id_solicitud_proveedor) {
        solicitudes = await getSolicitudById(id_solicitud_proveedor);

        if (!solicitudes.length) {
          throw new Error(
            `No se encontró la solicitud ${id_solicitud_proveedor}`,
          );
        }
      } else {
        solicitudes =
          await getSolicitudesByCodigoConfirmacion(codigo_confirmacion);

        if (!solicitudes.length) {
          throw new Error(
            `No se encontraron solicitudes para el codigo_confirmacion ${codigo_confirmacion}`,
          );
        }

        if (monto_pagado_input !== null && solicitudes.length > 1) {
          throw new Error(
            `El codigo_confirmacion ${codigo_confirmacion} tiene múltiples solicitudes; no envíes monto_pagado manual para ese caso`,
          );
        }
      }

      const resolvedRows = solicitudes.map((sol) => {
        const monto_solicitado = round2(sol.monto_solicitado || 0);
        const total_pagado = round2(sol.total_pagado || 0);
        const monto_pendiente = round2(monto_solicitado - total_pagado);

        if (monto_pendiente <= 0) {
          throw new Error(
            `La solicitud ${sol.id_solicitud_proveedor} ya no tiene saldo disponible`,
          );
        }

        let monto_final = monto_pagado_input;

        if (monto_final === null) {
          monto_final = monto_pendiente;
        }

        monto_final = round2(monto_final);

        if (monto_final <= 0) {
          throw new Error(
            `El monto_pagado para la solicitud ${sol.id_solicitud_proveedor} debe ser mayor a 0`,
          );
        }

        if (monto_final > monto_pendiente) {
          throw new Error(
            `El monto_pagado (${monto_final}) excede el pendiente (${monto_pendiente}) de la solicitud ${sol.id_solicitud_proveedor}`,
          );
        }

        return {
          id_solicitud_proveedor: sol.id_solicitud_proveedor,
          monto_pagado: monto_final,
          fecha_pago,
          url_pdf,
          concepto,
          monto_solicitado,
          total_pagado,
          monto_pendiente,
          codigo_confirmacion:
            codigo_confirmacion || sol.codigo_confirmacion || null,
          id_booking: sol.id_booking || null,
        };
      });

      return resolvedRows;
    };

    // ==========================
    // MODO INDIVIDUAL
    // ==========================
    if (!isMasivo) {
      const resolvedRows = await resolvePagoRows({
        rawRow: frontendData,
        defaultUrlPdf: frontendData.url_pdf,
        defaultConcepto: frontendData.concepto,
      });

      const inserts = [];

      for (const pagoData of resolvedRows) {
        const result = await insertarPago(pagoData);

        inserts.push({
          id_pago_proveedores: result.insertId,
          id_solicitud_proveedor: pagoData.id_solicitud_proveedor,
          codigo_confirmacion: pagoData.codigo_confirmacion,
          id_booking: pagoData.id_booking,
          monto_pagado: pagoData.monto_pagado,
          fecha_pago: pagoData.fecha_pago,
          url_pdf: pagoData.url_pdf,
          concepto: pagoData.concepto,
          monto: pagoData.monto_pagado,
          total: pagoData.monto_pagado,
          monto_solicitado: pagoData.monto_solicitado,
          total_pagado_previo: pagoData.total_pagado,
          monto_pendiente_previo: pagoData.monto_pendiente,
        });
      }

      return res.status(201).json({
        success: true,
        message:
          inserts.length === 1
            ? "Comprobante de pago creado exitosamente"
            : `Comprobantes de pago creados exitosamente: ${inserts.length}`,
        data: inserts.length === 1 ? inserts[0] : inserts,
      });
    }

    // ==========================
    // MODO MASIVO
    // ==========================
    if (!Array.isArray(csvData) || csvData.length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        details: "csvData debe ser un arreglo con al menos una fila",
      });
    }

    const urlPdfGlobal = toNull(frontendData.url_pdf);

    if (!urlPdfGlobal) {
      return res.status(400).json({
        error: "Bad Request",
        details: "El comprobante global es obligatorio para el modo masivo",
      });
    }

    const resultados = [];
    const errores = [];

    for (let i = 0; i < csvData.length; i++) {
      try {
        const row = csvData[i] || {};

        const resolvedRows = await resolvePagoRows({
          rawRow: row,
          defaultUrlPdf: urlPdfGlobal,
          defaultConcepto: frontendData.concepto,
        });

        for (const pagoData of resolvedRows) {
          try {
            const result = await insertarPago(pagoData);

            resultados.push({
              fila: i + 1,
              success: true,
              id_pago_proveedores: result.insertId,
              id_solicitud_proveedor: pagoData.id_solicitud_proveedor,
              codigo_confirmacion: pagoData.codigo_confirmacion,
              id_booking: pagoData.id_booking,
              monto_pagado: pagoData.monto_pagado,
              fecha_pago: pagoData.fecha_pago,
              url_pdf: pagoData.url_pdf,
              concepto: pagoData.concepto,
              monto: pagoData.monto_pagado,
              total: pagoData.monto_pagado,
              monto_solicitado: pagoData.monto_solicitado,
              total_pagado_previo: pagoData.total_pagado,
              monto_pendiente_previo: pagoData.monto_pendiente,
            });
          } catch (error) {
            errores.push({
              fila: i + 1,
              id_solicitud_proveedor: pagoData.id_solicitud_proveedor,
              codigo_confirmacion: pagoData.codigo_confirmacion,
              error: error.message,
              code: error.code,
            });
          }
        }
      } catch (error) {
        errores.push({
          fila: i + 1,
          error: error.message,
          code: error.code,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `Procesamiento completado: ${resultados.length} registros creados, ${errores.length} errores`,
      summary: {
        total_filas: csvData.length,
        exitosas: resultados.length,
        errores: errores.length,
      },
      resultados,
      errores: errores.length ? errores : undefined,
    });
  } catch (error) {
    console.error("❌ Error al crear comprobante de pago:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "Conflict",
        details: "Ya existe un registro con esos datos",
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

// const getSolicitudes = async (req, res) => {
//   try {
//     // ---------------- helpers ----------------
//     const norm = (v) =>
//       String(v ?? "")
//         .trim()
//         .toLowerCase();
//     const num = (v) => {
//       const n = Number(v);
//       return Number.isFinite(n) ? n : 0;
//     };

//     const safeJsonParse = (v) => {
//       if (v == null) return null;
//       if (Array.isArray(v) || typeof v === "object") return v;
//       if (typeof v !== "string") return null;
//       const s = v.trim();
//       if (!s) return null;
//       if (!(s.startsWith("{") || s.startsWith("["))) return null;
//       try {
//         return JSON.parse(s);
//       } catch {
//         return null;
//       }
//     };

//     const toArray = (v) => {
//       const parsed = safeJsonParse(v);
//       if (Array.isArray(parsed)) return parsed;
//       if (parsed && typeof parsed === "object") return [parsed];
//       return [];
//     };

//     const flattenPagosArr = (v) => {
//       // soporta: array, string JSON, mezcla
//       const arr = Array.isArray(v) ? v : toArray(v);
//       const lvl1 = arr.flatMap((x) => (Array.isArray(x) ? x : [x]));
//       const lvl2 = lvl1.flatMap((x) => (Array.isArray(x) ? x : [x]));
//       return lvl2.filter(Boolean);
//     };

//     const getPagoStats = (pagos) => {
//       const p = flattenPagosArr(pagos);
//       let solicitado = 0;
//       let pagado = 0;
//       let conFecha = 0;

//       for (const x of p) {
//         solicitado += num(x?.monto_solicitado ?? 0);
//         pagado += num(x?.monto_pagado ?? 0);
//         if (x?.fecha_pago) conFecha += 1;
//       }

//       const anyPagadoEstado =
//         p.some(
//           (x) =>
//             norm(x?.pago_estado_pago) === "pagado" ||
//             norm(x?.estado_pago) === "pagado",
//         ) || false;

//       return {
//         count: p.length,
//         solicitado,
//         pagado,
//         conFecha,
//         anyPagadoEstado,
//       };
//     };

//     // Facturación en tu SP: no diste esquema fijo.
//     // Intentamos detectar en `rest` varios nombres típicos.
//     const getFacturaNums = (row) => {
//       const solicitado = num(row?.monto_solicitado);
//       const fact = num(
//         row?.monto_facturado ??
//           row?.total_facturado ??
//           row?.total_facturado_en_pfp ??
//           row?.facturado ??
//           row?.monto_facturas ??
//           0,
//       );

//       // si existe un "por_facturar" explícito, úsalo; si no, calcula.
//       const porFacturarRaw =
//         row?.monto_por_facturar ?? row?.por_facturar ?? row?.saldo_por_facturar;
//       const porFacturar =
//         porFacturarRaw != null
//           ? num(porFacturarRaw)
//           : Math.max(0, +(solicitado - fact).toFixed(2));

//       return { solicitado, facturado: fact, porFacturar };
//     };

//     const isSinPagosAsociados = (pagosArray) => {
//       const p = flattenPagosArr(pagosArray);
//       return p.length === 0;
//     };

//     // ---------------- inputs ----------------
//     const debug = Number(req.query.debug ?? 0) === 1;

//     // ---------------- fetch SPs ----------------
//     const spRows = await executeSP(
//       STORED_PROCEDURE.GET.SOLICITUD_PAGO_PROVEEDOR,
//     );

//     const ids = spRows
//       .map((r) => r.id_solicitud_proveedor)
//       .filter((id) => id !== null && id !== undefined);

//     let pagosRaw = [];
//     if (ids.length > 0) {
//       // NOTE: hoy traes todos los pagos del SP, no filtras por ids.
//       // Está OK para funcionalidad, pero puede pegar en performance.
//       pagosRaw = await executeSP(STORED_PROCEDURE.GET.OBTENR_PAGOS_PROVEEDOR);
//     }

//     // ---------------- index pagos by solicitud ----------------
//     const pagosBySolicitud = pagosRaw.reduce((acc, row) => {
//       const key = String(row.id_solicitud_proveedor);

//       // en tu código original: push(row.dispersiones_json, row.pagos_json)
//       // aquí: parsea y flatten para que el front tenga un array usable
//       const dispersiones = toArray(row.dispersiones_json);
//       const pagos = toArray(row.pagos_json);

//       (acc[key] ||= []).push(...dispersiones, ...pagos);
//       return acc;
//     }, {});

//     // ---------------- normalize rows ----------------
//     const data = spRows.map((r) => {
//       // destructuring con tus campos + rest
//       const {
//         id_solicitud_proveedor,
//         fecha_solicitud,
//         monto_solicitado,
//         saldo,
//         forma_pago_solicitada,
//         id_tarjeta_solicitada,
//         usuario_solicitante,
//         usuario_generador,
//         comentarios,
//         estado_solicitud,
//         estado_facturacion,
//         ultimos_4,
//         banco_emisor,
//         tipo_tarjeta,
//         rfc,
//         razon_social,
//         estatus_pagos,
//         ...rest
//       } = r;

//       const pagos = pagosBySolicitud[String(id_solicitud_proveedor)] ?? [];
//       const forma = norm(forma_pago_solicitada);

//       const pagoStats = getPagoStats(pagos);

//       const saldoNum = num(saldo);
//       const estaPagada =
//         norm(estatus_pagos) === "pagado" ||
//         saldoNum === 0 ||
//         pagoStats.anyPagadoEstado ||
//         pagoStats.pagado >= num(monto_solicitado);

//       // Facturas (si vienen dentro de rest en tu SP)
//       const factNums = getFacturaNums({ ...r, ...rest });

//       // devolvemos el shape que tu front ya espera + extras para que “muestres todo”
//       return {
//         ...rest,

//         estatus_pagos,
//         // NOTA: ya no calculamos filtro_pago en back como antes para no perder registros.
//         // Lo vamos a calcular al agrupar, pero dejamos forma/saldo aquí accesibles.
//         solicitud_proveedor: {
//           id_solicitud_proveedor,
//           fecha_solicitud,
//           monto_solicitado,
//           saldo,
//           forma_pago_solicitada,
//           id_tarjeta_solicitada,
//           usuario_solicitante,
//           usuario_generador,
//           comentarios,
//           estado_solicitud,
//           estado_facturacion,
//         },
//         tarjeta: { ultimos_4, banco_emisor, tipo_tarjeta },
//         proveedor: { rfc, razon_social },
//         pagos,

//         __computed: {
//           forma,
//           estaPagada,
//           pagos_count: pagoStats.count,
//           pagos_total_pagado: pagoStats.pagado,
//           pagos_total_solicitado_sum: pagoStats.solicitado,
//           facturado: factNums.facturado,
//           por_facturar: factNums.porFacturar,
//           solicitado: factNums.solicitado,
//         },
//       };
//     });

//     // ---------------- buckets para front ----------------
//     // reglas que pediste (front), pero aquí ya te lo acomodamos en el back
//     const todos = data;

//     const spei_solicitado = data.filter((d) => {
//       const forma = d.__computed?.forma;
//       return forma === "transfer" && isSinPagosAsociados(d.pagos);
//     });

//     const pago_tdc = data.filter((d) => {
//       const forma = d.__computed?.forma;
//       return forma === "card" && isSinPagosAsociados(d.pagos);
//     });

//     const pago_link = data.filter((d) => {
//       const forma = d.__computed?.forma;
//       return forma === "link" && isSinPagosAsociados(d.pagos);
//     });

//     // Carta enviada: credit y (sin facturar / parcial / por facturar == solicitado)
//     const carta_enviada = data.filter((d) => {
//       const forma = d.__computed?.forma;
//       if (forma !== "credit") return false;

//       const solicitado = num(d.__computed?.solicitado);
//       const facturado = num(d.__computed?.facturado);
//       const porFacturar = num(d.__computed?.por_facturar);

//       // condiciones que diste (equivalentes en práctica)
//       const sinFacturar = facturado <= 0;
//       const parcial = facturado > 0 && facturado < solicitado;
//       const porFacturarIgualSolicitado = porFacturar === solicitado;

//       return sinFacturar || parcial || porFacturarIgualSolicitado;
//     });

//     // Carta garantía: credit y (facturado == solicitado) y (por facturar == 0)
//     const carta_garantia = data.filter((d) => {
//       const forma = d.__computed?.forma;
//       if (forma !== "credit") return false;

//       const solicitado = num(d.__computed?.solicitado);
//       const facturado = num(d.__computed?.facturado);
//       const porFacturar = num(d.__computed?.por_facturar);

//       return facturado === solicitado && porFacturar === 0;
//     });

//     // Pagada (carpeta): marcadas como pagadas por regla de negocio
//     // Nota: puedes ajustar si “pagada” solo aplica a transfer, etc.
//     const pagada = data.filter((d) => !!d.__computed?.estaPagada);

//     // Histórico vacío por ahora (como pediste)
//     const historico = [];

//     // Otros: lo que no cayó en ninguna categoría (para no “perder” registros)
//     const inAny = new Set();
//     const addIds = (arr) => {
//       for (const x of arr) {
//         const id = x?.solicitud_proveedor?.id_solicitud_proveedor;
//         if (id != null) inAny.add(String(id));
//       }
//     };
//     addIds(spei_solicitado);
//     addIds(pago_tdc);
//     addIds(pago_link);
//     addIds(carta_enviada);
//     addIds(carta_garantia);
//     addIds(pagada);

//     const otros = data.filter((d) => {
//       const id = d?.solicitud_proveedor?.id_solicitud_proveedor;
//       if (id == null) return true;
//       return !inAny.has(String(id));
//     });

//     // ---------------- debug meta ----------------
//     const responseData = {
//       todos,
//       spei_solicitado,
//       pago_tdc,
//       pago_link,
//       carta_enviada,
//       carta_garantia,
//       pagada,
//       historico,
//       otros,
//     };

//     if (debug) {
//       const byForma = data.reduce((acc, d) => {
//         const f = d.__computed?.forma || "(vacio)";
//         acc[f] = (acc[f] || 0) + 1;
//         return acc;
//       }, {});

//       const counts = {
//         spRows_len: spRows.length,
//         mapped_len: data.length,
//         pagosRaw_len: pagosRaw.length,
//         ids_null: spRows.filter((x) => x.id_solicitud_proveedor == null).length,
//       };

//       const buckets = {
//         todos: todos.length,
//         spei_solicitado: spei_solicitado.length,
//         pago_tdc: pago_tdc.length,
//         pago_link: pago_link.length,
//         carta_enviada: carta_enviada.length,
//         carta_garantia: carta_garantia.length,
//         pagada: pagada.length,
//         historico: historico.length,
//         otros: otros.length,
//       };

//       responseData.meta = {
//         counts,
//         byForma,
//         buckets,
//         ejemplo_otros: otros.slice(0, 15).map((d) => ({
//           id: d?.solicitud_proveedor?.id_solicitud_proveedor,
//           forma: d?.solicitud_proveedor?.forma_pago_solicitada,
//           saldo: d?.solicitud_proveedor?.saldo,
//           estatus_pagos: d?.estatus_pagos,
//           pagos_count: d.__computed?.pagos_count,
//           facturado: d.__computed?.facturado,
//           por_facturar: d.__computed?.por_facturar,
//           solicitado: d.__computed?.solicitado,
//         })),
//       };
//     }

//     // ---------------- response ----------------
//     res.set({
//       "Cache-Control": "no-store",
//       Pragma: "no-cache",
//       Expires: "0",
//     });

//     return res.status(200).json({
//       message: "Registros obtenidos con exito",
//       ok: true,
//       data: responseData,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       ok: false,
//       error: "Internal Server Error",
//       details: error?.message || error,
//     });
//   }
// };

// controller/getSolicitudes.js

// const getSolicitudes = async (req, res) => {
//   try {
//     // ---------------- helpers ----------------
//     const norm = (v) =>
//       String(v ?? "")
//         .trim()
//         .toLowerCase();

//     const num = (v) => {
//       const n = Number(v);
//       return Number.isFinite(n) ? n : 0;
//     };

//     const safeJsonParse = (v) => {
//       if (v == null) return null;
//       if (Array.isArray(v) || typeof v === "object") return v;
//       if (typeof v !== "string") return null;
//       const s = v.trim();
//       if (!s) return null;
//       if (!(s.startsWith("{") || s.startsWith("["))) return null;

//       try {
//         return JSON.parse(s);
//       } catch {
//         return null;
//       }
//     };

//     const toArray = (v) => {
//       const parsed = safeJsonParse(v);
//       if (Array.isArray(parsed)) return parsed;
//       if (parsed && typeof parsed === "object") return [parsed];
//       return [];
//     };

//     const flattenPagosArr = (v) => {
//       const arr = Array.isArray(v) ? v : toArray(v);
//       const lvl1 = arr.flatMap((x) => (Array.isArray(x) ? x : [x]));
//       const lvl2 = lvl1.flatMap((x) => (Array.isArray(x) ? x : [x]));
//       return lvl2.filter(Boolean);
//     };

//     const getPagoStats = (pagos) => {
//       const p = flattenPagosArr(pagos);

//       let solicitado = 0;
//       let pagado = 0;
//       let conFecha = 0;

//       for (const x of p) {
//         solicitado += num(x?.monto_solicitado ?? 0);
//         pagado += num(x?.monto_pagado ?? 0);
//         if (x?.fecha_pago) conFecha += 1;
//       }

//       const anyPagadoEstado =
//         p.some(
//           (x) =>
//             norm(x?.pago_estado_pago) === "pagado" ||
//             norm(x?.estado_pago) === "pagado"
//         ) || false;

//       return {
//         count: p.length,
//         solicitado,
//         pagado,
//         conFecha,
//         anyPagadoEstado,
//       };
//     };

//     const getFacturaNums = (row) => {
//       const solicitado = num(row?.monto_solicitado);

//       const fact = num(
//         row?.monto_facturado ??
//           row?.total_facturado ??
//           row?.total_facturado_en_pfp ??
//           row?.facturado ??
//           row?.monto_facturas ??
//           0
//       );

//       const porFacturarRaw =
//         row?.monto_por_facturar ??
//         row?.por_facturar ??
//         row?.saldo_por_facturar;

//       const porFacturar =
//         porFacturarRaw != null
//           ? num(porFacturarRaw)
//           : Math.max(0, +(solicitado - fact).toFixed(2));

//       return { solicitado, facturado: fact, porFacturar };
//     };

//     const sortByHospedajeReciente = (arr) => {
//       const toTime = (v) => {
//         const t = new Date(v ?? "").getTime();
//         return Number.isFinite(t) ? t : 0;
//       };

//       return [...arr].sort((a, b) => {
//         const ah = a?.id_hospedaje == null ? null : Number(a.id_hospedaje);
//         const bh = b?.id_hospedaje == null ? null : Number(b.id_hospedaje);

//         if (ah == null && bh == null) {
//           const abu = toTime(a?.booking_updated_at);
//           const bbu = toTime(b?.booking_updated_at);
//           if (bbu !== abu) return bbu - abu;

//           const af = toTime(
//             a?.solicitud_proveedor?.fecha_solicitud ?? a?.fecha_solicitud
//           );
//           const bf = toTime(
//             b?.solicitud_proveedor?.fecha_solicitud ?? b?.fecha_solicitud
//           );
//           return bf - af;
//         }

//         if (ah == null) return 1;
//         if (bh == null) return -1;

//         if (bh !== ah) return bh - ah;

//         const abu = toTime(a?.booking_updated_at);
//         const bbu = toTime(b?.booking_updated_at);
//         return bbu - abu;
//       });
//     };

//     // ---------------- inputs ----------------
//     const debug = Number(req.query.debug ?? 0) === 1;

//     // ---------------- fetch SPs ----------------
//     const spRows = await executeSP(
//       STORED_PROCEDURE.GET.SOLICITUD_PAGO_PROVEEDOR
//     );

//     const ids = (spRows || [])
//       .map((r) => r.id_solicitud_proveedor)
//       .filter((id) => id !== null && id !== undefined);

//     let pagosRaw = [];
//     if (ids.length > 0) {
//       pagosRaw = await executeSP(STORED_PROCEDURE.GET.OBTENR_PAGOS_PROVEEDOR);
//     }

//     // ---------------- index pagos by solicitud ----------------
//     const pagosBySolicitud = (pagosRaw || []).reduce((acc, row) => {
//       const key = String(row.id_solicitud_proveedor);

//       const dispersiones = toArray(row.dispersiones_json);
//       const pagos = toArray(row.pagos_json);

//       (acc[key] ||= []).push(...dispersiones, ...pagos);
//       return acc;
//     }, {});

//     // ---------------- normalize rows ----------------
//     const data = (spRows || []).map((r) => {
//       const {
//         id_solicitud_proveedor,
//         fecha_solicitud,
//         monto_solicitado,
//         saldo,
//         forma_pago_solicitada,
//         id_tarjeta_solicitada,
//         usuario_solicitante,
//         usuario_generador,
//         comentarios,
//         estado_solicitud,
//         estado_facturacion,
//         ultimos_4,
//         banco_emisor,
//         tipo_tarjeta,
//         rfc,
//         razon_social,
//         estatus_pagos,
//         is_ajuste,
//         comentario_ajuste,
//         ...rest
//       } = r;

//       const pagos = pagosBySolicitud[String(id_solicitud_proveedor)] ?? [];
//       const forma = norm(forma_pago_solicitada);

//       const pagoStats = getPagoStats(pagos);
//       const saldoNum = num(saldo);

//       const estaPagada =
//         norm(estatus_pagos) === "pagado" ||
//         saldoNum === 0 ||
//         pagoStats.anyPagadoEstado ||
//         pagoStats.pagado >= num(monto_solicitado);

//       const factNums = getFacturaNums({ ...r, ...rest });

//       return {
//         ...rest,

//         estatus_pagos,

//         solicitud_proveedor: {
//           id_solicitud_proveedor,
//           fecha_solicitud,
//           monto_solicitado,
//           saldo,
//           forma_pago_solicitada,
//           id_tarjeta_solicitada,
//           usuario_solicitante,
//           usuario_generador,
//           comentarios,
//           estado_solicitud,
//           estado_facturacion,
//           is_ajuste,
//           comentario_ajuste,
//         },

//         tarjeta: { ultimos_4, banco_emisor, tipo_tarjeta },
//         proveedor: { rfc, razon_social },

//         pagos,

//         __computed: {
//           forma,
//           estado_solicitud_norm: norm(estado_solicitud),
//           estaPagada,
//           pagos_count: pagoStats.count,
//           pagos_total_pagado: pagoStats.pagado,
//           pagos_total_solicitado_sum: pagoStats.solicitado,
//           facturado: factNums.facturado,
//           por_facturar: factNums.porFacturar,
//           solicitado: factNums.solicitado,
//         },
//       };
//     });

//     // ---------------- reglas de clasificación ----------------
//     const comentarioEsPagoSolicitado = (d) => {
//       const comentario = norm(d?.solicitud_proveedor?.comentario_ajuste ?? "");

//       // soporta ambos formatos:
//       // pago solicitado
//       // 'pago solicitado'
//       return (
//         comentario === "pago solicitado" ||
//         comentario === "'pago solicitado'"
//       );
//     };

//     const esAjuste = (d) => num(d?.solicitud_proveedor?.is_ajuste) === 1;

//     const esCartaEnviada = (d) => {
//       const estado = norm(d?.solicitud_proveedor?.estado_solicitud);

//       return (
//         estado === "cupon enviado" &&
//         !esAjuste(d) &&
//         !comentarioEsPagoSolicitado(d)
//       );
//     };

//     const esCartaGarantia = (d) => {
//       const estado = norm(d?.solicitud_proveedor?.estado_solicitud);

//       return (
//         estado === "cupon enviado" &&
//         esAjuste(d) &&
//         comentarioEsPagoSolicitado(d)
//       );
//     };

//     // ---------------- buckets ----------------
//     const pago_tdc = sortByHospedajeReciente(
//       data.filter(
//         (d) => norm(d?.solicitud_proveedor?.estado_solicitud) === "carta_enviada"
//       )
//     );

//     const spei_solicitado = sortByHospedajeReciente(
//       data.filter((d) => {
//         const estado = norm(d?.solicitud_proveedor?.estado_solicitud);
//         return (
//           estado === "transferencia_solicitada" || estado === "dispersion"
//         );
//       })
//     );

//     const pago_link = sortByHospedajeReciente(
//       data.filter(
//         (d) => norm(d?.solicitud_proveedor?.estado_solicitud) === "pagado link"
//       )
//     );

//     const canceladas = sortByHospedajeReciente(
//       data.filter(
//         (d) => norm(d?.solicitud_proveedor?.estado_solicitud) === "CANCELADA"
//       ),
//       console.log(data,"✅✅✅✅✅✅")
//     );

//     const carta_enviada = sortByHospedajeReciente(
//       data.filter((d) => esCartaEnviada(d))
//     );

//     const carta_garantia = sortByHospedajeReciente(
//       data.filter((d) => esCartaGarantia(d))
//     );

//     const pagada = sortByHospedajeReciente(
//       data.filter((d) => {
//         const estado = norm(d?.solicitud_proveedor?.estado_solicitud);
//         return (
//           estado === "pagado tarjeta" ||
//           estado === "pagado transferencia"
//         );
//       })
//     );

//     const responseData = {
//       spei_solicitado,
//       pago_tdc,
//       pago_link,
//       carta_enviada,
//       carta_garantia,
//       pagada,
//       canceladas,
//     };

//     // ---------------- debug meta ----------------
//     if (debug) {
//       const byEstado = data.reduce((acc, d) => {
//         const e = norm(d?.solicitud_proveedor?.estado_solicitud) || "(vacio)";
//         acc[e] = (acc[e] || 0) + 1;
//         return acc;
//       }, {});

//       const counts = {
//         spRows_len: spRows.length,
//         mapped_len: data.length,
//         pagosRaw_len: pagosRaw.length,
//         ids_null: spRows.filter((x) => x.id_solicitud_proveedor == null).length,
//       };

//       const buckets = {
//         spei_solicitado: spei_solicitado.length,
//         pago_tdc: pago_tdc.length,
//         pago_link: pago_link.length,
//         carta_enviada: carta_enviada.length,
//         carta_garantia: carta_garantia.length,
//         pagada: pagada.length,
//         canceladas: canceladas.length,
//       };

//       responseData.meta = {
//         counts,
//         byEstado,
//         buckets,
//         ejemplos: {
//           carta_enviada: carta_enviada.slice(0, 10).map((d) => ({
//             id: d?.solicitud_proveedor?.id_solicitud_proveedor,
//             estado_solicitud: d?.solicitud_proveedor?.estado_solicitud,
//             is_ajuste: d?.solicitud_proveedor?.is_ajuste,
//             comentario_ajuste: d?.solicitud_proveedor?.comentario_ajuste,
//             id_hospedaje: d?.id_hospedaje ?? null,
//           })),
//           carta_garantia: carta_garantia.slice(0, 10).map((d) => ({
//             id: d?.solicitud_proveedor?.id_solicitud_proveedor,
//             estado_solicitud: d?.solicitud_proveedor?.estado_solicitud,
//             is_ajuste: d?.solicitud_proveedor?.is_ajuste,
//             comentario_ajuste: d?.solicitud_proveedor?.comentario_ajuste,
//             id_hospedaje: d?.id_hospedaje ?? null,
//           })),
//         },
//       };
//     }

//     // ---------------- response ----------------
//     res.set({
//       "Cache-Control": "no-store",
//       Pragma: "no-cache",
//       Expires: "0",
//     });

//     return res.status(200).json({
//       message: "Registros obtenidos con exito",
//       ok: true,
//       data: responseData,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       ok: false,
//       error: "Internal Server Error",
//       details: error?.message || error,
//     });
//   }
// };

const getSolicitudes = async (req, res) => {
  try {
    // ---------------- helpers ----------------
    const norm = (v) =>
      String(v ?? "")
        .trim()
        .toLowerCase();

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
        p.some(
          (x) =>
            norm(x?.pago_estado_pago) === "pagado" ||
            norm(x?.estado_pago) === "pagado",
        ) || false;

      return {
        count: p.length,
        solicitado,
        pagado,
        conFecha,
        anyPagadoEstado,
      };
    };

    const getFacturaNums = (row) => {
      const solicitado = num(row?.monto_solicitado);

      const fact = num(
        row?.monto_facturado ??
          row?.total_facturado ??
          row?.total_facturado_en_pfp ??
          row?.facturado ??
          row?.monto_facturas ??
          0,
      );

      const porFacturarRaw =
        row?.monto_por_facturar ?? row?.por_facturar ?? row?.saldo_por_facturar;

      const porFacturar =
        porFacturarRaw != null
          ? num(porFacturarRaw)
          : Math.max(0, +(solicitado - fact).toFixed(2));

      return { solicitado, facturado: fact, porFacturar };
    };

    const sortByHospedajeReciente = (arr) => {
      const toTime = (v) => {
        const t = new Date(v ?? "").getTime();
        return Number.isFinite(t) ? t : 0;
      };

      return [...arr].sort((a, b) => {
        const ah = a?.id_hospedaje == null ? null : Number(a.id_hospedaje);
        const bh = b?.id_hospedaje == null ? null : Number(b.id_hospedaje);

        if (ah == null && bh == null) {
          const abu = toTime(a?.booking_updated_at);
          const bbu = toTime(b?.booking_updated_at);
          if (bbu !== abu) return bbu - abu;

          const af = toTime(
            a?.solicitud_proveedor?.fecha_solicitud ?? a?.fecha_solicitud,
          );
          const bf = toTime(
            b?.solicitud_proveedor?.fecha_solicitud ?? b?.fecha_solicitud,
          );
          return bf - af;
        }

        if (ah == null) return 1;
        if (bh == null) return -1;

        if (bh !== ah) return bh - ah;

        const abu = toTime(a?.booking_updated_at);
        const bbu = toTime(b?.booking_updated_at);
        return bbu - abu;
      });
    };

    // ---------------- inputs ----------------
    const debug = Number(req.query.debug ?? 0) === 1;

    // ---------------- fetch SPs ----------------
    const spRows = await executeSP(
      STORED_PROCEDURE.GET.SOLICITUD_PAGO_PROVEEDOR,
    );

    const ids = (spRows || [])
      .map((r) => r.id_solicitud_proveedor)
      .filter((id) => id !== null && id !== undefined);

    let pagosRaw = [];
    if (ids.length > 0) {
      pagosRaw = await executeSP(STORED_PROCEDURE.GET.OBTENR_PAGOS_PROVEEDOR);
    }

    // ---------------- index pagos by solicitud ----------------
    const detalleBySolicitud = (pagosRaw || []).reduce((acc, row) => {
      const key = String(row.id_solicitud_proveedor);

      const dispersiones = toArray(row.dispersiones_json);
      const pagos = toArray(row.pagos_json);
      const facturas = toArray(row.facturas_json);

      if (!acc[key]) {
        acc[key] = {
          dispersiones: [],
          pagos: [],
          facturas: [],
        };
      }

      acc[key].dispersiones.push(...dispersiones);
      acc[key].pagos.push(...pagos);
      acc[key].facturas.push(...facturas);

      return acc;
    }, {});

    // ---------------- normalize rows ----------------
    const data = (spRows || []).map((r) => {
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
        is_ajuste,
        comentario_ajuste,
        ...rest
      } = r;

      const detalleSolicitud = detalleBySolicitud[
        String(id_solicitud_proveedor)
      ] ?? {
        dispersiones: [],
        pagos: [],
        facturas: [],
      };

      const dispersiones = detalleSolicitud.dispersiones;
      const pagosProveedor = detalleSolicitud.pagos;
      const facturas = detalleSolicitud.facturas;

      // si quieres seguir usando el mismo cálculo actual:
      const pagos = [...dispersiones, ...pagosProveedor];

      const forma = norm(forma_pago_solicitada);

      const pagoStats = getPagoStats(pagos);
      const saldoNum = num(saldo);
      const factNums = getFacturaNums({ ...r, ...rest });

      const estaPagada =
        norm(estatus_pagos) === "pagado" ||
        saldoNum === 0 ||
        pagoStats.anyPagadoEstado ||
        pagoStats.pagado >= num(monto_solicitado);

      return {
        ...rest,

        estatus_pagos,

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
          is_ajuste,
          comentario_ajuste,
        },

        tarjeta: { ultimos_4, banco_emisor, tipo_tarjeta },
        proveedor: { rfc, razon_social },

        // para no romper lo que ya usa el front
        pagos,

        // nuevos campos separados y claros
        dispersiones,
        pagos_proveedor: pagosProveedor,
        facturas,

        // si quieres mandarlo casi tal cual viene del SP
        sp_obtener_pagos_proveedor: {
          dispersiones_json: dispersiones,
          pagos_json: pagosProveedor,
          facturas_json: facturas,
        },

        __computed: {
          forma,
          estado_solicitud_norm: norm(estado_solicitud),
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

    // ---------------- reglas de clasificación ----------------
    const comentarioEsPagoSolicitado = (d) => {
      const comentario = norm(d?.solicitud_proveedor?.comentario_ajuste ?? "");
      return (
        comentario === "pago solicitado" || comentario === "'pago solicitado'"
      );
    };

    const esAjuste = (d) => num(d?.solicitud_proveedor?.is_ajuste) === 1;

    const esCartaEnviada = (d) => {
      const estado = norm(d?.solicitud_proveedor?.estado_solicitud);
      return (
        estado === "cupon enviado" &&
        !esAjuste(d) &&
        !comentarioEsPagoSolicitado(d)
      );
    };

    const esCartaGarantia = (d) => {
      const estado = norm(d?.solicitud_proveedor?.estado_solicitud);

      if (estado === "solicitada") return true;

      return (
        estado === "cupon enviado" &&
        esAjuste(d) &&
        comentarioEsPagoSolicitado(d)
      );
    };

    const esNotificado = (d) => {
      const estado = norm(d?.solicitud_proveedor?.estado_solicitud);
      return estado === "dispersion" && esAjuste(d);
    };

    // ---------------- buckets ----------------
    const pago_tdc = sortByHospedajeReciente(
      data.filter(
        (d) =>
          norm(d?.solicitud_proveedor?.estado_solicitud) === "carta_enviada",
      ),
    );

    const notificados = sortByHospedajeReciente(
      data.filter((d) => esNotificado(d)),
    );

    const spei_solicitado = sortByHospedajeReciente(
      data.filter((d) => {
        const estado = norm(d?.solicitud_proveedor?.estado_solicitud);

        return (
          estado === "transferencia_solicitada" ||
          (estado === "dispersion" && !esAjuste(d))
        );
      }),
    );

    const pago_link = sortByHospedajeReciente(
      data.filter(
        (d) => norm(d?.solicitud_proveedor?.estado_solicitud) === "pagado link",
      ),
    );

    const canceladas = sortByHospedajeReciente(
      data.filter(
        (d) => norm(d?.solicitud_proveedor?.estado_solicitud) === "cancelada",
      ),
    );

    const carta_enviada = sortByHospedajeReciente(
      data.filter((d) => esCartaEnviada(d)),
    );

    const carta_garantia = sortByHospedajeReciente(
      data.filter((d) => esCartaGarantia(d)),
    );

    const pagada = sortByHospedajeReciente(
      data.filter((d) => {
        const estado = norm(d?.solicitud_proveedor?.estado_solicitud);
        return estado === "pagado tarjeta" || estado === "pagado transferencia";
      }),
    );

    const responseData = {
      spei_solicitado,
      notificados,
      pago_tdc,
      pago_link,
      carta_enviada,
      carta_garantia,
      pagada,
      canceladas,
    };

    // ---------------- debug meta ----------------
    if (debug) {
      const byEstado = data.reduce((acc, d) => {
        const e = norm(d?.solicitud_proveedor?.estado_solicitud) || "(vacio)";
        acc[e] = (acc[e] || 0) + 1;
        return acc;
      }, {});

      const counts = {
        spRows_len: spRows.length,
        mapped_len: data.length,
        pagosRaw_len: pagosRaw.length,
        ids_null: spRows.filter((x) => x.id_solicitud_proveedor == null).length,
      };

      const buckets = {
        spei_solicitado: spei_solicitado.length,
        notificados: notificados.length,
        pago_tdc: pago_tdc.length,
        pago_link: pago_link.length,
        carta_enviada: carta_enviada.length,
        carta_garantia: carta_garantia.length,
        pagada: pagada.length,
        canceladas: canceladas.length,
      };

      responseData.meta = {
        counts,
        byEstado,
        buckets,
        ejemplos: {
          notificados: notificados.slice(0, 10).map((d) => ({
            id: d?.solicitud_proveedor?.id_solicitud_proveedor,
            estado_solicitud: d?.solicitud_proveedor?.estado_solicitud,
            is_ajuste: d?.solicitud_proveedor?.is_ajuste,
            comentario_ajuste: d?.solicitud_proveedor?.comentario_ajuste,
            id_hospedaje: d?.id_hospedaje ?? null,
          })),
          carta_enviada: carta_enviada.slice(0, 10).map((d) => ({
            id: d?.solicitud_proveedor?.id_solicitud_proveedor,
            estado_solicitud: d?.solicitud_proveedor?.estado_solicitud,
            is_ajuste: d?.solicitud_proveedor?.is_ajuste,
            comentario_ajuste: d?.solicitud_proveedor?.comentario_ajuste,
            id_hospedaje: d?.id_hospedaje ?? null,
          })),
          carta_garantia: carta_garantia.slice(0, 10).map((d) => ({
            id: d?.solicitud_proveedor?.id_solicitud_proveedor,
            estado_solicitud: d?.solicitud_proveedor?.estado_solicitud,
            is_ajuste: d?.solicitud_proveedor?.is_ajuste,
            comentario_ajuste: d?.solicitud_proveedor?.comentario_ajuste,
            id_hospedaje: d?.id_hospedaje ?? null,
          })),
        },
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

const getSolicitudes2 = async (req, res) => {
  try {
    const norm = (v) =>
      String(v ?? "")
        .trim()
        .toLowerCase();

    const clean = (v) => {
      const raw = String(v ?? "");
      if (!raw.trim()) return null;

      try {
        const decoded = decodeURIComponent(raw.replace(/\+/g, " "));
        const s = decoded.trim();
        return s === "" ? null : s;
      } catch {
        const s = raw.replace(/\+/g, " ").trim();
        return s === "" ? null : s;
      }
    };

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const toDateStart = (v) => {
      const s = clean(v);
      return s ? `${s} 00:00:00` : null;
    };

    const toDateEnd = (v) => {
      const s = clean(v);
      return s ? `${s} 23:59:59` : null;
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
        p.some(
          (x) =>
            norm(x?.pago_estado_pago) === "pagado" ||
            norm(x?.estado_pago) === "pagado",
        ) || false;

      return {
        count: p.length,
        solicitado,
        pagado,
        conFecha,
        anyPagadoEstado,
      };
    };

    const getFacturaNums = (row) => {
      const solicitado = num(row?.monto_solicitado);

      const facturado = num(
        row?.monto_facturado ??
          row?.total_facturado ??
          row?.total_facturado_en_pfp ??
          row?.facturado ??
          row?.monto_facturas ??
          0,
      );

      const porFacturarRaw =
        row?.monto_por_facturar ?? row?.por_facturar ?? row?.saldo_por_facturar;

      const porFacturar =
        porFacturarRaw != null
          ? num(porFacturarRaw)
          : Math.max(0, +(solicitado - facturado).toFixed(2));

      return { solicitado, facturado, porFacturar };
    };

    const debug = Number(req.query.debug ?? 0) === 1;

    const allowedFechaReserva = new Set([
      "created_at",
      "check_in",
      "check_out",
    ]);
    const rawFiltrarFechaPorReserva = clean(
      req.query.filtrar_fecha_por_reserva,
    );
    const filtrarFechaPorReserva =
      rawFiltrarFechaPorReserva &&
      allowedFechaReserva.has(String(rawFiltrarFechaPorReserva).toLowerCase())
        ? String(rawFiltrarFechaPorReserva).toLowerCase()
        : null;

    console.log(clean(req.query.comentarios), "🤬🤬🤬🤬");

    const filters = {
      folio: clean(req.query.folio),
      cliente: clean(req.query.cliente),
      viajero: clean(req.query.viajero),
      hotel: clean(req.query.hotel),
      estado_solicitud: clean(req.query.estado_solicitud),
      estado_facturacion: clean(req.query.estado_facturacion),
      forma_pago: clean(req.query.forma_pago),

      created_start: toDateStart(req.query.created_start),
      created_end: toDateEnd(req.query.created_end),
      check_in_start: clean(req.query.check_in_start),
      check_in_end: clean(req.query.check_in_end),
      check_out_start: clean(req.query.check_out_start),
      check_out_end: clean(req.query.check_out_end),

      id_cliente: clean(req.query.id_cliente),
      estado_reserva: clean(req.query.estado_reserva),
      etapa_reservacion: clean(req.query.etapa_reservacion),
      reservante: clean(req.query.reservante),
      metodo_pago_reserva: clean(req.query.metodo_pago_reserva),

      fecha_reserva_start: toDateStart(req.query.fecha_reserva_start),
      fecha_reserva_end: toDateEnd(req.query.fecha_reserva_end),
      filtrar_fecha_por_reserva: filtrarFechaPorReserva,

      comentarios: clean(req.query.comentarios),
      comentario_CXP: clean(req.query.comentario_CXP),
    };

    const spRows = await executeSP(
      STORED_PROCEDURE.GET.SOLICITUD_PAGO_PROVEEDOR_FILTRADAS,
      [
        filters.folio,
        filters.cliente,
        filters.viajero,
        filters.hotel,
        filters.estado_solicitud,
        filters.estado_facturacion,
        filters.forma_pago,
        filters.created_start,
        filters.created_end,
        filters.check_in_start,
        filters.check_in_end,
        filters.check_out_start,
        filters.check_out_end,

        filters.id_cliente,
        filters.estado_reserva,
        filters.etapa_reservacion,
        filters.reservante,
        filters.metodo_pago_reserva,
        filters.fecha_reserva_start,
        filters.fecha_reserva_end,
        filters.filtrar_fecha_por_reserva,

        filters.comentarios,
        filters.comentario_CXP,
      ],
    );

    const ids = (spRows || [])
      .map((r) => r.id_solicitud_proveedor)
      .filter((id) => id !== null && id !== undefined);

    let pagosRaw = [];
    if (ids.length > 0) {
      pagosRaw = await executeSP(STORED_PROCEDURE.GET.OBTENR_PAGOS_PROVEEDOR);
    }

    const pagosBySolicitud = (pagosRaw || []).reduce((acc, row) => {
      const key = String(row.id_solicitud_proveedor);

      const dispersiones = toArray(row.dispersiones_json);
      const pagos = toArray(row.pagos_json);

      (acc[key] ||= []).push(...dispersiones, ...pagos);
      return acc;
    }, {});

    const data = (spRows || []).map((r) => {
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
        estatus_pagos,
        is_ajuste,
        comentario_ajuste,

        pagos_facturas_proveedores_json,
        uuids_facturas_json,
        rfcs_facturas_json,
        razones_sociales_facturas_json,
        uuid_factura_principal,
        rfc_factura_principal,
        razon_social_factura_principal,

        ...rest
      } = r;

      const pagos = pagosBySolicitud[String(id_solicitud_proveedor)] ?? [];
      const forma = norm(forma_pago_solicitada);

      const pagoStats = getPagoStats(pagos);
      const saldoNum = num(saldo);
      const factNums = getFacturaNums({ ...r, ...rest });

      const facturasProveedor = toArray(pagos_facturas_proveedores_json);
      const uuidsFacturas = toArray(uuids_facturas_json);
      const rfcsFacturas = toArray(rfcs_facturas_json);
      const razonesSocialesFacturas = toArray(razones_sociales_facturas_json);

      const estaPagada =
        norm(estatus_pagos) === "pagado" ||
        saldoNum === 0 ||
        pagoStats.anyPagadoEstado ||
        pagoStats.pagado >= num(monto_solicitado);

      return {
        ...rest,
        id_solicitud_proveedor,
        fecha_solicitud,
        monto_solicitado,
        saldo,
        forma_pago_solicitada,
        estatus_pagos,

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
          is_ajuste,
          comentario_ajuste,
        },

        tarjeta: {
          ultimos_4,
          banco_emisor,
          tipo_tarjeta,
        },

        proveedor: {
          rfc: rfc_factura_principal,
          razon_social: razon_social_factura_principal,
        },

        facturas_proveedor: {
          uuid_factura_principal,
          rfc_factura_principal,
          razon_social_factura_principal,
          uuids_facturas: uuidsFacturas,
          rfcs_facturas: rfcsFacturas,
          razones_sociales_facturas: razonesSocialesFacturas,
          facturas: facturasProveedor,
        },

        pagos,

        __computed: {
          forma,
          estado_solicitud_norm: norm(estado_solicitud),
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

    res.set({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      Expires: "0",
    });

    if (debug) {
      return res.status(200).json({
        ok: true,
        message: "Registros obtenidos con exito",
        data,
        meta: {
          filters,
          counts: {
            spRows_len: spRows.length,
            mapped_len: data.length,
            pagosRaw_len: pagosRaw.length,
          },
        },
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Registros obtenidos con exito",
      data,
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
      [id_proveedor],
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

const saldo_a_favor = async (req, res) => {
  try {
    const { id_proveedor } = req.query; // puede venir undefined

    const data = await executeSP(
      "sp_obtener_saldo_a_favor_proveedor",
      [id_proveedor ?? null], // MUY IMPORTANTE: pasar null si no viene
    );

    return res.status(200).json({ data }); // data = array rows del SP
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      error: "Error en el servidor",
      details: error?.message ?? error,
    });
  }
};

const saldos = async (req, res) => {
  try {
    const { id_proveedor } = req.query; // puede venir undefined

    const data = await executeSP(
      "sp_obtener_saldos_usables",
      [id_proveedor ?? null], // MUY IMPORTANTE: pasar null si no viene
    );

    return res.status(200).json({ data }); // data = array rows del SP
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      error: "Error en el servidor",
      details: error?.message ?? error,
    });
  }
};

const editProveedores = async (req, res) => {};

const cambio_estatus = async (req, res) => {
  try {
    const { id_saldo, estado } = req.body;

    // Validaciones básicas
    if (!id_saldo || !estado) {
      return res.status(400).json({
        ok: false,
        message: "id_saldo y estado son obligatorios",
      });
    }

    const estadosPermitidos = ["approved", "cancelled"];

    if (!estadosPermitidos.includes(String(estado).toLowerCase())) {
      return res.status(400).json({
        ok: false,
        message: "Estado inválido. Solo se permite approved o cancelled",
      });
    }

    // Opcional: validar que exista y que no ya esté cambiado
    const checkQuery = `
      SELECT id_saldo, estado, id_solicitud
      FROM saldos
      WHERE id_saldo = ?
      LIMIT 1;
    `;

    const saldoExistente = await executeQuery(checkQuery, [id_saldo]);

    if (!saldoExistente || saldoExistente.length === 0) {
      return res.status(404).json({
        ok: false,
        message: `No existe un saldo con id_saldo ${id_saldo}`,
      });
    }

    const estadoActual = String(saldoExistente[0].estado || "").toLowerCase();
    const nuevoEstado = String(estado).toLowerCase();

    if (estadoActual === nuevoEstado) {
      return res.status(200).json({
        ok: true,
        message: `El saldo ya se encuentra en estado ${nuevoEstado}`,
        data: saldoExistente[0],
      });
    }

    const updateQuery = `
      UPDATE saldos
      SET
        estado = ?,
        update_at = NOW()
      WHERE id_saldo = ?;
    `;

    const result = await executeQuery(updateQuery, [nuevoEstado, id_saldo]);

    return res.status(200).json({
      ok: true,
      message: `Estado actualizado a ${nuevoEstado} correctamente`,
      data: {
        id_saldo,
        estado: nuevoEstado,
      },
      result,
    });
  } catch (error) {
    console.error("Error en cambio_estatus:", error);
    return res.status(500).json({
      ok: false,
      message: "Error interno al cambiar el estatus del saldo",
      error: error.message,
    });
  }
};

const getProveedores = async (req, res) => {};

const cargarFactura = async (req, res) => {
  req.context.logStep(
    "crearFacturaDesdeCarga",
    "Iniciando creación de factura desde carga (proveedores)",
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
    montos_originales_factura,
    facturas,
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

    const facturaData = facturas?.facturaData ?? null;

    const totalN = toNumber(total);
    const subtotalN = toNumber(subtotal);
    const impuestosN = toNumber(impuestos);

    const proveedorFirst = proveedoresArr[0];

    const proveedor_razon_social =
      proveedorFirst?.proveedor?.razon_social ??
      proveedorFirst?.razon_social ??
      null;

    const fechaFacturaSQL = toDateOnly(fecha_emision);

    const es_credito = Number(
      proveedorFirst?.is_credito ?? (fecha_vencimiento ? 1 : 0),
    );

    // ✅ nuevos campos para facturas_pago_proveedor
    const razon_social = String(
      facturaData?.receptor?.nombre ?? req.body?.razon_social ?? "",
    ).trim();

    const uso_cfdi =
      String(
        facturaData?.receptor?.usoCFDI ?? req.body?.uso_cfdi ?? "",
      ).trim() || null;

    const moneda = String(
      montos_originales_factura?.moneda ??
        facturaData?.comprobante?.moneda ??
        "MXN",
    )
      .trim()
      .toUpperCase();

    const forma_pago =
      String(
        facturaData?.comprobante?.formaPago ?? req.body?.forma_pago ?? "",
      ).trim() || null;

    const metodo_pago =
      String(
        facturaData?.comprobante?.metodoPago ?? req.body?.metodo_pago ?? "",
      ).trim() || null;

    const total_moneda_O = toNumber(
      montos_originales_factura?.total ??
        facturaData?.comprobante?.total ??
        total,
    );

    const sub_total_moneda_O = toNumber(
      montos_originales_factura?.subtotal ??
        facturaData?.comprobante?.subtotal ??
        subtotal,
    );

    const impuestos_moneda_O = toNumber(
      montos_originales_factura?.impuestos ??
        facturaData?.impuestos?.traslado?.importe ??
        impuestos,
    );

    // ✅ Normalizar JSON para SP (ARRAY siempre)
    const detalle = proveedoresArr.map((p, idx) => {
      const id_solicitud_proveedor =
        p?.solicitud_proveedor?.id_solicitud_proveedor ??
        p?.id_solicitud_proveedor ??
        p?.id_solicitud ??
        null;

      if (!id_solicitud_proveedor) {
        throw new Error(
          `proveedoresData[${idx}] no trae id_solicitud / id_solicitud_proveedor`,
        );
      }

      const monto_solicitado = toNumber(
        p?.solicitud_proveedor?.monto_solicitado ?? p?.monto_solicitado ?? 0,
      );

      const monto_facturado = toNumber(
        p?.monto_asociar ?? p?.monto_facturado ?? 0,
      );

      if (monto_facturado < 0) {
        throw new Error(
          `proveedoresData[${idx}] monto_asociar inválido (no puede ser negativo)`,
        );
      }

      if (monto_solicitado > 0 && monto_facturado > monto_solicitado) {
        throw new Error(
          `proveedoresData[${idx}] monto_asociar (${monto_facturado}) excede monto_solicitado (${monto_solicitado})`,
        );
      }

      const pendiente_facturar =
        monto_solicitado > 0 ? monto_solicitado - monto_facturado : null;

      const id_pago =
        p?.detalles_pagos?.[0]?.id_pago ??
        p?.id_pago ??
        p?.id_pago_proveedores ??
        null;

      const tipo_cambio = toNumber(
        p?.montos_originales?.tipo_cambio ??
          montos_originales_factura?.tipo_cambio ??
          1,
      );

      return {
        id_pago,
        solicitud_proveedor: {
          id_solicitud_proveedor,
          monto_solicitado,
        },
        monto_facturado,
        pendiente_facturar,
        tipo_cambio,
      };
    });

    const monto_facturado_total = detalle.reduce(
      (acc, x) => acc + toNumber(x.monto_facturado),
      0,
    );

    if (monto_facturado_total > totalN) {
      return res.status(400).json({
        error: "Monto asociado inválido",
        message: `La suma de monto_asociar (${monto_facturado_total}) no puede ser mayor al total de la factura (${totalN}).`,
      });
    }

    const proveedoresDataSP = JSON.stringify(detalle);

    const saldo_x_aplicar_items = totalN - monto_facturado_total;
    const estado_factura = estado;

    const response = await executeSP(
      "sp_inserta_factura_desde_carga_proveedores",
      [
        id_factura,

        uuid_factura,
        rfc_emisor,
        proveedor_razon_social,
        monto_facturado_total,
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
        saldo_x_aplicar_items,
        rfc,
        id_empresa,
        fecha_vencimiento,

        // ✅ nuevos campos
        razon_social,
        uso_cfdi,
        moneda,
        forma_pago,
        metodo_pago,
        total_moneda_O,
        sub_total_moneda_O,
        impuestos_moneda_O,

        proveedoresDataSP,
      ],
    );

    const idsSolicitudes = [
      ...new Set(
        detalle
          .map((x) => x?.solicitud_proveedor?.id_solicitud_proveedor)
          .filter(Boolean),
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
          spp.monto_facturado = IFNULL(agg.total_facturado, 0),
          spp.monto_por_facturar = GREATEST(
            CAST(spp.monto_solicitado AS DECIMAL(12,2)) - IFNULL(agg.total_facturado, 0),
            0
          ),
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
          spp.estatus_pagos = CASE
            WHEN CAST(COALESCE(NULLIF(spp.saldo, ''), '0') AS DECIMAL(12,2)) = 0 THEN 'pagado'
            ELSE spp.estatus_pagos
          END
        WHERE spp.id_solicitud_proveedor IN (${placeholders});
      `;

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

function money2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function toMoneyNumber(v) {
  // soporta: 1234, "1234.50", "$1,234.50"
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function mapFormaPagoSolicitudToSaldo(formaPagoSolicitada) {
  // ajusta si tu tabla "saldos.forma_pago" usa otros valores
  const fp = String(formaPagoSolicitada || "")
    .trim()
    .toLowerCase();
  if (fp === "transfer" || fp === "transferencia") return "transfer";
  if (fp === "card" || fp === "tarjeta") return "card";
  if (fp === "link") return "link";
  return fp || "transfer";
}

function makeIdSaldo() {
  // si ya usas uuidv4 en tu proyecto, reemplaza esto por uuidv4()
  return `SAL_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function makeTransactionId() {
  return `TX_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function crearSaldoFavorPorMontoPagado({
  executeQuery,
  id_solicitud_proveedor,
  solicitudRow,
  usuario = "system",
  montoPagadoOverride = null,
  origen = "pago_proveedores",
  dispersionRows = [],
}) {
  let rowsPagos = [];
  let monto_pagado_neto = 0;
  let pagoBase = null;

  // ---------------------------------------------------------
  // CASO A: viene override desde dispersion_pagos_proveedor
  // ---------------------------------------------------------
  if (montoPagadoOverride != null) {
    monto_pagado_neto = money2(Number(montoPagadoOverride) || 0);

    if (monto_pagado_neto <= 0) {
      return {
        ok: false,
        error: "MONTO_OVERRIDE_INVALIDO",
        message: `Monto override inválido: ${monto_pagado_neto}`,
      };
    }

    rowsPagos = Array.isArray(dispersionRows) ? dispersionRows : [];
    pagoBase = rowsPagos[0] || null;
  } else {
    // ---------------------------------------------------------
    // CASO B: comportamiento original con pago_proveedores
    // ---------------------------------------------------------
    const qPagos = `
      SELECT
        id_pago_proveedores,
        monto_pagado,
        monto,
        total,
        metodo_de_pago,
        referencia_pago,
        concepto,
        numero_comprobante,
        codigo_dispersion,
        descripcion,
        fecha_pago,
        fecha_emision
      FROM pago_proveedores
      WHERE id_solicitud_proveedor = ?
      ORDER BY COALESCE(fecha_pago, fecha_emision) DESC, id_pago_proveedores DESC
    `;
    rowsPagos = await executeQuery(qPagos, [id_solicitud_proveedor]);

    if (!rowsPagos?.length) {
      return {
        ok: false,
        error: "NO_PAGOS",
        message: `La solicitud ${id_solicitud_proveedor} está PAGADA pero no tiene pagos en pago_proveedores.`,
      };
    }

    for (const p of rowsPagos) {
      const montoRow =
        toMoneyNumber(p?.monto_pagado) ||
        toMoneyNumber(p?.total) ||
        toMoneyNumber(p?.monto);

      const isDevolucion = Number(p?.is_devolucion || 0) === 1;
      monto_pagado_neto += isDevolucion ? -montoRow : montoRow;
    }

    monto_pagado_neto = money2(monto_pagado_neto);

    if (monto_pagado_neto <= 0) {
      return {
        ok: false,
        error: "MONTO_NETO_INVALIDO",
        message: `Monto pagado neto inválido: ${monto_pagado_neto}`,
      };
    }

    pagoBase =
      rowsPagos.find((x) => Number(x?.is_devolucion || 0) !== 1) ||
      rowsPagos[0];
  }

  // 2) idempotencia simple
  const qExiste = `
    SELECT id_saldo
    FROM saldos
    WHERE id_solicitud = ?
      AND motivo = 'Saldo a favor por cancelación de solicitud pagada'
    LIMIT 1
  `;
  const rExiste = await executeQuery(qExiste, [id_solicitud_proveedor]);

  if (rExiste?.length) {
    return {
      ok: true,
      action: "SALDO_ALREADY_EXISTS",
      id_saldo: rExiste[0].id_saldo,
      monto_pagado_neto,
      pagos_encontrados: rowsPagos.length,
      origen,
    };
  }

  const id_saldo = makeIdSaldo();
  const transaction_id = makeTransactionId();
  const forma_pago_saldo = mapFormaPagoSolicitudToSaldo(
    solicitudRow?.forma_pago_solicitada,
  );

  const referencia = `EDITCAMPOS_CANCEL_PAGADA
  _solicitud_proveedor}`;
  const motivo = "Saldo a favor por cancelación de solicitud pagada";

  const comentariosSaldo = [
    `Solicitud cancelada desde EditCampos.`,
    `Origen saldo: ${origen}.`,
    `Monto pagado neto: ${monto_pagado_neto}.`,
    pagoBase?.id_pago_proveedores
      ? `Pago base: ${pagoBase.id_pago_proveedores}.`
      : null,
    pagoBase?.id_dispersion_pagos_proveedor
      ? `Dispersion base: ${pagoBase.id_dispersion_pagos_proveedor}.`
      : null,
    pagoBase?.metodo_de_pago ? `Método: ${pagoBase.metodo_de_pago}.` : null,
    pagoBase?.referencia_pago
      ? `Referencia: ${pagoBase.referencia_pago}.`
      : null,
    pagoBase?.numero_comprobante
      ? `Comprobante: ${pagoBase.numero_comprobante}.`
      : null,
    pagoBase?.codigo_dispersion
      ? `Dispersión: ${pagoBase.codigo_dispersion}.`
      : null,
    pagoBase?.concepto ? `Concepto: ${pagoBase.concepto}.` : null,
    pagoBase?.descripcion ? `Descripción: ${pagoBase.descripcion}.` : null,
    solicitudRow?.comentarios
      ? `Comentarios solicitud: ${solicitudRow.comentarios}`
      : null,
    usuario ? `Usuario: ${usuario}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const qInsertSaldo = `
    INSERT INTO saldos (
      id_saldo,
      id_proveedor,
      monto,
      restante,
      forma_pago,
      fecha_procesamiento,
      referencia,
      id_hospedaje,
      transaction_id,
      motivo,
      comentarios,
      estado,
      id_solicitud,
      update_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `;

  await executeQuery(qInsertSaldo, [
    id_saldo,
    String(solicitudRow?.id_proveedor),
    monto_pagado_neto,
    monto_pagado_neto,
    forma_pago_saldo,
    new Date(),
    referencia,
    null,
    transaction_id,
    motivo,
    comentariosSaldo,
    id_solicitud_proveedor,
    new Date(),
  ]);

  return {
    ok: true,
    action: "SALDO_CREATED",
    id_saldo,
    transaction_id,
    monto_pagado_neto,
    pagos_encontrados: rowsPagos.length,
    origen,
  };
}

const calcularMontoPagadoDesdeDispersiones = (rows = []) => {
  return money2(
    rows.reduce((acc, row) => {
      return acc + Number(row?.monto_solicitado ?? 0);
    }, 0),
  );
};

const devolverMontoFacturadoAFacturasPorCancelacion = async ({
  executeQuery,
  id_solicitud_proveedor,
}) => {
  const getRows = (result) =>
    Array.isArray(result) ? result : (result?.[0] ?? []);

  const safeString = (v) => String(v ?? "").trim();

  const round2 = (n) => Number(Number(n || 0).toFixed(2));
  const toMoneyString = (n) => round2(n).toFixed(2);

  const qRelaciones = `
    SELECT
      TRIM(id_factura) AS id_factura,
      ROUND(
        SUM(
          CAST(COALESCE(NULLIF(TRIM(monto_facturado), ''), '0') AS DECIMAL(12,2))
        ),
        2
      ) AS monto_facturado_total
    FROM pagos_facturas_proveedores
    WHERE id_solicitud = ?
      AND COALESCE(NULLIF(TRIM(id_factura), ''), '') <> ''
    GROUP BY TRIM(id_factura)
    HAVING monto_facturado_total > 0;
  `;

  const relaciones = getRows(
    await executeQuery(qRelaciones, [id_solicitud_proveedor]),
  );

  if (!relaciones.length) {
    return {
      ok: true,
      action: "NO_FACTURAS_RELACIONADAS",
      facturas_actualizadas: [],
    };
  }

  const facturasActualizadas = [];

  for (const rel of relaciones) {
    const idFactura = safeString(rel.id_factura);
    const montoDevolver = round2(rel.monto_facturado_total ?? 0);

    if (!idFactura || !(montoDevolver > 0)) continue;

    const qFacturaActual = `
      SELECT
        id_factura_proveedor,
        CAST(
          COALESCE(NULLIF(TRIM(saldo_x_aplicar_items), ''), '0') AS DECIMAL(12,2)
        ) AS saldo_actual
      FROM facturas_pago_proveedor
      WHERE TRIM(id_factura_proveedor) = TRIM(?)
      LIMIT 1;
    `;

    const facturaRows = getRows(
      await executeQuery(qFacturaActual, [idFactura]),
    );

    if (!facturaRows.length) {
      throw new Error(
        `No se encontró la factura en facturas_pago_proveedor: ${idFactura}`,
      );
    }

    const saldoActual = round2(facturaRows[0].saldo_actual ?? 0);
    const saldoNuevo = round2(saldoActual + montoDevolver);

    await executeQuery(
      `
      UPDATE facturas_pago_proveedor
      SET saldo_x_aplicar_items = ?
      WHERE TRIM(id_factura_proveedor) = TRIM(?)
      LIMIT 1;
      `,
      [toMoneyString(saldoNuevo), idFactura],
    );

    facturasActualizadas.push({
      id_factura_proveedor: idFactura,
      saldo_anterior: toMoneyString(saldoActual),
      monto_devuelto: toMoneyString(montoDevolver),
      saldo_nuevo: toMoneyString(saldoNuevo),
    });
  }

  // importante: dejar en 0 las relaciones para no devolver dos veces
  await executeQuery(
    `
    UPDATE pagos_facturas_proveedores
    SET
      monto_facturado = '0.00',
      subtotal_facturado = '0.00',
      impuestos_facturado = '0.00',
      monto_pago = '0.00'
    WHERE id_solicitud = ?;
    `,
    [id_solicitud_proveedor],
  );

  return {
    ok: true,
    action: "FACTURAS_SALDO_DEVUELTO",
    facturas_actualizadas: facturasActualizadas,
  };
};

const EditCampos = async (req, res) => {
  try {
    const { id_solicitud_proveedor, usuario_creador, ...rest } = req.body;

    // igual que en createSolicitud
    const session = req.session?.user?.id ?? "";
    const USER_FALLBACK = "cliente"; // si lo quieres vacío, cámbialo a ""

    const resolveUserId = (...candidates) => {
      const found = candidates
        .map((v) => String(v ?? "").trim())
        .find((v) => v.length > 0);

      return found || USER_FALLBACK;
    };

    const userId = resolveUserId(session, usuario_creador);
    const userIdDB = userId === "" ? null : userId;

    const normalizeEstado = (v) =>
      String(v ?? "")
        .trim()
        .toUpperCase();

    const esEstadoCancelacion = (v) => {
      const estado = normalizeEstado(v);
      return estado === "CANCELADA" || estado === "CANCELADO";
    };

    const ESTADOS_PAGADO = new Set([
      "PAGADO LINK",
      "PAGADO TARJETA",
      "PAGADO TRANSFERENCIA",
    ]);

    if (!id_solicitud_proveedor) {
      return res.status(400).json({
        error: "Falta id_solicitud_proveedor en el body",
      });
    }

    const keys = Object.keys(rest).filter((k) => rest[k] !== undefined);

    if (keys.length === 0) {
      return res.status(400).json({
        error:
          "No viene ningún campo para actualizar (además del id_solicitud_proveedor)",
      });
    }

    const FIELD_MAP = {
      comentarios_cxp: "comentario_CXP",
      comentarios_CXP: "comentario_CXP",
      comentarios_ops: "comentarios",
      comentarios_Ap: "comentario_AP",
      comentarios_AP: "comentario_AP",
      notas_internas: "notas_internas",
    };

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
      "comentario_AP",
      "monto_facturado",
      "monto_por_facturar",
      "comentario_CXP",
      "consolidado",
      "is_ajuste",
      "comentario_ajuste",
      "pagado",
      "notas_internas",
    ]);

    const NUMERIC_FIELDS = new Set([
      "id_proveedor",
      "consolidado",
      "is_ajuste",
      "monto_solicitado",
      "saldo",
      "monto_facturado",
      "monto_por_facturar",
      "pagado",
    ]);

    const updatesMap = new Map();

    for (const fieldFromClient of keys) {
      const dbField = FIELD_MAP[fieldFromClient] || fieldFromClient;

      if (!ALLOWED_FIELDS.has(dbField)) {
        return res.status(400).json({
          error: `Campo no permitido para actualizar: ${fieldFromClient}`,
          permitido: Array.from(ALLOWED_FIELDS),
        });
      }

      const value = rest[fieldFromClient];

      const finalValue = NUMERIC_FIELDS.has(dbField)
        ? value === null || value === ""
          ? null
          : Number(value)
        : value;

      if (
        NUMERIC_FIELDS.has(dbField) &&
        finalValue !== null &&
        Number.isNaN(finalValue)
      ) {
        return res.status(400).json({
          error: `El campo ${fieldFromClient} debe ser numérico`,
        });
      }

      updatesMap.set(dbField, finalValue);
    }

    const pagadoFlagBody = updatesMap.has("pagado")
      ? Number(updatesMap.get("pagado"))
      : null;

    updatesMap.delete("pagado");

    let ajusteInfo = null;
    let estadoEspecialInfo = null;
    let devolucionFacturasInfo = null;
    let debeDevolverFacturasPorCancelacion = false;

    let handledEstadoPagadoCombo = false;

    if (updatesMap.has("estado_solicitud") && pagadoFlagBody !== null) {
      const nuevoEstadoSolicitado = normalizeEstado(
        updatesMap.get("estado_solicitud"),
      );
      const esCancelacionSolicitada = esEstadoCancelacion(
        nuevoEstadoSolicitado,
      );

      const pagadoFlag = Number(pagadoFlagBody);

      if (![0, 1].includes(pagadoFlag)) {
        return res.status(400).json({
          error: "El campo pagado debe ser 0 o 1",
        });
      }

      const qSolicitudActual = `
        SELECT
          id_solicitud_proveedor,
          id_proveedor,
          estado_solicitud,
          monto_solicitado,
          saldo,
          forma_pago_solicitada,
          comentarios,
          comentario_ajuste
        FROM solicitudes_pago_proveedor
        WHERE id_solicitud_proveedor = ?
        LIMIT 1
      `;
      const rSolicitudActual = await executeQuery(qSolicitudActual, [
        id_solicitud_proveedor,
      ]);

      if (!rSolicitudActual?.length) {
        return res.status(404).json({
          error: "No se encontró la solicitud",
          id_solicitud_proveedor,
        });
      }

      const solicitudActual = rSolicitudActual[0];

      if (pagadoFlag === 0) {
        updatesMap.set("estado_solicitud", nuevoEstadoSolicitado);

        if (esCancelacionSolicitada) {
          debeDevolverFacturasPorCancelacion = true;
        }

        estadoEspecialInfo = {
          ok: true,
          action: "NOTIFICADO_PAGADO_0_ONLY_STATUS_CHANGE",
          estado_actual: normalizeEstado(solicitudActual.estado_solicitud),
          estado_solicitado: nuevoEstadoSolicitado,
          pagado: 0,
        };

        handledEstadoPagadoCombo = true;
      }

      if (pagadoFlag === 1) {
        const qDispersiones = `
          SELECT
            id_dispersion_pagos_proveedor,
            id_solicitud_proveedor,
            monto_solicitado,
            saldo,
            monto_pagado,
            codigo_dispersion,
            fecha_pago,
            created_at
          FROM dispersion_pagos_proveedor
          WHERE id_solicitud_proveedor = ?
          ORDER BY id_dispersion_pagos_proveedor ASC
        `;
        const dispersionRows = await executeQuery(qDispersiones, [
          id_solicitud_proveedor,
        ]);

        if (!dispersionRows?.length) {
          return res.status(400).json({
            error:
              "No existen registros en dispersion_pagos_proveedor para esta solicitud",
            id_solicitud_proveedor,
          });
        }

        const montoPagadoNeto =
          calcularMontoPagadoDesdeDispersiones(dispersionRows);

        if (!(montoPagadoNeto > 0)) {
          return res.status(400).json({
            error:
              "No se pudo determinar un monto pagado válido desde dispersion_pagos_proveedor",
            id_solicitud_proveedor,
          });
        }

        const usuario = req?.user?.email || req?.user?.name || "system";

        const saldoResp = await crearSaldoFavorPorMontoPagado({
          executeQuery,
          id_solicitud_proveedor,
          solicitudRow: {
            id_proveedor: solicitudActual.id_proveedor,
            forma_pago_solicitada: solicitudActual.forma_pago_solicitada,
            comentarios: solicitudActual.comentarios,
          },
          usuario,
          montoPagadoOverride: montoPagadoNeto,
          origen: "dispersion_pagos_proveedor",
          dispersionRows,
          reserva,
        });

        updatesMap.set("estado_solicitud", nuevoEstadoSolicitado);
        updatesMap.set("is_ajuste", 1);
        updatesMap.set(
          "comentario_ajuste",
          `Cancelada desde notificados | saldo a favor generado por dispersion_pagos_proveedor | monto neto: ${String(
            montoPagadoNeto,
          )}`,
        );

        if (esCancelacionSolicitada) {
          debeDevolverFacturasPorCancelacion = true;
        }

        estadoEspecialInfo = {
          ok: true,
          action: "NOTIFICADO_PAGADO_1_CANCELADA_WITH_SALDO_FAVOR",
          estado_actual: normalizeEstado(solicitudActual.estado_solicitud),
          estado_solicitado: nuevoEstadoSolicitado,
          pagado: 1,
          monto_pagado_neto: montoPagadoNeto,
          dispersiones_encontradas: dispersionRows.length,
          saldo: saldoResp,
        };

        handledEstadoPagadoCombo = true;
      }
    }

    if (!handledEstadoPagadoCombo && updatesMap.has("estado_solicitud")) {
      const nuevoEstadoSolicitado = normalizeEstado(
        updatesMap.get("estado_solicitud"),
      );

      if (esEstadoCancelacion(nuevoEstadoSolicitado)) {
        const qEstadoActual = `
          SELECT
            id_solicitud_proveedor,
            id_proveedor,
            estado_solicitud,
            monto_solicitado,
            saldo,
            forma_pago_solicitada,
            comentarios
          FROM solicitudes_pago_proveedor
          WHERE id_solicitud_proveedor = ?
          LIMIT 1
        `;
        const rEstadoActual = await executeQuery(qEstadoActual, [
          id_solicitud_proveedor,
        ]);

        if (!rEstadoActual?.length) {
          return res.status(404).json({
            error: "No se encontró la solicitud",
            id_solicitud_proveedor,
          });
        }

        const rowActual = rEstadoActual[0];
        const estadoActual = normalizeEstado(rowActual.estado_solicitud);
        const montoActual = Number(rowActual.monto_solicitado ?? 0);

        if (estadoActual === "DISPERSION") {
          const qMarkDispersion = `
            UPDATE solicitudes_pago_proveedor
            SET
              is_ajuste = 1,
              comentario_ajuste = 'Seleccionar si está pagado'
            WHERE id_solicitud_proveedor = ?
            LIMIT 1
          `;
          await executeQuery(qMarkDispersion, [id_solicitud_proveedor]);

          updatesMap.delete("estado_solicitud");

          estadoEspecialInfo = {
            ok: true,
            action: "DISPERSION_MARKED_AJUSTE_NO_STATUS_CHANGE",
            estado_actual: estadoActual,
            estado_solicitado: nuevoEstadoSolicitado,
          };
        } else if (ESTADOS_PAGADO.has(estadoActual)) {
          const usuario = req?.user?.email || req?.user?.name || "system";

          const saldoResp = await crearSaldoFavorPorMontoPagado({
            executeQuery,
            id_solicitud_proveedor,
            solicitudRow: {
              id_proveedor: rowActual.id_proveedor,
              forma_pago_solicitada: rowActual.forma_pago_solicitada,
              comentarios: rowActual.comentarios,
            },
            usuario,
            reserva,
          });

          if (!saldoResp?.ok) {
            return res.status(400).json({
              error:
                "No se pudo generar saldo a favor por monto pagado para cancelar solicitud pagada",
              details: saldoResp,
            });
          }

          const qCancelPaid = `
            UPDATE solicitudes_pago_proveedor
            SET
              estado_solicitud = 'CANCELADA',
              is_ajuste = 1,
              comentario_ajuste = CONCAT(
                COALESCE(comentario_ajuste, ''),
                CASE
                  WHEN comentario_ajuste IS NULL OR comentario_ajuste = '' THEN ''
                  ELSE ' | '
                END,
                'Cancelada después de generar saldo a favor por monto pagado neto: ',
                ?
              )
            WHERE id_solicitud_proveedor = ?
            LIMIT 1
          `;
          await executeQuery(qCancelPaid, [
            String(saldoResp.monto_pagado_neto),
            id_solicitud_proveedor,
          ]);

          updatesMap.delete("estado_solicitud");
          updatesMap.delete("monto_solicitado");

          debeDevolverFacturasPorCancelacion = true;

          ajusteInfo = {
            montoOld: montoActual,
            montoNew: 0,
            ajuste: saldoResp,
          };

          estadoEspecialInfo = {
            ok: true,
            action: "PAID_TO_CANCELADA_WITH_SALDO_BY_PAGOS_NETO",
            estado_actual: estadoActual,
            estado_solicitado: "CANCELADA",
            saldo: saldoResp,
          };
        } else {
          debeDevolverFacturasPorCancelacion = true;
        }
      }
    }

    if (updatesMap.has("monto_solicitado")) {
      const nuevoMonto = Number(updatesMap.get("monto_solicitado"));
      if (!Number.isFinite(nuevoMonto)) {
        return res.status(400).json({
          error: "monto_solicitado debe ser numérico",
        });
      }

      const qOld = `
        SELECT monto_solicitado
        FROM solicitudes_pago_proveedor
        WHERE id_solicitud_proveedor = ?
        LIMIT 1
      `;
      const rOld = await executeQuery(qOld, [id_solicitud_proveedor]);

      if (!rOld?.length) {
        return res.status(404).json({
          error: "No se encontró la solicitud",
          id_solicitud_proveedor,
        });
      }

      const montoOld = Number(rOld[0].monto_solicitado ?? 0);
      const EPS = 0.01;

      let ajusteResp = { ok: true, action: "NO_CHANGE" };

      if (nuevoMonto > montoOld) {
        ajusteResp = await ajustarSolicitudPorAumentoMontoSolicitudDirecto({
          executeQuery,
          id_solicitud_proveedor,
          nuevoMonto,
          EPS,
        });
      } else if (nuevoMonto < montoOld) {
        ajusteResp = await ajustarSolicitudPorDisminucionMontoSolicitudDirecto({
          executeQuery,
          executeSP2,
          id_solicitud_proveedor,
          nuevoMonto,
          EPS,
        });
      }

      let bookingSyncInfo = null;

      const qBookingRelacion = `
        SELECT id_booking
        FROM booking_solicitud
        WHERE id_solicitud = ?
        LIMIT 1
      `;
      const rBookingRelacion = await executeQuery(qBookingRelacion, [
        id_solicitud_proveedor,
      ]);

      if (rBookingRelacion?.length) {
        const id_booking = rBookingRelacion[0].id_booking;

        const qUpdateBooking = `
          UPDATE bookings
          SET costo_total = ?
          WHERE id_booking = ?
          LIMIT 1
        `;

        const rUpdateBooking = await executeQuery(qUpdateBooking, [
          nuevoMonto,
          id_booking,
        ]);

        const affectedBooking =
          rUpdateBooking?.affectedRows ?? rUpdateBooking?.[0]?.affectedRows ?? 0;

        bookingSyncInfo = {
          ok: affectedBooking > 0,
          action:
            affectedBooking > 0
              ? "BOOKING_COSTO_TOTAL_UPDATED"
              : "BOOKING_FOUND_BUT_NOT_UPDATED",
          id_booking,
          costo_total: nuevoMonto,
        };
      } else {
        bookingSyncInfo = {
          ok: false,
          action: "BOOKING_RELATION_NOT_FOUND",
          message:
            "No se encontró relación en booking_solicitud para esta solicitud",
        };
      }

      ajusteInfo = {
        montoOld,
        montoNew: nuevoMonto,
        ajuste: ajusteResp,
        bookingSyncInfo,
      };

      updatesMap.delete("monto_solicitado");
    }

    if (updatesMap.size > 0) {
      // SIEMPRE registrar usuario_edit cuando haya update normal
      updatesMap.set("usuario_edit", userIdDB);

      const setParts = [];
      const params = [];

      for (const [dbField, finalValue] of updatesMap.entries()) {
        setParts.push(`\`${dbField}\` = ?`);
        params.push(finalValue);
      }

      const updateSql = `
        UPDATE solicitudes_pago_proveedor
        SET ${setParts.join(", ")}
        WHERE id_solicitud_proveedor = ?
        LIMIT 1;
      `;

      const result = await executeQuery(updateSql, [
        ...params,
        id_solicitud_proveedor,
      ]);
      const affectedRows =
        result?.affectedRows ?? result?.[0]?.affectedRows ?? 0;

      if (affectedRows === 0) {
        return res.status(404).json({
          error: "No se encontró la solicitud o no se actualizó nada",
          id_solicitud_proveedor,
        });
      }
    } else {
      if (!ajusteInfo && !estadoEspecialInfo) {
        return res.status(400).json({ error: "No hubo cambios para aplicar" });
      }

      // SI hubo cambios por lógica interna, también guardamos usuario_edit
      await executeQuery(
        `
          UPDATE solicitudes_pago_proveedor
          SET usuario_edit = ?
          WHERE id_solicitud_proveedor = ?
          LIMIT 1
        `,
        [userIdDB, id_solicitud_proveedor]
      );
    }

    if (debeDevolverFacturasPorCancelacion) {
      devolucionFacturasInfo =
        await devolverMontoFacturadoAFacturasPorCancelacion({
          executeQuery,
          id_solicitud_proveedor,
        });
    }

    const selectSql = `
      SELECT *
      FROM solicitudes_pago_proveedor
      WHERE id_solicitud_proveedor = ?
      LIMIT 1;
    `;
    const rows = await executeQuery(selectSql, [id_solicitud_proveedor]);
    const updated = Array.isArray(rows) ? rows[0] : rows?.[0];

    let message = "Campos actualizados correctamente";

    if (
      estadoEspecialInfo?.action === "NOTIFICADO_PAGADO_0_ONLY_STATUS_CHANGE"
    ) {
      message =
        "La solicitud fue actualizada con pagado=0 y solo se cambió el estado_solicitud";
    } else if (
      estadoEspecialInfo?.action ===
      "NOTIFICADO_PAGADO_1_CANCELADA_WITH_SALDO_FAVOR"
    ) {
      message =
        "La solicitud fue cancelada con pagado=1 y se generó saldo a favor desde dispersion_pagos_proveedor";
    } else if (
      estadoEspecialInfo?.action === "DISPERSION_MARKED_AJUSTE_NO_STATUS_CHANGE"
    ) {
      message =
        "La solicitud está en DISPERSION: se marcó como ajuste y no se cambió el estatus";
    } else if (
      estadoEspecialInfo?.action ===
      "PAID_TO_CANCELADA_WITH_SALDO_BY_PAGOS_NETO"
    ) {
      message =
        "La solicitud pagada fue cancelada y se generó saldo a favor por monto pagado neto";
    } else if (ajusteInfo && !updatesMap.size) {
      message = "Ajuste aplicado";
    }

    if (devolucionFacturasInfo?.action === "FACTURAS_SALDO_DEVUELTO") {
      message += " | Se devolvió saldo a las facturas relacionadas";
    } else if (devolucionFacturasInfo?.action === "NO_FACTURAS_RELACIONADAS") {
      message += " | No había facturas relacionadas para devolver saldo";
    }

    return res.status(200).json({
      ok: true,
      message,
      id_solicitud_proveedor,
      estadoEspecialInfo: estadoEspecialInfo || null,
      ajusteInfo: ajusteInfo || null,
      devolucionFacturasInfo: devolucionFacturasInfo || null,
      updated_fields: keys,
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

const monto_factura = async (req, res) => {
  try { 
    const {
      id_solicitud,
      id_solicitud_proveedor,
      id_factura_proveedor,
      uuid_factura,
      subtotal_facturado,
      impuestos_facturado,
      id_pago_proveedor = null,
      monto_pago = null,
    } = req.body;

    const EPS = 0.01;

    const getRows = (result) =>
      Array.isArray(result) ? result : (result?.[0] ?? []);

    const safeString = (v) => String(v ?? "").trim();

    const toNumber = (v) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };

    const round2 = (n) => Number(Number(n || 0).toFixed(2));
    const toMoneyString = (n) => round2(n).toFixed(2);

    const idSolicitud = Number(id_solicitud_proveedor ?? id_solicitud);
    const idFacturaPayload = safeString(id_factura_proveedor);
    const uuid = safeString(uuid_factura);

    const subtotalFacturado = toNumber(subtotal_facturado);
    const impuestosFacturado = toNumber(impuestos_facturado);
    const montoFacturado = round2(subtotalFacturado + impuestosFacturado);

    const idPagoProveedor =
      id_pago_proveedor === null ||
      id_pago_proveedor === undefined ||
      id_pago_proveedor === ""
        ? null
        : Number(id_pago_proveedor);

    const montoPagoFinal =
      monto_pago === null || monto_pago === undefined || monto_pago === ""
        ? montoFacturado
        : toNumber(monto_pago);

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
      return res.status(400).json({
        ok: false,
        message:
          "id_solicitud o id_solicitud_proveedor es requerido y debe ser válido",
      });
    }

    if (!idFacturaPayload && !uuid) {
      return res.status(400).json({
        ok: false,
        message: "Debes enviar id_factura_proveedor o uuid_factura",
      });
    }

    if (!Number.isFinite(subtotalFacturado) || subtotalFacturado < 0) {
      return res.status(400).json({
        ok: false,
        message: "subtotal_facturado debe ser numérico y no negativo",
      });
    }

    if (!Number.isFinite(impuestosFacturado) || impuestosFacturado < 0) {
      return res.status(400).json({
        ok: false,
        message: "impuestos_facturado debe ser numérico y no negativo",
      });
    }

    if (!(montoFacturado > 0)) {
      return res.status(400).json({
        ok: false,
        message: "El monto asociado debe ser mayor a 0",
      });
    }

    if (!Number.isFinite(montoPagoFinal) || montoPagoFinal < 0) {
      return res.status(400).json({
        ok: false,
        message: "monto_pago debe ser numérico y no negativo",
      });
    }

    // 1) Buscar factura
    const whereFactura = [];
    const paramsFactura = [];

    if (idFacturaPayload) {
      whereFactura.push(`TRIM(fpp.id_factura_proveedor) = TRIM(?)`);
      paramsFactura.push(idFacturaPayload);
    }

    if (uuid) {
      whereFactura.push(`TRIM(fpp.uuid_cfdi) = TRIM(?)`);
      paramsFactura.push(uuid);
    }

    const qFactura = `
      SELECT
        fpp.id_factura_proveedor AS id_factura,
        fpp.uuid_cfdi AS uuid_factura,
        CAST(COALESCE(NULLIF(TRIM(fpp.total), ''), '0') AS DECIMAL(12,2)) AS total_factura
      FROM facturas_pago_proveedor fpp
      WHERE ${whereFactura.join(" OR ")}
      LIMIT 1;
    `;

    const facturaRows = getRows(await executeQuery(qFactura, paramsFactura));

    if (!facturaRows.length) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró una factura con los datos enviados",
      });
    }

    const factura = facturaRows[0];
    const idFactura = safeString(factura.id_factura);
    const uuidFacturaReal = safeString(factura.uuid_factura);
    const totalFactura = round2(factura.total_factura ?? 0);

    if (!idFactura) {
      return res.status(400).json({
        ok: false,
        message: "La factura encontrada no tiene id_factura_proveedor válido",
      });
    }

    if (!(totalFactura > 0)) {
      return res.status(400).json({
        ok: false,
        message: "La factura tiene total inválido o igual a 0",
      });
    }

    // 2) Buscar solicitud
    const qSolicitud = `
      SELECT
        id_solicitud_proveedor,
        CAST(monto_solicitado AS DECIMAL(12,2)) AS monto_solicitado
      FROM solicitudes_pago_proveedor
      WHERE id_solicitud_proveedor = ?
      LIMIT 1;
    `;

    const solicitudRows = getRows(
      await executeQuery(qSolicitud, [idSolicitud]),
    );

    if (!solicitudRows.length) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró la solicitud",
      });
    }

    const solicitud = solicitudRows[0];
    const montoSolicitado = round2(solicitud.monto_solicitado ?? 0);

    // 3) Buscar relación existente de esta solicitud + factura
    let relacionExistente = null;
    {
      const qRelacion = `
        SELECT
          id,
          id_pago_proveedor,
          CAST(COALESCE(NULLIF(TRIM(monto_facturado), ''), '0') AS DECIMAL(12,2)) AS monto_facturado_actual,
          CAST(COALESCE(NULLIF(TRIM(subtotal_facturado), ''), '0') AS DECIMAL(12,2)) AS subtotal_facturado_actual,
          CAST(COALESCE(NULLIF(TRIM(impuestos_facturado), ''), '0') AS DECIMAL(12,2)) AS impuestos_facturado_actual
        FROM pagos_facturas_proveedores
        WHERE id_solicitud = ?
          AND id_factura = ?
        ORDER BY id DESC
        LIMIT 1;
      `;

      const rows = getRows(
        await executeQuery(qRelacion, [idSolicitud, idFactura]),
      );
      relacionExistente = rows?.[0] ?? null;
    }

    const montoExistenteRelacion = round2(
      relacionExistente?.monto_facturado_actual ?? 0,
    );

    // 4) SUM global por factura
    const qSumFactura = `
      SELECT
        COALESCE(
          SUM(
            CAST(COALESCE(NULLIF(TRIM(monto_facturado), ''), '0') AS DECIMAL(12,2))
          ),
          0
        ) AS total_asociado_factura
      FROM pagos_facturas_proveedores
      WHERE id_factura = ?;
    `;

    const sumFacturaRows = getRows(
      await executeQuery(qSumFactura, [idFactura]),
    );
    const totalAsociadoFactura = round2(
      sumFacturaRows?.[0]?.total_asociado_factura ?? 0,
    );

    // 5) SUM global por solicitud
    const qSumSolicitud = `
      SELECT
        COALESCE(
          SUM(
            CAST(COALESCE(NULLIF(TRIM(monto_facturado), ''), '0') AS DECIMAL(12,2))
          ),
          0
        ) AS total_asociado_solicitud
      FROM pagos_facturas_proveedores
      WHERE id_solicitud = ?;
    `;

    const sumSolicitudRows = getRows(
      await executeQuery(qSumSolicitud, [idSolicitud]),
    );
    const totalAsociadoSolicitud = round2(
      sumSolicitudRows?.[0]?.total_asociado_solicitud ?? 0,
    );

    // 6) Quitar relación actual para permitir edición
    const totalFacturaSinActual = Math.max(
      0,
      round2(totalAsociadoFactura - montoExistenteRelacion),
    );

    const totalSolicitudSinActual = Math.max(
      0,
      round2(totalAsociadoSolicitud - montoExistenteRelacion),
    );

    const disponibleFactura = Math.max(
      0,
      round2(totalFactura - totalFacturaSinActual),
    );

    const disponibleSolicitud = Math.max(
      0,
      round2(montoSolicitado - totalSolicitudSinActual),
    );

    const maximoAsociable = Math.max(
      0,
      round2(Math.min(disponibleFactura, disponibleSolicitud)),
    );

    if (montoFacturado - maximoAsociable > EPS) {
      return res.status(400).json({
        ok: false,
        message: "El monto asociado excede el máximo permitido",
        data: {
          subtotal_facturado: toMoneyString(subtotalFacturado),
          impuestos_facturado: toMoneyString(impuestosFacturado),
          monto_facturado: toMoneyString(montoFacturado),
          total_factura: toMoneyString(totalFactura),
          monto_solicitado: toMoneyString(montoSolicitado),
          disponible_factura: toMoneyString(disponibleFactura),
          disponible_solicitud: toMoneyString(disponibleSolicitud),
          maximo_asociable: toMoneyString(maximoAsociable),
        },
      });
    }

    // 7) Insert / Update pagos_facturas_proveedores
    let idRelacion = null;

    if (relacionExistente?.id) {
      await executeQuery(
        `
        UPDATE pagos_facturas_proveedores
        SET
          id_pago_proveedor = ?,
          subtotal_facturado = ?,
          impuestos_facturado = ?,
          monto_facturado = ?,
          monto_pago = ?
        WHERE id = ?
        LIMIT 1;
        `,
        [
          idPagoProveedor,
          toMoneyString(subtotalFacturado),
          toMoneyString(impuestosFacturado),
          toMoneyString(montoFacturado),
          toMoneyString(montoPagoFinal),
          Number(relacionExistente.id),
        ],
      );

      idRelacion = Number(relacionExistente.id);
    } else {
      const qInsert = `
        INSERT INTO pagos_facturas_proveedores (
          id_pago_proveedor,
          id_solicitud,
          id_factura,
          subtotal_facturado,
          impuestos_facturado,
          monto_facturado,
          monto_pago
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
      `;

      const insertResult = await executeQuery(qInsert, [
        idPagoProveedor,
        idSolicitud,
        idFactura,
        toMoneyString(subtotalFacturado),
        toMoneyString(impuestosFacturado),
        toMoneyString(montoFacturado),
        toMoneyString(montoPagoFinal),
      ]);

      idRelacion = insertResult?.insertId ?? null;
    }

    // 8) Recalcular solicitud
    const qRecalcSolicitud = `
      SELECT
        COALESCE(
          SUM(
            CAST(COALESCE(NULLIF(TRIM(monto_facturado), ''), '0') AS DECIMAL(12,2))
          ),
          0
        ) AS total_facturado_real
      FROM pagos_facturas_proveedores
      WHERE id_solicitud = ?;
    `;

    const recalcRows = getRows(
      await executeQuery(qRecalcSolicitud, [idSolicitud]),
    );
    const nuevoMontoFacturado = round2(
      recalcRows?.[0]?.total_facturado_real ?? 0,
    );
    const nuevoMontoPorFacturar = Math.max(
      0,
      round2(montoSolicitado - nuevoMontoFacturado),
    );

    let nuevoEstadoFacturacion = "pendiente";
    if (nuevoMontoPorFacturar <= EPS && nuevoMontoFacturado > EPS) {
      nuevoEstadoFacturacion = "completado";
    } else if (nuevoMontoFacturado > EPS) {
      nuevoEstadoFacturacion = "parcial";
    }

    await executeQuery(
      `
      UPDATE solicitudes_pago_proveedor
      SET
        monto_facturado = ?,
        monto_por_facturar = ?,
        estado_facturacion = ?
      WHERE id_solicitud_proveedor = ?
      LIMIT 1;
      `,
      [
        toMoneyString(nuevoMontoFacturado),
        toMoneyString(nuevoMontoPorFacturar),
        nuevoEstadoFacturacion,
        idSolicitud,
      ],
    );

    const updatedSolicitudRows = getRows(
      await executeQuery(
        `
        SELECT *
        FROM solicitudes_pago_proveedor
        WHERE id_solicitud_proveedor = ?
        LIMIT 1;
        `,
        [idSolicitud],
      ),
    );

    return res.status(200).json({
      ok: true,
      message: "Monto asociado correctamente",
      data: {
        id_relacion: idRelacion,
        id_solicitud_proveedor: idSolicitud,
        id_factura_proveedor: idFactura,
        uuid_factura: uuidFacturaReal,
        subtotal_facturado: toMoneyString(subtotalFacturado),
        impuestos_facturado: toMoneyString(impuestosFacturado),
        monto_facturado: toMoneyString(montoFacturado),
        disponible_factura: toMoneyString(
          Math.max(0, round2(disponibleFactura - montoFacturado)),
        ),
        disponible_solicitud: toMoneyString(
          Math.max(0, round2(disponibleSolicitud - montoFacturado)),
        ),
        solicitud_actualizada: updatedSolicitudRows?.[0] ?? null,
      },
    });
  } catch (error) {
    console.error("Error en monto_factura:", error);
    return res.status(500).json({
      ok: false,
      error: "Error en el servidor",
      details: error?.sqlMessage || error?.message || error,
    });
  }
};

// controllers/pago_proveedor.js (o donde lo tengas)
const Detalles = async (req, res) => {
  try {
    const { id_solicitud_proveedor, id_proveedor, id_facturas, id_pagos } =
      req.body || {};

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
    // 2) Helpers
    // -----------------------------
    const safeString = (v) => String(v ?? "").trim();

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

    const getRows = (result) =>
      Array.isArray(result) ? result : (result?.[0] ?? []);

    const uniq = (arr) => [...new Set(arr.filter(Boolean))];

    const toNum = (v) => {
      const n = Number(String(v ?? "").trim());
      return Number.isFinite(n) ? n : 0;
    };

    let facturasArr = normalizeArray(id_facturas)
      .map((x) => safeString(x))
      .filter(Boolean);

    let pagosArr = normalizeArray(id_pagos)
      .map((x) => safeString(x))
      .filter(Boolean);

    // -----------------------------
    // 3) Traer info base de solicitud
    // -----------------------------
    const solicitudSql = `
      SELECT *
      FROM solicitudes_pago_proveedor
      WHERE id_solicitud_proveedor = ?;
    `;

    const solicitudRows = getRows(
      await executeQuery(solicitudSql, [Number(id_solicitud_proveedor)]),
    );

    const solicitud = solicitudRows?.[0] || null;

    if (!solicitud) {
      return res.status(404).json({
        ok: false,
        error: "No se encontró la solicitud",
      });
    }

    // =========================================================
    // 4) CONSULTA RAW: pagos_facturas_proveedores
    // =========================================================
    let pfp = [];
    {
      const where = [];
      const params = [];

      where.push(`id_solicitud = ?`);
      params.push(Number(id_solicitud_proveedor));

      if (pagosArr.length > 0) {
        const ph = pagosArr.map(() => "?").join(",");
        where.push(`id_pago_proveedor IN (${ph})`);
        params.push(...pagosArr.map((x) => Number(x)));
      }

      if (facturasArr.length > 0) {
        const ph = facturasArr.map(() => "?").join(",");
        where.push(`id_factura IN (${ph})`);
        params.push(...facturasArr);
      }

      const pfpSql = `
        SELECT *
        FROM pagos_facturas_proveedores
        WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC, id DESC;
      `;

      pfp = getRows(await executeQuery(pfpSql, params));
    }

    // =========================================================
    // 5) PAGOS
    // =========================================================
    let pagos = [];
    {
      const pagosSql = `
        SELECT *
        FROM pago_proveedores
        WHERE id_solicitud_proveedor = ?
        ORDER BY COALESCE(fecha_pago, fecha_emision) DESC, id_pago_proveedores DESC;
      `;

      pagos = getRows(
        await executeQuery(pagosSql, [Number(id_solicitud_proveedor)]),
      );

      if (pagosArr.length > 0) {
        const pagosSet = new Set(pagosArr.map((x) => safeString(x)));
        pagos = pagos.filter((p) =>
          pagosSet.has(safeString(p?.id_pago_proveedores)),
        );
      }
    }

    // =========================================================
    // 6) FACTURAS
    // =========================================================
    const facturaIdsDesdePfp = Array.isArray(pfp)
      ? pfp.map((r) => safeString(r?.id_factura)).filter(Boolean)
      : [];

    const facturaIdsDesdePagos = Array.isArray(pagos)
      ? pagos.map((r) => safeString(r?.id_factura)).filter(Boolean)
      : [];

    const facturaIdsFinales = uniq([
      ...facturasArr,
      ...facturaIdsDesdePfp,
      ...facturaIdsDesdePagos,
    ]);

    let facturas = [];

    if (facturaIdsFinales.length > 0) {
      const placeholders = facturaIdsFinales.map(() => "?").join(",");

      const facturasSql = `
        SELECT *
        FROM facturas_pago_proveedor
        WHERE id_factura_proveedor IN (${placeholders})
           OR id_solicitud_proveedor = ?
        ORDER BY COALESCE(fecha_factura, fecha_emision) DESC, created_at DESC;
      `;

      facturas = getRows(
        await executeQuery(facturasSql, [
          ...facturaIdsFinales,
          Number(id_solicitud_proveedor),
        ]),
      );
    } else {
      const facturasSql = `
        SELECT *
        FROM facturas_pago_proveedor
        WHERE id_solicitud_proveedor = ?
        ORDER BY COALESCE(fecha_factura, fecha_emision) DESC, created_at DESC;
      `;

      facturas = getRows(
        await executeQuery(facturasSql, [Number(id_solicitud_proveedor)]),
      );
    }

    // Dedupe por PK real
    {
      const map = new Map();
      for (const f of facturas) {
        const id = safeString(f?.id_factura_proveedor);
        if (id) map.set(id, f);
      }
      facturas = Array.from(map.values());
    }

    // Normalizar URLs
    facturas = facturas.map((f) => ({
      ...f,
      url_pdf: safeString(f?.url_pdf) || null,
      url_xml: safeString(f?.url_xml) || null,
    }));

    pagos = pagos.map((p) => ({
      ...p,
      url_pdf: safeString(p?.url_pdf) || null,
    }));

    // =========================================================
    // 7) Si venían vacíos, rellenar ids
    // =========================================================
    if (facturasArr.length === 0) {
      facturasArr = facturas
        .map((f) => safeString(f?.id_factura_proveedor))
        .filter(Boolean);
    }

    if (pagosArr.length === 0) {
      pagosArr = pagos
        .map((p) => safeString(p?.id_pago_proveedores))
        .filter(Boolean);
    }

    // =========================================================
    // 8) ANÁLISIS DESDE LA VISTA
    //    vw_pagos_facturas_proveedores_detalle
    // =========================================================
    const monto_solicitado = toNum(solicitud?.monto_solicitado);

    const facturaIdsResponse = facturas
      .map((f) => safeString(f?.id_factura_proveedor))
      .filter(Boolean);

    let totalAsociadoSolicitud = 0;
    let detalleAgrupadoFacturas = [];
    let detalleFacturasMap = new Map();

    // 8.1 Total asociado de toda la solicitud
    {
      const totalSolicitudSql = `
        SELECT
          COALESCE(
            SUM(
              CAST(COALESCE(NULLIF(v.monto_facturado, ''), '0') AS DECIMAL(12,2))
            ),
            0
          ) AS total_asociado_solicitud
        FROM vw_pagos_facturas_proveedores_detalle v
        WHERE v.id_solicitud = ?;
      `;

      const totalSolicitudRows = getRows(
        await executeQuery(totalSolicitudSql, [Number(id_solicitud_proveedor)]),
      );

      totalAsociadoSolicitud = toNum(
        totalSolicitudRows?.[0]?.total_asociado_solicitud,
      );
    }

    // 8.2 Total asociado por factura para las facturas de la respuesta
    if (facturaIdsResponse.length > 0) {
      const phFacturas = facturaIdsResponse.map(() => "?").join(",");

      const detalleVistaSql = `
        SELECT
          v.id_solicitud,
          v.id_factura AS id_factura_proveedor,
          MAX(
            CAST(COALESCE(NULLIF(v.total, ''), '0') AS DECIMAL(12,2))
          ) AS total_factura,
          MAX(
            CAST(COALESCE(NULLIF(v.monto_solicitado, ''), '0') AS DECIMAL(12,2))
          ) AS monto_solicitado,
          COALESCE(
            SUM(
              CAST(COALESCE(NULLIF(v.monto_facturado, ''), '0') AS DECIMAL(12,2))
            ),
            0
          ) AS total_asociado_factura
        FROM vw_pagos_facturas_proveedores_detalle v
        WHERE v.id_solicitud = ?
          AND v.id_factura IN (${phFacturas})
        GROUP BY v.id_solicitud, v.id_factura
        ORDER BY v.id_factura;
      `;

      detalleAgrupadoFacturas = getRows(
        await executeQuery(detalleVistaSql, [
          Number(id_solicitud_proveedor),
          ...facturaIdsResponse,
        ]),
      );

      detalleFacturasMap = new Map(
        detalleAgrupadoFacturas.map((r) => [
          safeString(r?.id_factura_proveedor),
          {
            total_factura: toNum(r?.total_factura),
            total_asociado_factura: toNum(r?.total_asociado_factura),
            monto_solicitado: toNum(r?.monto_solicitado),
          },
        ]),
      );
    }

    const restante_solicitud = Math.max(
      0,
      Number((monto_solicitado - totalAsociadoSolicitud).toFixed(2)),
    );

    // =========================================================
    // 9) ENRIQUECER FACTURAS CON TOPES
    //    maximo_a_asociar = menor entre:
    //    - restante de la factura
    //    - restante de la solicitud
    // =========================================================
    facturas = facturas.map((f) => {
      const idFactura = safeString(f?.id_factura_proveedor);
      const detalle = detalleFacturasMap.get(idFactura) || null;

      const total_factura = toNum(
        f?.total ?? detalle?.total_factura ?? f?.monto_facturado,
      );

      const total_asociado_factura = toNum(detalle?.total_asociado_factura);

      const restante_factura = Math.max(
        0,
        Number((total_factura - total_asociado_factura).toFixed(2)),
      );

      const maximo_a_asociar = Number(
        Math.min(restante_factura, restante_solicitud).toFixed(2),
      );

      return {
        ...f,
        total_factura: Number(total_factura.toFixed(2)),
        total_asociado_factura: Number(total_asociado_factura.toFixed(2)),
        restante_factura,
        maximo_a_asociar,
      };
    });

    // =========================================================
    // 10) RESUMEN VALIDACIÓN
    // =========================================================
    const total_pagado = Array.isArray(pagos)
      ? pagos.reduce(
          (acc, p) => acc + toNum(p?.monto_pagado ?? p?.monto ?? p?.total),
          0,
        )
      : 0;

    const total_facturado = Array.isArray(facturas)
      ? facturas.reduce((acc, f) => acc + toNum(f?.total_factura), 0)
      : 0;

    const resumen_validacion = {
      monto_solicitado: Number(monto_solicitado.toFixed(2)),
      total_asociado_solicitud: Number(totalAsociadoSolicitud.toFixed(2)),
      restante_solicitud: Number(restante_solicitud.toFixed(2)),
      total_pagado: Number(total_pagado.toFixed(2)),
      total_facturado: Number(total_facturado.toFixed(2)),
      diferencia_total: Number((total_pagado - total_facturado).toFixed(2)),
      por_factura: facturas.map((f) => ({
        id_factura_proveedor: safeString(f?.id_factura_proveedor),
        total_factura: toNum(f?.total_factura),
        total_asociado_factura: toNum(f?.total_asociado_factura),
        restante_factura: toNum(f?.restante_factura),
        maximo_a_asociar: toNum(f?.maximo_a_asociar),
      })),
    };

    // =========================================================
    // 11) Response
    // =========================================================
    return res.status(200).json({
      ok: true,
      message: "Detalles obtenidos correctamente",
      request: {
        id_solicitud_proveedor: safeString(id_solicitud_proveedor),
        id_proveedor: safeString(id_proveedor),
        id_facturas: facturasArr,
        id_pagos: pagosArr,
      },
      data: {
        solicitud,
        facturas,
        pagos,
        pagos_facturas_proveedores: pfp,
        detalle_facturas_agrupado: detalleAgrupadoFacturas,
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

const consultar_facturado = async (req, res) => {
  try {
    // ------------------------------------------------
    // 1) Helpers
    // ------------------------------------------------
    const safeString = (v) => String(v ?? "").trim();

    const normalizeArray = (v) => {
      if (!v) return [];

      if (Array.isArray(v)) {
        return v;
      }

      if (typeof v === "string") {
        const s = v.trim();
        if (!s) return [];

        // intentar JSON
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed;
          return [parsed];
        } catch (_) {
          // si viene separado por comas
          if (s.includes(",")) {
            return s
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
          }
          return [s];
        }
      }

      return [v];
    };

    const getRows = (result) =>
      Array.isArray(result) ? result : (result?.[0] ?? []);

    const uniq = (arr) => [...new Set(arr.filter(Boolean))];

    const toNum = (v) => {
      const n = Number(String(v ?? "").trim());
      return Number.isFinite(n) ? n : 0;
    };

    // ------------------------------------------------
    // 2) Recibir ids
    //    soporta:
    //    - req.query.id_solicitud
    //    - req.body.id_solicitud
    //    - req.body.ids_solicitud
    // ------------------------------------------------
    const rawIds =
      req.query?.id_solicitud ??
      req.body?.id_solicitud ??
      req.body?.ids_solicitud;

    let idsSolicitud = normalizeArray(rawIds)
      .map((x) => safeString(x))
      .filter(Boolean);

    idsSolicitud = uniq(idsSolicitud);

    // si tus ids son numéricos, limpiamos solo numéricos válidos
    const idsNumericos = idsSolicitud
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);

    if (idsNumericos.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Debes enviar al menos un id_solicitud válido",
      });
    }

    // ------------------------------------------------
    // 3) Query principal
    //    Base: solicitudes_pago_proveedor
    //    Suma de facturado: vista agrupada
    // ------------------------------------------------
    const placeholdersVista = idsNumericos.map(() => "?").join(",");
    const placeholdersSolicitudes = idsNumericos.map(() => "?").join(",");

    const sql = `
      SELECT
        spp.id_solicitud_proveedor AS id_solicitud,
        COALESCE(spp.monto_solicitado, 0) AS monto_solicitado,
        COALESCE(vpf.total_facturado, 0) AS total_facturado,
        ROUND(
          COALESCE(spp.monto_solicitado, 0) - COALESCE(vpf.total_facturado, 0),
          2
        ) AS diferencia,
        ROUND(
          GREATEST(
            COALESCE(spp.monto_solicitado, 0) - COALESCE(vpf.total_facturado, 0),
            0
          ),
          2
        ) AS maximo_asignar
      FROM solicitudes_pago_proveedor spp
      LEFT JOIN (
        SELECT
          id_solicitud,
          SUM(COALESCE(monto_facturado, 0)) AS total_facturado
        FROM vw_pagos_facturas_proveedores_detalle
        WHERE id_solicitud IN (${placeholdersVista})
        GROUP BY id_solicitud
      ) vpf
        ON vpf.id_solicitud = spp.id_solicitud_proveedor
      WHERE spp.id_solicitud_proveedor IN (${placeholdersSolicitudes})
      ORDER BY spp.id_solicitud_proveedor ASC;
    `;

    const rows = getRows(
      await executeQuery(sql, [...idsNumericos, ...idsNumericos]),
    );

    // ------------------------------------------------
    // 4) Normalizar respuesta
    // ------------------------------------------------
    const data = rows.map((row) => {
      const monto_solicitado = Number(toNum(row?.monto_solicitado).toFixed(2));
      const total_facturado = Number(toNum(row?.total_facturado).toFixed(2));
      const diferencia = Number(
        (monto_solicitado - total_facturado).toFixed(2),
      );
      const maximo_asignar = Number(Math.max(diferencia, 0).toFixed(2));

      return {
        id_solicitud: safeString(row?.id_solicitud),
        monto_solicitado,
        total_facturado,
        diferencia,
        maximo_asignar,
      };
    });

    // por si quieres acceso rápido por id en front
    const data_by_id = data.reduce((acc, item) => {
      acc[item.id_solicitud] = item;
      return acc;
    }, {});

    // resumen general opcional
    const resumen = {
      total_solicitudes: data.length,
      monto_solicitado_total: Number(
        data.reduce((acc, x) => acc + toNum(x.monto_solicitado), 0).toFixed(2),
      ),
      total_facturado_total: Number(
        data.reduce((acc, x) => acc + toNum(x.total_facturado), 0).toFixed(2),
      ),
      maximo_asignar_total: Number(
        data.reduce((acc, x) => acc + toNum(x.maximo_asignar), 0).toFixed(2),
      ),
    };

    return res.status(200).json({
      ok: true,
      message: "Montos facturados consultados correctamente",
      request: {
        id_solicitud: idsNumericos,
      },
      data,
      data_by_id,
      resumen,
    });
  } catch (error) {
    console.error("Error en consultar_facturado:", error);
    return res.status(500).json({
      ok: false,
      error: "Error en el servidor",
      details: error?.message ?? error,
    });
  }
};

const Uuid = async (req, res) => {
  try {
    const { uuid } = req.query || {};

    // -----------------------------
    // Helpers
    // -----------------------------
    const safeString = (v) => String(v ?? "").trim();

    const getRows = (result) =>
      Array.isArray(result) ? result : (result?.[0] ?? []);

    const uuidBuscado = safeString(uuid).toUpperCase();

    // -----------------------------
    // Validación mínima
    // -----------------------------
    if (!uuidBuscado) {
      return res.status(400).json({
        ok: false,
        error: "Falta uuid en query params",
      });
    }

    // -----------------------------
    // Consulta
    // OJO: en tu tabla el campo parece ser uuid_cfdi
    // si realmente tu columna se llama `uuid`, cambia uuid_cfdi por uuid
    // -----------------------------
    const sql = `
      SELECT *
      FROM vw_saldos_facturas_proveedores
      WHERE uuid_factura = ?
      LIMIT 1;
    `;

    const rows = getRows(await executeQuery(sql, [uuidBuscado]));
    const factura = rows?.[0] || null;

    if (!factura) {
      return res.status(404).json({
        ok: false,
        error: "No se encontró ninguna factura con ese uuid",
        request: {
          uuid: uuidBuscado,
        },
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Factura obtenida correctamente",
      request: {
        uuid: uuidBuscado,
      },
      data: factura,
    });
  } catch (error) {
    console.error("Error en buscarFacturaPorUuid:", error);
    return res.status(500).json({
      ok: false,
      error: "Error en el servidor",
      details: error?.message ?? error,
    });
  }
};

const eliminarFactura = async (req, res) => {
  try {
    const payloadRaw = req.body;

    // -----------------------------
    // Helpers
    // -----------------------------
    const safeString = (v) => String(v ?? "").trim();

    const getRows = (result) =>
      Array.isArray(result) ? result : (result?.[0] ?? []);

    const toNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
    };

    const items = Array.isArray(payloadRaw) ? payloadRaw : [payloadRaw];

    // -----------------------------
    // Validación mínima
    // -----------------------------
    if (!items.length) {
      return res.status(400).json({
        ok: false,
        error: "No se recibió información para eliminar la factura",
      });
    }

    for (const item of items) {
      const idSolicitud = safeString(item?.id_solicitud_proveedor);
      const idFactura = safeString(item?.id_factura_proveedor);
      const uuidFactura = safeString(item?.uuid_factura).toUpperCase();

      if (!idSolicitud || !idFactura) {
        return res.status(400).json({
          ok: false,
          error:
            "Cada elemento debe contener id_solicitud_proveedor e id_factura_proveedor",
          request: item,
        });
      }

      if (!uuidFactura) {
        return res.status(400).json({
          ok: false,
          error: "Cada elemento debe contener uuid_factura",
          request: item,
        });
      }
    }

    const resultados = [];

    for (const item of items) {
      const idSolicitud = safeString(item?.id_solicitud_proveedor);
      const idFactura = safeString(item?.id_factura_proveedor);
      const uuidFactura = safeString(item?.uuid_factura).toUpperCase();

      // -----------------------------
      // 1) Validar que exista la factura
      // -----------------------------
      const sqlFactura = `
        SELECT
          id_factura_proveedor,
          uuid_cfdi,
          saldo_x_aplicar_items
        FROM facturas_pago_proveedor
        WHERE TRIM(id_factura_proveedor) = ?
          AND UPPER(TRIM(uuid_cfdi)) = ?
        LIMIT 1;
      `;

      const facturaRows = getRows(
        await executeQuery(sqlFactura, [idFactura, uuidFactura]),
      );
      const factura = facturaRows?.[0] || null;

      if (!factura) {
        return res.status(404).json({
          ok: false,
          error: `No se encontró la factura ${idFactura} con uuid ${uuidFactura}`,
          request: {
            id_solicitud_proveedor: idSolicitud,
            id_factura_proveedor: idFactura,
            uuid_factura: uuidFactura,
          },
        });
      }

      // -----------------------------
      // 2) Buscar relación y guardar monto_facturado
      // -----------------------------
      const sqlRelacion = `
        SELECT
          TRIM(id_solicitud) AS id_solicitud,
          TRIM(id_factura) AS id_factura,
          ROUND(
            SUM(
              CAST(
                COALESCE(NULLIF(TRIM(monto_facturado), ''), '0') AS DECIMAL(12,2)
              )
            ),
            2
          ) AS monto_facturado_total,
          COUNT(*) AS total_relaciones
        FROM pagos_facturas_proveedores
        WHERE TRIM(id_solicitud) = ?
          AND TRIM(id_factura) = ?
        GROUP BY TRIM(id_solicitud), TRIM(id_factura)
        LIMIT 1;
      `;

      const relacionRows = getRows(
        await executeQuery(sqlRelacion, [idSolicitud, idFactura]),
      );
      const relacion = relacionRows?.[0] || null;

      if (!relacion) {
        return res.status(404).json({
          ok: false,
          error: `No existe relación en pagos_facturas_proveedores para id_solicitud=${idSolicitud} e id_factura=${idFactura}`,
          request: {
            id_solicitud_proveedor: idSolicitud,
            id_factura_proveedor: idFactura,
            uuid_factura: uuidFactura,
          },
        });
      }

      const montoFacturado = toNumber(relacion.monto_facturado_total);

      if (montoFacturado <= 0) {
        return res.status(400).json({
          ok: false,
          error: `El monto_facturado encontrado para la relación solicitud=${idSolicitud} factura=${idFactura} es inválido`,
          request: {
            id_solicitud_proveedor: idSolicitud,
            id_factura_proveedor: idFactura,
            uuid_factura: uuidFactura,
          },
          data: relacion,
        });
      }

      // -----------------------------
      // 3) Borrar relación en pagos_facturas_proveedores
      // -----------------------------
      const sqlDeleteRelacion = `
        DELETE FROM pagos_facturas_proveedores
        WHERE TRIM(id_solicitud) = ?
          AND TRIM(id_factura) = ?;
      `;

      const deleteResult = await executeQuery(sqlDeleteRelacion, [
        idSolicitud,
        idFactura,
      ]);

      if (!deleteResult?.affectedRows) {
        return res.status(400).json({
          ok: false,
          error:
            "No se pudo eliminar la relación en pagos_facturas_proveedores",
          request: {
            id_solicitud_proveedor: idSolicitud,
            id_factura_proveedor: idFactura,
            uuid_factura: uuidFactura,
          },
        });
      }

      // -----------------------------
      // 4) Regresar saldo a la factura
      // saldo_x_aplicar_items += monto_facturado
      // -----------------------------
      const sqlUpdateFactura = `
        UPDATE facturas_pago_proveedor
        SET saldo_x_aplicar_items = ROUND(
          CAST(
            COALESCE(NULLIF(TRIM(saldo_x_aplicar_items), ''), '0') AS DECIMAL(12,2)
          ) + ?,
          2
        )
        WHERE TRIM(id_factura_proveedor) = ?
          AND UPPER(TRIM(uuid_cfdi)) = ?;
      `;

      const updateFacturaResult = await executeQuery(sqlUpdateFactura, [
        montoFacturado,
        idFactura,
        uuidFactura,
      ]);

      if (!updateFacturaResult?.affectedRows) {
        return res.status(400).json({
          ok: false,
          error:
            "No se pudo actualizar saldo_x_aplicar_items en facturas_pago_proveedor",
          request: {
            id_solicitud_proveedor: idSolicitud,
            id_factura_proveedor: idFactura,
            uuid_factura: uuidFactura,
          },
        });
      }

      // -----------------------------
      // 5) Ajustar la solicitud
      // monto_facturado -= monto_facturado
      // monto_por_facturar += monto_facturado
      // -----------------------------
      const sqlUpdateSolicitud = `
        UPDATE solicitudes_pago_proveedor
        SET
          monto_facturado = ROUND(
            GREATEST(
              CAST(
                COALESCE(NULLIF(TRIM(monto_facturado), ''), '0') AS DECIMAL(12,2)
              ) - ?,
              0
            ),
            2
          ),
          monto_por_facturar = ROUND(
            CAST(
              COALESCE(NULLIF(TRIM(monto_por_facturar), ''), '0') AS DECIMAL(12,2)
            ) + ?,
            2
          )
        WHERE TRIM(id_solicitud_proveedor) = ?;
      `;

      const updateSolicitudResult = await executeQuery(sqlUpdateSolicitud, [
        montoFacturado,
        montoFacturado,
        idSolicitud,
      ]);

      if (!updateSolicitudResult?.affectedRows) {
        return res.status(400).json({
          ok: false,
          error:
            "No se pudo actualizar la solicitud en solicitudes_pago_proveedor",
          request: {
            id_solicitud_proveedor: idSolicitud,
            id_factura_proveedor: idFactura,
            uuid_factura: uuidFactura,
          },
        });
      }

      // -----------------------------
      // 6) Consultar datos finales
      // -----------------------------
      const sqlResumenSolicitud = `
        SELECT
          id_solicitud_proveedor,
          monto_facturado,
          monto_por_facturar
        FROM solicitudes_pago_proveedor
        WHERE TRIM(id_solicitud_proveedor) = ?
        LIMIT 1;
      `;

      const sqlResumenFactura = `
        SELECT
          id_factura_proveedor,
          uuid_cfdi,
          saldo_x_aplicar_items
        FROM facturas_pago_proveedor
        WHERE TRIM(id_factura_proveedor) = ?
          AND UPPER(TRIM(uuid_cfdi)) = ?
        LIMIT 1;
      `;

      const solicitudRows = getRows(
        await executeQuery(sqlResumenSolicitud, [idSolicitud]),
      );
      const facturaFinalRows = getRows(
        await executeQuery(sqlResumenFactura, [idFactura, uuidFactura]),
      );

      resultados.push({
        request: {
          id_solicitud_proveedor: idSolicitud,
          id_factura_proveedor: idFactura,
          uuid_factura: uuidFactura,
        },
        monto_facturado_eliminado: montoFacturado,
        solicitud_actualizada: solicitudRows?.[0] || null,
        factura_actualizada: facturaFinalRows?.[0] || null,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Factura y relaciones eliminadas correctamente",
      total_procesados: resultados.length,
      results: resultados,
    });
  } catch (error) {
    console.error("Error en eliminarFactura:", error);
    return res.status(500).json({
      ok: false,
      error: "Error al eliminar la factura",
      details: error?.message ?? error,
    });
  }
};

const asignar_factura_previa = async (req, res) => {
  try {
    const { uuid_cfdi, proveedoresData } = req.body;

    const EPS = 0.01;

    const getRows = (result) =>
      Array.isArray(result) ? result : (result?.[0] ?? []);

    const safeString = (v) => String(v ?? "").trim();

    const toNumber = (v) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };

    const round2 = (n) => Number(Number(n || 0).toFixed(2));
    const toMoneyString = (n) => round2(n).toFixed(2);

    const uuid = safeString(uuid_cfdi);

    if (!uuid) {
      return res.status(400).json({
        ok: false,
        message: "uuid_cfdi es requerido",
      });
    }

    const proveedores = Array.isArray(proveedoresData)
      ? proveedoresData
      : proveedoresData
        ? [proveedoresData]
        : [];

    if (!proveedores.length) {
      return res.status(400).json({
        ok: false,
        message:
          "proveedoresData es requerido y debe contener al menos una solicitud",
      });
    }

    // 1) Buscar factura
    const qFactura = `
      SELECT
        fpp.id_factura_proveedor AS id_factura,
        fpp.uuid_cfdi AS uuid_factura,
        fpp.id_agente AS id_proveedor_factura,
        CAST(COALESCE(NULLIF(TRIM(fpp.total), ''), '0') AS DECIMAL(12,2)) AS total_factura,
        CAST(COALESCE(NULLIF(TRIM(fpp.subtotal), ''), '0') AS DECIMAL(12,2)) AS subtotal_factura,
        CAST(COALESCE(NULLIF(TRIM(fpp.impuestos), ''), '0') AS DECIMAL(12,2)) AS impuestos_factura,
        CAST(COALESCE(NULLIF(TRIM(fpp.saldo_x_aplicar_items), ''), '0') AS DECIMAL(12,2)) AS saldo_x_aplicar_items
      FROM facturas_pago_proveedor fpp
      WHERE TRIM(fpp.uuid_cfdi) = TRIM(?)
      LIMIT 1;
    `;

    const facturaRows = getRows(await executeQuery(qFactura, [uuid]));

    if (!facturaRows.length) {
      return res.status(404).json({
        ok: false,
        message: "No se encontró la factura",
      });
    }
const cacheRazonesSociales = new Map();

const obtenerRazonesSocialesProveedor = async (idProveedor) => {
  const id = safeString(idProveedor);
  if (!id) return [];

  if (cacheRazonesSociales.has(id)) {
    return cacheRazonesSociales.get(id);
  }

  const qRazones = `
    SELECT DISTINCT
      UPPER(TRIM(pdfr.razon_social)) AS razon_social
    FROM proveedores_datos_fiscales_relacion pdfr
    WHERE TRIM(pdfr.id_proveedor) = TRIM(?)
      AND TRIM(COALESCE(pdfr.razon_social, '')) <> '';
  `;

  const rows = getRows(await executeQuery(qRazones, [id]));
  const razones = rows
    .map((row) => safeString(row?.razon_social).toUpperCase())
    .filter(Boolean);

  cacheRazonesSociales.set(id, razones);
  return razones;
};

const compartenRazonSocial = async (idProveedorA, idProveedorB) => {
  const idA = safeString(idProveedorA);
  const idB = safeString(idProveedorB);

  if (!idA || !idB) return false;
  if (idA === idB) return true;

  const [razonesA, razonesB] = await Promise.all([
    obtenerRazonesSocialesProveedor(idA),
    obtenerRazonesSocialesProveedor(idB),
  ]);

  if (!razonesA.length || !razonesB.length) return false;

  const setB = new Set(razonesB);
  return razonesA.some((razon) => setB.has(razon));
};
    const factura = facturaRows[0];
    const idFactura = safeString(factura.id_factura);
    const uuidFacturaReal = safeString(factura.uuid_factura);
    const idProveedorFactura = safeString(factura.id_proveedor_factura);

    const totalFactura = round2(factura.total_factura ?? 0);
    const subtotalFactura = round2(factura.subtotal_factura ?? 0);
    const impuestosFactura = round2(factura.impuestos_factura ?? 0);

    if (!idFactura) {
      return res.status(400).json({
        ok: false,
        message: "La factura encontrada no tiene id_factura_proveedor válido",
      });
    }

    if (!(totalFactura > 0)) {
      return res.status(400).json({
        ok: false,
        message: "La factura tiene total inválido o igual a 0",
      });
    }

    // 2) Validar proveedor del payload contra factura por razón social
for (const item of proveedores) {
  const idProveedorPayload = safeString(item?.id_proveedor);

  if (idProveedorPayload && idProveedorFactura) {
    const coincideProveedor = await compartenRazonSocial(
      idProveedorFactura,
      idProveedorPayload
    );

    if (!coincideProveedor) {
      const [razonesFactura, razonesPayload] = await Promise.all([
        obtenerRazonesSocialesProveedor(idProveedorFactura),
        obtenerRazonesSocialesProveedor(idProveedorPayload),
      ]);

      return res.status(400).json({
        ok: false,
        message:
          "El proveedor del payload no coincide con la factura ni comparte una razón social fiscal.",
        data: {
          proveedor_factura: idProveedorFactura,
          proveedor_payload: idProveedorPayload,
          razones_sociales_factura: razonesFactura,
          razones_sociales_payload: razonesPayload,
        },
      });
    }
  }
}

    // 3) Total solicitado en esta operación
    const totalOperacion = round2(
      proveedores.reduce((acc, item) => {
        return acc + round2(toNumber(item?.monto_asociar));
      }, 0),
    );

    if (totalOperacion <= EPS) {
      return res.status(400).json({
        ok: false,
        message: "El total a asignar debe ser mayor a 0",
      });
    }

    const resultados = [];

    const ratioSubtotal = totalFactura > 0 ? subtotalFactura / totalFactura : 0;
    const ratioImpuestos =
      totalFactura > 0 ? impuestosFactura / totalFactura : 0;

    // 4) Procesar cada solicitud
    for (const item of proveedores) {
      const idSolicitud = Number(item?.id_solicitud);
      const montoAsociar = round2(toNumber(item?.monto_asociar));
      const montoSolicitadoPayload = round2(toNumber(item?.monto_solicitado));

      if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        return res.status(400).json({
          ok: false,
          message: "id_solicitud inválido en proveedoresData",
          data: item,
        });
      }

      if (!(montoAsociar > 0)) {
        return res.status(400).json({
          ok: false,
          message: `El monto_asociar de la solicitud ${idSolicitud} debe ser mayor a 0`,
        });
      }

      // 4.1 Buscar solicitud
      const qSolicitud = `
        SELECT
          spp.id_solicitud_proveedor,
          spp.id_proveedor,
          CAST(COALESCE(NULLIF(TRIM(spp.monto_solicitado), ''), '0') AS DECIMAL(12,2)) AS monto_solicitado,
          CAST(COALESCE(NULLIF(TRIM(spp.monto_facturado), ''), '0') AS DECIMAL(12,2)) AS monto_facturado_actual,
          CAST(COALESCE(NULLIF(TRIM(spp.monto_por_facturar), ''), '0') AS DECIMAL(12,2)) AS monto_por_facturar_actual
        FROM solicitudes_pago_proveedor spp
        WHERE spp.id_solicitud_proveedor = ?
        LIMIT 1;
      `;

      const solicitudRows = getRows(
        await executeQuery(qSolicitud, [idSolicitud]),
      );

      if (!solicitudRows.length) {
        return res.status(404).json({
          ok: false,
          message: `No se encontró la solicitud ${idSolicitud}`,
        });
      }

      const solicitud = solicitudRows[0];
      const idProveedorSolicitud = safeString(solicitud.id_proveedor);
      const montoSolicitadoDB = round2(solicitud.monto_solicitado ?? 0);
      const montoFacturadoActual = round2(
        solicitud.monto_facturado_actual ?? 0,
      );
      const montoPorFacturarActual = round2(
        solicitud.monto_por_facturar_actual ?? 0,
      );

     if (idProveedorFactura && idProveedorSolicitud) {
  const coincideProveedorSolicitud = await compartenRazonSocial(
    idProveedorFactura,
    idProveedorSolicitud
  );

  if (!coincideProveedorSolicitud) {
    const [razonesFactura, razonesSolicitud] = await Promise.all([
      obtenerRazonesSocialesProveedor(idProveedorFactura),
      obtenerRazonesSocialesProveedor(idProveedorSolicitud),
    ]);

    return res.status(400).json({
      ok: false,
      message: `La solicitud ${idSolicitud} no pertenece al proveedor de la factura ni comparte una razón social fiscal.`,
      data: {
        proveedor_factura: idProveedorFactura,
        proveedor_solicitud: idProveedorSolicitud,
        razones_sociales_factura: razonesFactura,
        razones_sociales_solicitud: razonesSolicitud,
      },
    });
  }
}

      const montoSolicitadoReal =
        montoSolicitadoDB > 0 ? montoSolicitadoDB : montoSolicitadoPayload;

      // 4.2 Buscar si ya existe relación solicitud + factura
      const qRelacion = `
        SELECT
          pfp.id,
          CAST(COALESCE(NULLIF(TRIM(pfp.monto_facturado), ''), '0') AS DECIMAL(12,2)) AS monto_facturado_actual,
          CAST(COALESCE(NULLIF(TRIM(pfp.subtotal_facturado), ''), '0') AS DECIMAL(12,2)) AS subtotal_facturado_actual,
          CAST(COALESCE(NULLIF(TRIM(pfp.impuestos_facturado), ''), '0') AS DECIMAL(12,2)) AS impuestos_facturado_actual
        FROM pagos_facturas_proveedores pfp
        WHERE pfp.id_solicitud = ?
          AND TRIM(pfp.id_factura) = TRIM(?)
        ORDER BY pfp.id DESC
        LIMIT 1;
      `;

      const relacionRows = getRows(
        await executeQuery(qRelacion, [idSolicitud, idFactura]),
      );

      const relacionExistente = relacionRows?.[0] ?? null;
      const montoExistenteRelacion = round2(
        relacionExistente?.monto_facturado_actual ?? 0,
      );

      // 4.3 SUM global por solicitud
      const qSumSolicitud = `
        SELECT
          COALESCE(
            SUM(
              CAST(COALESCE(NULLIF(TRIM(monto_facturado), ''), '0') AS DECIMAL(12,2))
            ),
            0
          ) AS total_asociado_solicitud
        FROM pagos_facturas_proveedores
        WHERE id_solicitud = ?;
      `;

      const sumSolicitudRows = getRows(
        await executeQuery(qSumSolicitud, [idSolicitud]),
      );

      const totalAsociadoSolicitud = round2(
        sumSolicitudRows?.[0]?.total_asociado_solicitud ?? 0,
      );

      // quitamos la relación actual si existe para permitir edición
      const totalSolicitudSinActual = Math.max(
        0,
        round2(totalAsociadoSolicitud - montoExistenteRelacion),
      );

      const disponibleSolicitud = Math.max(
        0,
        round2(montoSolicitadoReal - totalSolicitudSinActual),
      );

      const maximoAsignableSolicitud = Math.max(
        0,
        round2(
          montoPorFacturarActual > 0
            ? Math.min(
                montoPorFacturarActual + montoExistenteRelacion,
                disponibleSolicitud,
              )
            : disponibleSolicitud,
        ),
      );

      if (montoAsociar - maximoAsignableSolicitud > EPS) {
        return res.status(400).json({
          ok: false,
          message: `El monto_asociar excede el máximo permitido para la solicitud ${idSolicitud}`,
          data: {
            id_solicitud: idSolicitud,
            monto_asociar: toMoneyString(montoAsociar),
            maximo_asignable: toMoneyString(maximoAsignableSolicitud),
          },
        });
      }

      // 4.4 prorratear subtotal/impuestos
      let subtotalFacturado = round2(montoAsociar * ratioSubtotal);
      let impuestosFacturado = round2(montoAsociar * ratioImpuestos);

      const sumaProrrateada = round2(subtotalFacturado + impuestosFacturado);
      const diferencia = round2(montoAsociar - sumaProrrateada);

      if (Math.abs(diferencia) > 0) {
        subtotalFacturado = round2(subtotalFacturado + diferencia);
      }

      // 4.5 Insert / Update
      let idRelacion = null;

      if (relacionExistente?.id) {
        await executeQuery(
          `
          UPDATE pagos_facturas_proveedores
          SET
            id_pago_proveedor = NULL,
            subtotal_facturado = ?,
            impuestos_facturado = ?,
            monto_facturado = ?,
            monto_pago = ?
          WHERE id = ?
          LIMIT 1;
          `,
          [
            toMoneyString(subtotalFacturado),
            toMoneyString(impuestosFacturado),
            toMoneyString(montoAsociar),
            toMoneyString(montoAsociar),
            Number(relacionExistente.id),
          ],
        );

        idRelacion = Number(relacionExistente.id);
      } else {
        const qInsert = `
          INSERT INTO pagos_facturas_proveedores (
            id_pago_proveedor,
            id_solicitud,
            id_factura,
            subtotal_facturado,
            impuestos_facturado,
            monto_facturado,
            monto_pago
          ) VALUES (?, ?, ?, ?, ?, ?, ?);
        `;

        const insertResult = await executeQuery(qInsert, [
          null,
          idSolicitud,
          idFactura,
          toMoneyString(subtotalFacturado),
          toMoneyString(impuestosFacturado),
          toMoneyString(montoAsociar),
          toMoneyString(montoAsociar),
        ]);

        idRelacion = insertResult?.insertId ?? null;
      }

      // 4.6 Recalcular solicitud
      const qRecalcSolicitud = `
        SELECT
          COALESCE(
            SUM(
              CAST(COALESCE(NULLIF(TRIM(monto_facturado), ''), '0') AS DECIMAL(12,2))
            ),
            0
          ) AS total_facturado_real
        FROM pagos_facturas_proveedores
        WHERE id_solicitud = ?;
      `;

      const recalcRows = getRows(
        await executeQuery(qRecalcSolicitud, [idSolicitud]),
      );

      const nuevoMontoFacturado = round2(
        recalcRows?.[0]?.total_facturado_real ?? 0,
      );

      const nuevoMontoPorFacturar = Math.max(
        0,
        round2(montoSolicitadoReal - nuevoMontoFacturado),
      );

      let nuevoEstadoFacturacion = "pendiente";
      if (nuevoMontoPorFacturar <= EPS && nuevoMontoFacturado > EPS) {
        nuevoEstadoFacturacion = "completado";
      } else if (nuevoMontoFacturado > EPS) {
        nuevoEstadoFacturacion = "parcial";
      }

      await executeQuery(
        `
        UPDATE solicitudes_pago_proveedor
        SET
          monto_facturado = ?,
          monto_por_facturar = ?,
          estado_facturacion = ?
        WHERE id_solicitud_proveedor = ?
        LIMIT 1;
        `,
        [
          toMoneyString(nuevoMontoFacturado),
          toMoneyString(nuevoMontoPorFacturar),
          nuevoEstadoFacturacion,
          idSolicitud,
        ],
      );

      resultados.push({
        id_relacion: idRelacion,
        id_solicitud: idSolicitud,
        id_factura: idFactura,
        monto_facturado: toMoneyString(montoAsociar),
        subtotal_facturado: toMoneyString(subtotalFacturado),
        impuestos_facturado: toMoneyString(impuestosFacturado),
        monto_por_facturar: toMoneyString(nuevoMontoPorFacturar),
        estado_facturacion: nuevoEstadoFacturacion,
      });
    }

    // 5) recalcular saldo disponible de factura
    const qSumFactura = `
      SELECT
        COALESCE(
          SUM(
            CAST(COALESCE(NULLIF(TRIM(monto_facturado), ''), '0') AS DECIMAL(12,2))
          ),
          0
        ) AS total_asociado_factura
      FROM pagos_facturas_proveedores
      WHERE TRIM(id_factura) = TRIM(?);
    `;

    const sumFacturaRows = getRows(
      await executeQuery(qSumFactura, [idFactura]),
    );

    const totalAsociadoFactura = round2(
      sumFacturaRows?.[0]?.total_asociado_factura ?? 0,
    );

    const nuevoSaldoFactura = Math.max(
      0,
      round2(totalFactura - totalAsociadoFactura),
    );

    await executeQuery(
      `
      UPDATE facturas_pago_proveedor
      SET saldo_x_aplicar_items = ?
      WHERE id_factura_proveedor = ?
      LIMIT 1;
      `,
      [toMoneyString(nuevoSaldoFactura), idFactura],
    );

    return res.status(200).json({
      ok: true,
      message: "Factura previa asignada correctamente",
      data: {
        uuid_cfdi: uuidFacturaReal,
        id_factura_proveedor: idFactura,
        total_factura: toMoneyString(totalFactura),
        asignaciones: resultados,
      },
    });
  } catch (error) {
    console.error("Error en asignar_factura_previa:", error);
    return res.status(500).json({
      ok: false,
      error: "Error en el servidor",
      details: error?.sqlMessage || error?.message || error,
    });
  }
};

const buscaruuid = async (req, res) => {
  try {
    const { uuid_factura } = req.body;

    const getRows = (result) =>
      Array.isArray(result) ? result : (result?.[0] ?? []);

    const safeString = (v) => String(v ?? "").trim();

    const uuid = safeString(uuid_factura);

    if (!uuid) {
      return res.status(400).json({
        ok: false,
        message: "uuid_factura es requerido",
      });
    }

    const qBuscar = `
  SELECT
    v.id_relacion_pago_factura,
    v.id_pago_proveedor,
    v.id_solicitud,
    v.monto_solicitado,
    v.id_factura,
    v.monto_facturado,
    v.uuid_factura,
    v.url_pdf,
    v.url_xml,
    v.rfc_emisor,
    v.id_agente,
    v.total,
    v.subtotal,
    v.impuestos,
    v.uso_cfdi,
    v.moneda,
    v.forma_pago,
    v.metodo_pago,
    v.total_moneda_O,
    v.sub_total_moneda_O,
    v.impuestos_moneda_O,
    v.razon_social_fiscal,
    v.id_booking,
    v.codigo_confirmacion
  FROM vw_pagos_facturas_proveedores_detalle v
  INNER JOIN solicitudes_pago_proveedor spp
    ON spp.id_solicitud_proveedor = v.id_solicitud
  WHERE v.uuid_factura LIKE TRIM(?)
    AND NULLIF(TRIM(v.codigo_confirmacion), '') IS NOT NULL
  ORDER BY v.id_relacion_pago_factura DESC;
`;    // -- AND UPPER(TRIM(COALESCE(spp.estado_solicitud, ''))) <> 'CANCELADA'

    const rows = getRows(await executeQuery(qBuscar, [uuid]));

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message:
          "No se encontraron registros para ese uuid_factura o la solicitud está cancelada",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Registros encontrados correctamente",
      data: rows,
    });
  } catch (error) {
    console.error("Error en buscaruuid:", error);
    return res.status(500).json({
      ok: false,
      error: "Error en el servidor",
      details: error?.sqlMessage || error?.message || error,
    });
  }
};

module.exports = {
  devolverMontoFacturadoAFacturasPorCancelacion,
  createSolicitud,
  Detalles,
  getSolicitudes,
  createDispersion,
  createPago,
  saldo_a_favor,
  getDatosFiscalesProveedor,
  editProveedores,
  getProveedores,
  cargarFactura,
  EditCampos,
  saldo_a_favor,
  getSolicitudes2,
  saldos,
  monto_factura,
  cambio_estatus,
  consultar_facturado,
  asignar_factura_previa,
  Uuid,
  eliminarFactura,
  createComprobantePago,
  buscaruuid,
};




