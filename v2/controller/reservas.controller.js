const {
  executeQuery,
  executeSP2,
  executeSP,
  runTransaction,
} = require("../../config/db");
const { v4: uuidv4 } = require("uuid");
const { CustomError } = require("../../middleware/errorHandler");
const Booking = require("../model/bookings.model");
const Servicio = require("../model/servicios.model");
const Hospedaje = require("../model/hospedajes.model");
const Item = require("../model/item.model");
const { Calculo, calcularNoches } = require("../../lib/utils/calculates");
const { Formato } = require("../../lib/utils/formats");

/* =========================
 * UTILIDADES / HELPERS
 * ========================= */
const getItemTotal = (it) => Number(it?.total ?? it?.insertedItem?.total ?? 0);

function toNumber(n, def = NaN) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function hasPrecioChange(venta) {
  const before = toNumber(venta?.before?.total);
  const current = toNumber(venta?.current?.total);
  if (!Number.isFinite(before) || !Number.isFinite(current)) return false;
  return Math.abs(current - before) > 0.009;
}

function hasNochesChange(noches) {
  const before = toNumber(noches?.before);
  const current = toNumber(noches?.current);
  if (!Number.isFinite(before) || !Number.isFinite(current)) return false;
  return current !== before;
}

function makeInPlaceholders(n) {
  return Array.from({ length: n }, () => "?").join(",");
}
async function liberar_items_facturados(connection, items_desactivados) {
  if (!Array.isArray(items_desactivados) || items_desactivados.length === 0)
    return;

  const ids = items_desactivados
    .map((x) => x?.id_item)
    .filter(Boolean)
    .map(String);

  if (ids.length === 0) return;

  const ph = ids.map(() => "?").join(",");

  // 1) Trae los vínculos actuales (y bloquea filas)
  const [rows] = await connection.execute(
    `
    SELECT id_item, id_factura, monto
    FROM items_facturas
    WHERE id_item IN (${ph}) AND monto > 0
    FOR UPDATE
    `,
    ids,
  );

  if (!rows || rows.length === 0) return;

  // 2) Agrupa monto liberado por factura
  const porFactura = new Map(); // id_factura -> monto_total
  for (const r of rows) {
    const f = String(r.id_factura);
    const m = Number(r.monto || 0);
    porFactura.set(f, Number(((porFactura.get(f) || 0) + m).toFixed(2)));
  }

  // 3) Pone en cero los montos de los items desactivados
  await connection.execute(
    `UPDATE items_facturas SET monto = 0 WHERE id_item IN (${ph}) AND monto > 0`,
    ids,
  );

  // 4) Devuelve el monto liberado al saldo de cada factura (sin rebasar el total)
  for (const [id_factura, monto_liberado] of porFactura.entries()) {
    await connection.execute(
      `
      UPDATE facturas
      SET saldo_x_aplicar_items =
        CASE
          WHEN saldo_x_aplicar_items IS NULL
            THEN LEAST(total, total + ?)
          ELSE LEAST(saldo_x_aplicar_items + ?, total)
        END
      WHERE id_factura = ?
      `,
      [monto_liberado, monto_liberado, id_factura],
    );
    console.log(
      `🧾 [FISCAL] Liberado ${monto_liberado} a saldo_x_aplicar_items en factura ${id_factura}`,
    );
  }
}

/**
 * Inserta (id_item, id_factura, monto, id_relacion) en items_facturas
 * y aplica la regla de saldo_x_aplicar_items en la factura (NULL => total).
 * Garantiza no dejar saldo negativo.
 */
async function insertar_items_facturas_y_descuento(
  connection,
  { id_item, id_factura, monto, id_relacion },
) {
  const m = Number(monto || 0);
  if (m <= 0.009) return;

  // Insert vínculo
  await connection.execute(
    `INSERT INTO items_facturas (id_item, id_factura, monto, id_relacion) VALUES (?, ?, ?, ?)`,
    [id_item, id_factura, m, id_relacion],
  );

  // Descuenta saldo fiscal disponible (capado a >= 0; NULL => total)
  await connection.execute(
    `
    UPDATE facturas
    SET saldo_x_aplicar_items = CASE
      WHEN saldo_x_aplicar_items IS NULL THEN GREATEST(total - ?, 0)
      ELSE GREATEST(saldo_x_aplicar_items - ?, 0)
    END
    WHERE id_factura = ?
    `,
    [m, m, id_factura],
  );
}
/* =========================
 * PAGOS
 * ========================= */

async function crear_pago_desde_wallet(
  connection,
  id_servicio,
  id_agente,
  monto_total,
  saldos_aplicados,
) {
  console.log("💳 [WALLET] Iniciando crear_pago_desde_wallet");
  console.log("🚓🚓🚓 saldos_aplicados:", saldos_aplicados);

  if (!Array.isArray(saldos_aplicados) || saldos_aplicados.length === 0) {
    console.log("💳 [WALLET] No hay saldos_aplicados válidos. Omitiendo pago.");
    return null;
  }

  // ✅ VALIDACIÓN: Corroborar que los saldos enviados desde front existan en BD
  console.log("💳 [WALLET] Iniciando validación de saldos en BD...");

  const ids_saldos = saldos_aplicados
    .map((s) => s?.id_saldos)
    .filter(Boolean)
    .map(String);

  if (ids_saldos.length === 0) {
    console.warn("💳 [WALLET] No hay id_saldos válidos para validar.");
    return null;
  }

  // Consultar BD para verificar que los saldos existan y tengan el saldo correcto
  const ph = ids_saldos.map(() => "?").join(",");
  const [saldos_bd] = await connection.execute(
    `SELECT id_saldos, saldo, monto FROM saldos_a_favor WHERE id_saldos IN (${ph})`,
    ids_saldos,
  );

  if (!saldos_bd || saldos_bd.length === 0) {
    console.error(
      "💳 [WALLET][ERROR] No se encontraron saldos en BD. IDs solicitados:",
      ids_saldos,
    );
    throw new Error(
      "Validación fallida: Los saldos solicitados no existen en la base de datos.",
    );
  }

  // Validar que cada saldo coincida y tenga disponibilidad
  const saldos_bd_map = new Map(saldos_bd.map((s) => [String(s.id_saldos), s]));

  for (const saldo_front of saldos_aplicados) {
    const id_saldo = String(saldo_front.id_saldos);
    const saldo_bd = saldos_bd_map.get(id_saldo);

    if (!saldo_bd) {
      console.error(
        `💳 [WALLET][ERROR] Saldo ${id_saldo} no encontrado en BD.`,
      );
      throw new Error(
        `Validación fallida: Saldo ${id_saldo} no existe en la base de datos.`,
      );
    }

    // Validar que el saldo en BD sea >= al saldo_usado que se intenta aplicar
    const saldo_disponible_bd = Number(saldo_bd.saldo || saldo_bd.monto || 0);
    const saldo_usado_front = Number(saldo_front.saldo_usado || 0);

    if (saldo_disponible_bd < saldo_usado_front) {
      console.error(
        `💳 [WALLET][ERROR] Saldo insuficiente. ID: ${id_saldo}. BD: ${saldo_disponible_bd}, Front solicita: ${saldo_usado_front}`,
      );
      throw new Error(
        `Validación fallida: Saldo insuficiente en ${id_saldo}. Disponible: ${saldo_disponible_bd}, Solicitado: ${saldo_usado_front}`,
      );
    }

    console.log(
      `✅ [WALLET] Saldo ${id_saldo} validado. BD: ${saldo_disponible_bd}, Usar: ${saldo_usado_front}`,
    );
  }

  console.log(
    "✅ [WALLET] Todas las validaciones de saldos pasaron correctamente.",
  );

  if (monto_total <= 0) {
    console.log("💳 [WALLET] Monto total <= 0. No se crea pago.");
    return null;
  }

  const primer = saldos_aplicados[0] || {};
  const id_saldo_principal = primer.id_saldos || null;
  const id_pago = `pag-${uuidv4()}`;
  const transaccion = id_pago;

  const insert = `
    INSERT INTO pagos (
      id_pago, id_servicio, total, concepto, metodo_de_pago, tipo_de_pago,
      id_saldo_a_favor, id_agente, estado, fecha_creacion, fecha_pago,
      transaccion, saldo_aplicado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)`;

  const params = [
    id_pago,
    id_servicio,
    monto_total,
    "Pago desde wallet",
    "wallet",
    "wallet",
    id_saldo_principal,
    id_agente,
    "Confirmado",
    transaccion,
    monto_total,
  ];

  await connection.execute(insert, params);
  console.log(`💳 [WALLET] Pago creado: ${id_pago} por ${monto_total}`);

  return id_pago;
}

/**
 * Inserta vínculos en items_pagos para una lista de items con su monto a asociar.
 * items_a_vincular: [{ id_item, monto }]
 */
async function asociar_items_a_pago(
  connection,
  id_hospedaje,
  id_pago,
  items_a_vincular,
) {
  if (!Array.isArray(items_a_vincular) || items_a_vincular.length === 0) {
    console.log(
      "🔗 [ITEMS_PAGOS] No hay items_a_vincular. Omitiendo asociación.",
    );
    return;
  }

  console.log(
    `🔗 [ITEMS_PAGOS] Vinculando ${items_a_vincular.length} items al pago ${id_pago}`,
  );

  for (const item of items_a_vincular) {
    const monto = parseFloat(item.monto || 0);
    if (monto <= 0) continue;
    console.log([item.id_item, id_pago, monto, id_hospedaje]);

    const [result] = await connection.execute(
      `INSERT INTO items_pagos (id_item, id_pago, monto, id_relacion) VALUES (?, ?, ?, ?)`,
      [item.id_item, id_pago, monto, id_hospedaje],
    );
    console.log(
      `🔗 [ITEMS_PAGOS] Vínculo creado item=${item.id_item} monto=${monto}. Info:`,
      result?.info || "",
    );
  }
}

/* =========================
 * QUERIES AUX
 * ========================= */

async function get_payment_type(id_solicitud, id_servicio) {
  const query_credito = `select case when id_credito is not null then 1 else 0 end as is_credito 
    from vw_reservas_client where id_solicitud = ?;`;

  const query_pago_directo = `Select case when id_saldo_a_favor is null then 1 else 0 end as is_pago_directo
    from pagos where id_servicio = ?`;
  const query_wallet = `Select case when id_saldo_a_favor is not null then 1 else 0 end as is_wallet
    from pagos where id_servicio = ?`;

  let tipo_pago;
  const result_credito = await executeQuery(query_credito, [id_solicitud]);
  const result_pago_directo = await executeQuery(query_pago_directo, [
    id_servicio,
  ]);
  const result_wallet = await executeQuery(query_wallet, [id_servicio]);
  if (result_credito[0]?.is_credito) {
    tipo_pago = "credito";
  } else if (result_pago_directo[0]?.is_pago_directo) {
    tipo_pago = "pago_directo";
  } else if (result_wallet[0]?.is_wallet) {
    tipo_pago = "wallet";
  }
  console.log(
    `🧾 [TIPO_PAGO] id_servicio=${id_servicio} → tipo_pago_original=${tipo_pago}`,
  );
  return tipo_pago;
}

/**
 * Obtiene el estado fiscal de la reserva (SP existente).
 * Si tu SP trae `saldo_x_aplicar_items` y `total`, se normaliza a `saldo_interpretado_para_items`.
 */
async function is_invoiced_reservation(connection, id_servicio) {
  console.log(
    `🧾 [FISCAL] Consultando estado fiscal para servicio ${id_servicio}...`,
  );

  // mysql2 devuelve [rows, fields]; y rows para CALL es una matrioshka
  const [rows /*, fields*/] = await connection.query(
    "CALL sp_get_facturas_pagos_by_id_servicio(?)",
    [id_servicio],
  );

  // ---- 1) Desanidar de forma tolerante
  // Formas típicas observadas:
  // A) rows = [ [ [rowObj], ResultSetHeader ], [ [schema...], undefined ] ]
  // B) rows = [ [rowObj], ResultSetHeader ]
  // C) rows = [rowObj]
  let head = {};
  if (Array.isArray(rows?.[0]?.[0]?.[0])) {
    // muy raro, pero por si acaso
    head = rows[0][0][0];
  } else if (Array.isArray(rows?.[0]?.[0])) {
    // caso A
    head = rows[0][0][0] || {};
  } else if (Array.isArray(rows?.[0])) {
    // caso B
    head = rows[0][0] || {};
  } else if (rows && typeof rows === "object") {
    // caso C
    head = rows;
  } else {
    head = {};
  }

  // ---- 2) Asegurar/parsear JSON (puede venir como Buffer)
  const toJsonArray = (val) => {
    if (Buffer.isBuffer(val)) {
      val = val.toString("utf8");
    }
    if (typeof val === "string") {
      try {
        return JSON.parse(val || "[]");
      } catch {
        return [];
      }
    }
    return Array.isArray(val) ? val : [];
  };

  let facturas_detalle = toJsonArray(head?.facturas_detalle);
  // (si tu SP ya retorna objetos JS y no string/buffer, igual cae en el return Array.isArray)

  // ---- 3) Normalizar facturas → saldo_interpretado_para_items
  const facturas = facturas_detalle.map((f) => {
    const tieneXAplicar =
      f.saldo_x_aplicar_items != null &&
      typeof f.saldo_x_aplicar_items !== "undefined";
    const saldo = tieneXAplicar
      ? Number(f.saldo_x_aplicar_items || 0)
      : Number(f.total || 0);
    return { ...f, saldo_interpretado_para_items: saldo };
  });

  // ---- 4) Normalizar flag is_facturado (1 / '1' / true)
  const isFact = (v) => v === 1 || v === "1" || v === true;
  const resultado = {
    ...head,
    facturas,
    es_facturada: isFact(head?.is_facturado),
  };

  console.log("🧾 [FISCAL] Parse SP OK →", {
    es_facturada: resultado.es_facturada,
    totalFacturas: facturas.length,
  });

  return resultado;
}

/**
 * REDEFINICIÓN solicitada:
 *  - Mantiene el nombre.
 *  - Filtra los saldos usados que están facturados.
 *  - **Y** retorna el DETALLE de facturas por cada wallet (dedupe y orden).
 * Devuelve: { saldos_filtrados, facturas_wallet }
 */
async function are_invoiced_payments({ saldos }) {
  if (!Array.isArray(saldos) || saldos.length === 0) {
    console.log("🧾 [FISCAL] are_invoiced_payments: sin saldos.");
    return { saldos_filtrados: [], facturas_wallet: [] };
  }

  const ids = saldos
    .map((s) => s?.id_saldos)
    .filter(Boolean)
    .map(String);
  if (ids.length === 0) {
    console.log("🧾 [FISCAL] are_invoiced_payments: sin ids válidos.");
    return { saldos_filtrados: [], facturas_wallet: [] };
  }

  // 1) Saldo facturado?
  const ph = makeInPlaceholders(ids.length);
  const q1 = `
    SELECT id_saldos
    FROM saldos_a_favor
    WHERE id_saldos IN (${ph}) AND is_facturado = 1
  `;
  const r1 = await executeQuery(q1, ids);
  const ids_facturados = new Set(r1.map((r) => String(r.id_saldos)));
  const saldos_filtrados = saldos.filter((s) =>
    ids_facturados.has(String(s.id_saldos)),
  );

  console.log(
    `🧾 [FISCAL] Saldos facturados usados: ${saldos_filtrados.length}/${saldos.length}`,
  );

  if (saldos_filtrados.length === 0) {
    return { saldos_filtrados: [], facturas_wallet: [] };
  }

  // 2) DETALLE de facturas por wallet (dedupe y orden)
  const ids2 = saldos_filtrados.map((s) => String(s.id_saldos));
  const ph2 = makeInPlaceholders(ids2.length);
  const sql = `
    WITH fps_dedup AS (
      SELECT
        fps.id_saldo_a_favor,
        fps.id_factura,
        SUM(COALESCE(fps.monto, 0)) AS monto_asociado_al_saldo
      FROM facturas_pagos_y_saldos fps
      WHERE fps.id_saldo_a_favor IN (${ph2})
      GROUP BY fps.id_saldo_a_favor, fps.id_factura
    )
    SELECT 
      saf.id_saldos,
      d.id_factura,
      COALESCE(f.total, 0) AS total_factura,
      d.monto_asociado_al_saldo,
      CASE 
        WHEN f.saldo_x_aplicar_items IS NULL THEN f.total
        ELSE f.saldo_x_aplicar_items
      END AS saldo_interpretado_para_items,
      f.created_at
    FROM saldos_a_favor saf
    LEFT JOIN fps_dedup d
           ON d.id_saldo_a_favor = saf.id_saldos
    LEFT JOIN facturas f
           ON f.id_factura = d.id_factura
    WHERE saf.id_saldos IN (${ph2})
      AND saf.is_facturado = 1
    ORDER BY saf.id_saldos, f.created_at, d.id_factura
  `;
  const r2 = await executeQuery(sql, [...ids2, ...ids2]);

  const facturas_wallet = r2
    .filter((row) => row.id_factura) // ignora filas sin factura
    .map((row) => ({
      id_saldos: String(row.id_saldos),
      id_factura: String(row.id_factura),
      total: Number(row.total_factura || 0),
      saldo_interpretado_para_items: Number(
        row.saldo_interpretado_para_items ?? row.total_factura ?? 0,
      ),
      monto_asociado_al_saldo: Number(row.monto_asociado_al_saldo || 0),
      fecha_creacion: row.fecha_creacion,
    }));

  console.log("🧾 [FISCAL] facturas_wallet filas:", facturas_wallet.length);

  return { saldos_filtrados, facturas_wallet };
}

/* =========================
 * LÓGICA FISCAL (herencia y ajustes)
 * ========================= */

/**
 * REDEFINICIÓN solicitada:
 *   - Usa facturas_disponibles = [{ id_factura, saldo_interpretado_para_items, total?, saldo_x_aplicar_items? }, ...]
 *   - Inserta en items_facturas y actualiza facturas con la REGLA:
 *       IF saldo_x_aplicar_items IS NULL THEN total - monto ELSE saldo_x_aplicar_items - monto
 *     (capado a >= 0 por seguridad)
 */

async function rebajar_wallet_saldos(connection, saldos_aplicados) {
  if (!Array.isArray(saldos_aplicados) || saldos_aplicados.length === 0) return;

  for (const s of saldos_aplicados) {
    const id_saldos = s?.id_saldos;
    const usado = Number(s?.saldo_usado || 0);
    if (!id_saldos || usado <= 0) continue;

    await connection.execute(
      `UPDATE saldos_a_favor 
         SET saldo = GREATEST(COALESCE(saldo,0) - ?, 0) 
       WHERE id_saldos = ?`,
      [usado, id_saldos],
    );
    console.log(`💳 [WALLET] Descontado ${usado} de saldo ${id_saldos}`);
  }
}
async function asociar_factura_items_logica(
  connection,
  id_hospedaje,
  items_a_vincular,
  facturas_disponibles,
) {
  console.log(
    `🧾 [FISCAL] Iniciando herencia fiscal (items=${
      items_a_vincular.length
    }, facturas=${facturas_disponibles?.length || 0})`,
  );

  if (!Array.isArray(items_a_vincular) || items_a_vincular.length === 0) {
    console.log("🧾 [FISCAL] Sin items_a_vincular. Omitido.");
    return;
  }
  if (
    !Array.isArray(facturas_disponibles) ||
    facturas_disponibles.length === 0
  ) {
    console.warn(
      "🧾 [FISCAL] No hay facturas disponibles para herencia fiscal. Omitido.",
    );
    return;
  }

  // Clona y normaliza saldos
  const facturas = facturas_disponibles.map((f) => ({
    id_factura: String(f.id_factura),
    // saldo interpretable que iremos consumiendo en memoria
    saldo: Number(
      typeof f.saldo_interpretado_para_items !== "undefined" &&
        f.saldo_interpretado_para_items !== null
        ? f.saldo_interpretado_para_items
        : (f.saldo_x_aplicar_items == null
            ? f.total
            : f.saldo_x_aplicar_items) || 0,
    ),
  }));

  // Recorre items
  for (const item of items_a_vincular) {
    let pendiente = Number(item.total || 0);
    if (pendiente <= 0.009) continue;

    // Recorre facturas mientras quede pendiente
    for (let i = 0; i < facturas.length && pendiente > 0.009; i++) {
      const f = facturas[i];
      let disponible = Number(f.saldo || 0);
      if (disponible <= 0.009) continue;

      const asignar = Math.min(pendiente, disponible);

      await insertar_items_facturas_y_descuento(connection, {
        id_item: item.id_item,
        id_factura: f.id_factura,
        monto: asignar,
        id_relacion: id_hospedaje,
      });

      // Actualiza saldos en memoria
      f.saldo = Number((disponible - asignar).toFixed(2));
      pendiente = Number((pendiente - asignar).toFixed(2));

      console.log(
        `🧾 [FISCAL] item=${item.id_item} -> factura=${f.id_factura} +${asignar}. pendiente_item=${pendiente}, saldo_factura=${f.saldo}`,
      );
    }

    if (pendiente > 0.009) {
      console.error(
        `🧾 [FISCAL][ERROR] No hay saldo fiscal suficiente para cubrir item ${item.id_item}. Restante: ${pendiente}`,
      );
      throw new Error("(revisar la data con finanzas)");
    }
  }

  console.log("🧾 [FISCAL] Herencia fiscal completada.");
}

async function manejar_desactivacion_fiscal(
  connection,
  items_desactivados /*, facturas_reserva*/,
) {
  console.log(
    "🧾 [FISCAL] Manejando desactivación fiscal (Regla Morada, multi-factura)...",
  );
  if (!Array.isArray(items_desactivados) || items_desactivados.length === 0)
    return;
  // Leemos la relación real desde items_facturas; no necesitamos 'facturas_reserva' aquí.
  await liberar_items_facturados(connection, items_desactivados);
}

async function manejar_reduccion_fiscal(
  connection,
  items_activos_post_split,
  facturas_reserva,
  id_agente,
  restanteNum,
) {
  console.log("🧾 [FISCAL] Manejando reducción fiscal (Down-scale)...");
  if (!Array.isArray(facturas_reserva) || facturas_reserva.length === 0) return;

  const factura_principal = facturas_reserva[0];

  const [rows] = await connection.execute(
    "SELECT saldo_x_aplicar_items, id_agente, total FROM facturas WHERE id_factura = ?",
    [factura_principal.id_factura],
  );

  if (!rows || rows.length === 0) return;

  let monto_liberado_reasignable = parseFloat(
    rows[0]?.saldo_x_aplicar_items || 0,
  );
  // const id_agente = rows[0]?.id_agente;
  const total_factura = parseFloat(rows[0]?.total || 0);

  if (
    monto_liberado_reasignable < 0 ||
    monto_liberado_reasignable > total_factura
  ) {
    console.error(
      `🧾 [FISCAL][ERROR] Factura ${factura_principal.id_factura} saldo inválido (${monto_liberado_reasignable}) vs total (${total_factura})`,
    );
    throw new Error("(revisar la data con finanzas)");
  }

  for (const item of items_activos_post_split) {
    const capacidad_fiscal_nueva = parseFloat(item.total);
    const monto_facturado_actual = parseFloat(item.monto_facturado_previo || 0);

    if (monto_facturado_actual > capacidad_fiscal_nueva) {
      const exceso_item = monto_facturado_actual - capacidad_fiscal_nueva;
      monto_liberado_reasignable += exceso_item;

      await connection.execute(
        "UPDATE items_facturas SET monto = ? WHERE id_item = ? AND id_factura = ?",
        [capacidad_fiscal_nueva, item.id_item, factura_principal.id_factura],
      );
    }
  }

  if (monto_liberado_reasignable > 0) {
    console.log(
      `🧾 [FISCAL] Generando devolución no facturable por ${monto_liberado_reasignable}`,
    );
    await connection.execute(
      `INSERT INTO saldos_a_favor (id_agente, monto, concepto, activo, is_facturable, is_devolucion, monto_facturado, fecha_creacion, fecha_pago) 
       VALUES (?, ?, ?, 1, 0, 1, 0, CURDATE(), CURDATE())`,
      [
        id_agente,
        monto_liberado_reasignable,
        "Devolucion por ajuste de reserva",
      ],
    );

    await connection.execute(
      "UPDATE facturas SET saldo_x_aplicar_items = 0 WHERE id_factura = ?",
      [factura_principal.id_factura],
    );
  }
  console.log(
    "🧾 [FISCAL] PASO NUEVO, reduccion fiscal por decremento por input facturado (Down-scale)...",
  );
  console.log("restanteNum:", restanteNum);

  if (restanteNum <= 0) {
    console.log(
      "🧾🔽🔽 [FISCAL] PASO NUEVO, reduccion fiscal por decremento por input facturado (Down-scale)...",
    );

    const facturas_ids = Array.isArray(facturas_reserva)
      ? facturas_reserva.map((f) => String(f.id_factura)).filter(Boolean)
      : [];

    if (facturas_ids.length === 0) {
      console.warn(
        "🧾 [FISCAL][WARN] facturas_reserva vacío. Omitiendo recalculo.",
      );
    } else {
      const ph = facturas_ids.map(() => "?").join(",");

      // 1) suma previa
      const [prevSumRows] = await connection.execute(
        `
      SELECT COALESCE(SUM(monto), 0) AS suma
      FROM items_facturas
      WHERE id_factura IN (${ph})
      `,
        facturas_ids,
      );

      const sumaPrev = Number(prevSumRows?.[0]?.suma || 0);
      const objetivo = Number((sumaPrev + restanteNum).toFixed(2));

      console.log(
        "🧾 [FISCAL][DEBUG] sumaPrev:",
        sumaPrev,
        "objetivo:",
        objetivo,
      );

      // 2) update igualitario
      const updateEqualSql = `
      UPDATE items_facturas i
      JOIN (
        SELECT COUNT(*) AS n
        FROM items_facturas
        WHERE id_factura IN (${ph})
      ) t
      SET i.monto = ROUND(? / NULLIF(t.n, 0), 2)
      WHERE i.id_factura IN (${ph});
    `;

      const updateEqualParams = [...facturas_ids, objetivo, ...facturas_ids];

      const [updateEqualRes] = await connection.execute(
        updateEqualSql,
        updateEqualParams,
      );
      console.log(
        "🧾 [FISCAL][DEBUG] Resultado UPDATE igualitario:",
        updateEqualRes,
      );

      // 3) ajustar centavos
      const [afterSumRows] = await connection.execute(
        `
      SELECT COALESCE(SUM(monto), 0) AS suma, MIN(id_item) AS any_item
      FROM items_facturas
      WHERE id_factura IN (${ph})
      `,
        facturas_ids,
      );

      const sumaNueva = Number(afterSumRows?.[0]?.suma || 0);
      const delta = Number((objetivo - sumaNueva).toFixed(2));

      if (Math.abs(delta) >= 0.01 && afterSumRows?.[0]?.any_item) {
        await connection.execute(
          `
        UPDATE items_facturas 
        SET monto = ROUND(monto + ?, 2)
        WHERE id_item = ?
        LIMIT 1
        `,
          [delta, afterSumRows[0].any_item],
        );
        console.log("🔧 [FISCAL] Ajuste de redondeo aplicado:", delta);
      }
    }
  }
}

/* =========================
 * CRÉDITO
 * ========================= */

async function actualizar_credito_existente(
  connection,
  id_servicio,
  delta_total,
  id_agente,
) {
  console.log(
    `🏦 [CREDITO] Actualizando pagos_credito para ${id_servicio} por delta: ${delta_total}`,
  );

  const findQuery = `SELECT id_credito FROM pagos_credito WHERE id_servicio = ? ORDER BY created_at DESC LIMIT 1`;
  const [rows] = await connection.execute(findQuery, [id_servicio]);

  if (!rows || rows.length === 0) {
    console.warn(
      `🏦 [CREDITO] No se encontró registro en pagos_credito para ${id_servicio}. No se pudo actualizar.`,
    );
    return;
  }

  const id_credito_a_actualizar = rows[0].id_credito;
  const updateQuery = `
    UPDATE pagos_credito 
    SET 
      total = total + ?, 
      subtotal = (total + ?) / 1.16,
      impuestos = (total + ?) - ((total + ?) / 1.16),
      monto_a_credito = monto_a_credito + ?,
      pendiente_por_cobrar = pendiente_por_cobrar + ?,
      pago_por_credito =  ?
    WHERE id_credito = ?`;

  const [updateResult] = await connection.execute(updateQuery, [
    delta_total,
    delta_total,
    delta_total,
    delta_total,
    delta_total,
    delta_total,
    delta_total,
    id_credito_a_actualizar,
  ]);
  console.log(
    "🏦 [CREDITO] Resultado UPDATE pagos_credito:",
    updateResult?.info || "",
  );
  if (delta_total < 0 && id_agente) {
    const montoDevolver = Math.abs(delta_total);
    await connection.execute(
      "UPDATE agentes SET saldo = saldo + ? WHERE id_agente = ?",
      [montoDevolver, id_agente],
    );
    console.log(
      "🏦 [CREDITO] Devolución de crédito aplicada al agente:",
      montoDevolver,
      "agente:",
      id_agente,
    );
  }
}

async function crear_nuevo_pago_credito(
  connection,
  id_servicio,
  delta_total,
  id_agente,
  id_empresa,
) {
  console.log(
    `🏦 [CREDITO] Creando NUEVO pagos_credito para ${id_servicio} por delta: ${delta_total}`,
  );

  const nuevo_id_credito = `cred-${uuidv4()}`;
  const { subtotal, impuestos } = Calculo.precio({ total: delta_total });

  const insertQuery = `
    INSERT INTO pagos_credito 
      (id_credito, id_servicio, monto_a_credito, total, subtotal, impuestos, 
       pendiente_por_cobrar, pago_por_credito, fecha_creacion, concepto, 
       responsable_pago_agente)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURDATE(), ?, ?)`;

  const [insertResult] = await connection.execute(insertQuery, [
    nuevo_id_credito,
    id_servicio,
    delta_total,
    delta_total,
    subtotal,
    impuestos,
    delta_total,
    "Ajuste de precio en reserva (crédito)",
    id_agente,
  ]);
  console.log(
    "🏦 [CREDITO] Resultado INSERT pagos_credito:",
    insertResult?.info || "",
  );
  return nuevo_id_credito;
}

async function obtener_total_pagado_credito(connection, id_servicio) {
  console.log(
    `🏦 [CREDITO] Obteniendo total pagado para servicio (crédito) ${id_servicio}`,
  );
  const query = `
        SELECT SUM(pago_por_credito) as total_pagado 
        FROM pagos_credito 
        WHERE id_servicio = ?`;
  const [rows] = await connection.execute(query, [id_servicio]);
  const total_pagado = parseFloat(rows[0]?.total_pagado || 0);
  console.log(
    `🏦 [CREDITO] Total pagado (crédito) encontrado: ${total_pagado}`,
  );
  return total_pagado;
}

/* =========================
 * CASO BASE TOLERANTE
 * ========================= */

async function caso_base_tolerante({
  id_servicio,
  id_hospedaje,
  id_booking,
  total,
  estado,
  check_in,
  check_out,
  costo_total,
  noches,
  id_viajero_principal,
  acompanantes,
  codigo_reservacion_hotel,
  comments,
  hotel,
  habitacion,
  nuevo_incluye_desayuno,
  intermediario,
}) {
  return await runTransaction(async (connection) => {
    console.log("🧱 [CASO_BASE] Iniciando caso_base_tolerante...");

    // 1) Servicio (solo si viene total numérico)
    if (Number.isFinite(total)) {
      const { subtotal, impuestos } = Calculo.precio({ total });
      await Servicio.update(
        connection,
        Calculo.cleanEmpty({
          id_servicio,
          total,
          subtotal,
          impuestos,
        }),
      );
      console.log("🧱 [CASO_BASE] Servicio.update aplicado con total:", total);
    }

    // 2) Booking
    const updatesBooking = Calculo.cleanEmpty({
      id_booking,
      estado,
      ...(check_in?.current ? { check_in: check_in.current } : {}),
      ...(check_out?.current ? { check_out: check_out.current } : {}),
      costo_total,
    });

    if (Number.isFinite(total)) {
      const { subtotal, impuestos } = Calculo.precio({ total });
      Object.assign(updatesBooking, { total, subtotal, impuestos });
    }

    if (Object.keys(updatesBooking).length > 1) {
      await Booking.update(connection, updatesBooking);
      console.log("🧱 [CASO_BASE] Booking.update aplicado:", updatesBooking);
    } else {
      console.log("🧱 [CASO_BASE] Booking.update omitido (sin cambios).");
    }
    console.log("\n\n\nintermediario", intermediario);
    console.log(intermediario?.current);
    console.log(intermediario?.current != undefined);
    // 3) Hospedaje
    const updatesHosp = Calculo.cleanEmpty({
      id_hospedaje,
      ...(Number.isFinite(noches?.current) ? { noches: noches.current } : {}),
      ...(intermediario?.current !== undefined
        ? { id_intermediario: intermediario?.current?.id ?? null }
        : {}),
      ...(codigo_reservacion_hotel?.current
        ? { codigo_reservacion_hotel: codigo_reservacion_hotel.current }
        : {}),
      ...(comments?.current ? { comments: comments.current } : {}),
      ...(hotel?.current?.name ? { nombre_hotel: hotel.current.name } : {}),
      ...(habitacion?.current ? { tipo_cuarto: habitacion.current } : {}),
      ...(typeof nuevo_incluye_desayuno !== "undefined"
        ? { nuevo_incluye_desayuno }
        : {}),
      ...(hotel?.current?.content?.id_hotel
        ? { id_hotel: hotel.current.content.id_hotel }
        : {}),
    });

    if (Object.keys(updatesHosp).length > 1) {
      await Hospedaje.update(connection, updatesHosp);
      console.log("🧱 [CASO_BASE] Hospedaje.update aplicado:", updatesHosp);
    } else {
      console.log("🧱 [CASO_BASE] Hospedaje.update omitido (sin cambios).");
    }

    // 4) Viajeros
    const debeActualizarViajeros =
      id_viajero_principal || Array.isArray(acompanantes);
    if (debeActualizarViajeros && id_hospedaje) {
      const [viajerosActualesRows] = await connection.execute(
        `SELECT id_viajero, is_principal FROM viajeros_hospedajes WHERE id_hospedaje = ?`,
        [id_hospedaje],
      );

      const actuales = new Map(
        viajerosActualesRows.map((r) => [String(r.id_viajero), r]),
      );

      // principal
      if (id_viajero_principal) {
        const idP = String(id_viajero_principal);
        const yaP = viajerosActualesRows.find((r) => r.is_principal === 1);
        if (!yaP || String(yaP.id_viajero) !== idP) {
          await connection.execute(
            `DELETE FROM viajeros_hospedajes WHERE id_hospedaje = ? AND is_principal = 1`,
            [id_hospedaje],
          );
          await connection.execute(
            `INSERT INTO viajeros_hospedajes (id_hospedaje, id_viajero, is_principal) VALUES (?, ?, 1)`,
            [id_hospedaje, idP],
          );
          console.log("🧱 [CASO_BASE] Principal actualizado a:", idP);
        }
      }

      // acompañantes (no principal)
      const nuevosAcomp = new Set(
        (acompanantes || []).map((a) => String(a.id_viajero)).filter(Boolean),
      );

      const paraEliminar = [];
      for (const r of viajerosActualesRows) {
        if (r.is_principal) continue;
        if (!nuevosAcomp.has(String(r.id_viajero)))
          paraEliminar.push(String(r.id_viajero));
      }
      if (paraEliminar.length) {
        const ph = paraEliminar.map(() => "?").join(",");
        await connection.execute(
          `DELETE FROM viajeros_hospedajes WHERE id_hospedaje = ? AND is_principal = 0 AND id_viajero IN (${ph})`,
          [id_hospedaje, ...paraEliminar],
        );
        console.log("🧱 [CASO_BASE] Acompañantes removidos:", paraEliminar);
      }
      for (const id of nuevosAcomp) {
        if (!actuales.has(id)) {
          await connection.execute(
            `INSERT INTO viajeros_hospedajes (id_hospedaje, id_viajero, is_principal) VALUES (?, ?, 0)`,
            [id_hospedaje, id],
          );
          console.log("🧱 [CASO_BASE] Acompañante agregado:", id);
        } else {
          const r = actuales.get(id);
          if (r.is_principal) {
            await connection.execute(
              `UPDATE viajeros_hospedajes SET is_principal = 0 WHERE id_hospedaje = ? AND id_viajero = ?`,
              [id_hospedaje, id],
            );
            console.log(
              "🧱 [CASO_BASE] Acompañante corregido de principal→0:",
              id,
            );
          }
        }
      }
    }

    return { ok: true };
  });
}

/* =========================
 * CONTROLADOR PRINCIPAL
 * ========================= */

const editar_reserva_definitivo = async (req, res) => {
  console.log("😒😒😒😒😒😒", req.body.venta.current.total);

  try {
    return await runTransaction(async (connection) => {
      console.log("🚀 [EDITAR_RESERVA] Iniciando editar_reserva_definitivo");

      const {
        metadata,
        venta,
        noches,
        check_in,
        check_out,
        proveedor,
        estado_reserva,
        viajero,
        acompanantes,
        codigo_reservacion_hotel,
        comments,
        hotel,
        habitacion,
        nuevo_incluye_desayuno,
        impuestos,
        saldos,
        restante,
        intermediario,
      } = req.body;

      // Validation and initial checks
      if (
        !metadata?.id_servicio ||
        !metadata?.id_hospedaje ||
        !metadata?.id_booking
      ) {
        return res.status(400).json({
          error: "Faltan IDs clave (id_servicio, id_hospedaje, id_booking).",
        });
      }

      if (
        estado_reserva?.before === "Confirmada" &&
        estado_reserva?.current === "Cancelada"
      ) {
        const response = await executeQuery(
          "UPDATE hospedajes SET codigo_reservacion_hotel = CONCAT(codigo_reservacion_hotel,'_CANCEL_', RIGHT(REPLACE(id_hospedaje, '-', ''), 8)) WHERE id_hospedaje = ?",
          [metadata.id_hospedaje],
        );
      }

      const hayCambioPrecio = hasPrecioChange(venta);
      const hayCambioNoches = hasNochesChange(noches);
      const haySaldos = Array.isArray(saldos) && saldos.length > 0;
      const restanteNum = toNumber(restante, NaN);
      let item_ajuste = null;
      let delta_precio_venta = 0;
      let monto_restante_a_credito = 0;
      let cambia_precio_de_venta = false;
      let tipo_pago_original = null;
      let debeProcesarMonetario =
        hayCambioPrecio ||
        (hayCambioNoches && hayCambioPrecio) ||
        haySaldos ||
        Number.isFinite(restanteNum);

      // ⚠️ Parche especial:
      // Si hay cambio de noches PERO NO cambio de precio,
      // se desactiva el procesamiento monetario.
      if (hayCambioNoches && !hayCambioPrecio) {
        debeProcesarMonetario = false;
      }

      console.log("🔎 [EDITAR_RESERVA] Flags:", {
        hayCambioPrecio,
        hayCambioNoches,
        haySaldos,
        restanteNum,
        debeProcesarMonetario,
      });

      if (hayCambioNoches && !Number.isFinite(noches?.current)) {
        return res.status(400).json({
          error: "Cambio de noches detectado, pero falta noches.current.",
        });
      }

      // Solo caso base
      if (!debeProcesarMonetario) {
        console.log("\n\n\n\nthis it:\n", intermediario, "\n\n\n\n");
        const respBase = await caso_base_tolerante({
          id_servicio: metadata.id_servicio,
          id_hospedaje: metadata.id_hospedaje,
          id_booking: metadata.id_booking,
          total: undefined,
          estado: estado_reserva?.current,
          check_in,
          check_out,
          costo_total: proveedor?.current?.total,
          noches,
          id_viajero_principal: viajero?.current?.id_viajero,
          acompanantes,
          codigo_reservacion_hotel,
          comments,
          hotel,
          habitacion,
          nuevo_incluye_desayuno,
          intermediario,
        });

        console.log(
          "✅ [EDITAR_RESERVA] Caso base aplicado sin cambios monetarios.",
        );

        // NUEVO: Si hay cambio de noches, actualizamos items aunque no haya monetario.
        try {
          let items_nuevos = [];
          const { cambian_noches } = Calculo.cambian_noches(noches || {});
          const delta_noches_seguro =
            (Number.isFinite(noches?.current)
              ? noches.current
              : toNumber(noches?.current, NaN)) -
            (Number.isFinite(noches?.before)
              ? noches.before
              : toNumber(noches?.before, NaN));

          if (
            cambian_noches &&
            Number.isFinite(delta_noches_seguro) &&
            delta_noches_seguro !== 0
          ) {
            await runTransaction(async (connection) => {
              if (delta_noches_seguro > 0) {
                // Crear noches nuevas con total = 0 (y saldo = 0)
                const items_activos_actuales = await Item.findActivos(
                  connection,
                  metadata.id_hospedaje,
                  "ASC",
                );
                const fecha_ultima =
                  items_activos_actuales.length > 0
                    ? items_activos_actuales[items_activos_actuales.length - 1]
                        .fecha_uso
                    : check_in?.current;

                // pasar precio 0 para que el item nuevo tenga total 0
                items_nuevos = await Item.agregar_nuevas_noches(
                  connection,
                  metadata.id_hospedaje,
                  fecha_ultima,
                  delta_noches_seguro,
                  0,
                );

                // Asegurar total/saldo 0 en caso de que la función cree valores distintos
                const ids = (items_nuevos || [])
                  .map((it) => it.id_item)
                  .filter(Boolean);
                if (ids.length) {
                  const ph = makeInPlaceholders(ids.length);
                  await connection.execute(
                    `UPDATE items SET total = 0, saldo = 0 WHERE id_item IN (${ph})`,
                    ids,
                  );
                }
                console.log(
                  "🧾 [ITEMS] Noches añadidas (no monetario) count:",
                  items_nuevos.length,
                );
              } else {
                // Desactivar noches LIFO (mantener comportamiento existente; no ajuste fiscal aquí)
                const cantidad = Math.abs(delta_noches_seguro);
                const items_desactivados = await Item.desactivar_noches_lifo(
                  connection,
                  metadata.id_hospedaje,
                  cantidad,
                );
                console.log(
                  "🧾 [ITEMS] Noches desactivadas (no monetario) count:",
                  items_desactivados.length,
                );
                // No se manejan pasos fiscales porque no estamos procesando monetario.
              }
            });
          } else {
            console.log(
              "🧾 [ITEMS] No hay cambio de noches para procesar en modo no-monetario.",
            );
          }
        } catch (e) {
          console.error(
            "🧾 [ITEMS][ERROR] Falló actualización de items en modo no-monetario:",
            e?.message || e,
          );
          // No forzamos rollback del caso_base_tolerante aquí: devolvemos error 500 para visibilidad.
          return res.status(500).json({
            error: "Ocurrió un error al actualizar items en modo no-monetario.",
            detalle: e?.message || e,
          });
        }

        return res.status(200).json({
          message: "Caso base aplicado sin cambios monetarios",
          resultado_paso_1: respBase,
          modo: "caso_base_only",
        });
      }
      console.log("✌️✌️✌️✌️✌️✌️", venta);
      // PASO 1: Caso base (refleja total si hay cambios monetarios)
      const totalNuevo = Formato.number(venta?.current?.total);
      console.log("🔔 [MONETARIO] totalNuevo calculado:", totalNuevo);
      const respBase = await caso_base_tolerante({
        id_servicio: metadata.id_servicio,
        id_hospedaje: metadata.id_hospedaje,
        id_booking: metadata.id_booking,
        total: totalNuevo,
        estado: estado_reserva?.current,
        check_in,
        check_out,
        costo_total: proveedor?.current?.total,
        noches,
        id_viajero_principal: viajero?.current?.id_viajero,
        acompanantes,
        codigo_reservacion_hotel,
        comments,
        hotel,
        habitacion,
        nuevo_incluye_desayuno,
        intermediario,
      });

      console.log(
        "🧱 [EDITAR_RESERVA] Caso base aplicado (con/para cambios monetarios).",
      );

      // PASO 2: Monetario
      let estado_fiscal;
      let saldos_filtrados = [];
      let items_nuevos = [];
      if (debeProcesarMonetario) {
        const TASA_IVA_DECIMAL = impuestos?.iva / 100.0 || 0.16;

        const { cambian_noches, delta_noches } = Calculo.cambian_noches(noches);
        const delta_noches_seguro =
          (Number.isFinite(noches?.current)
            ? noches.current
            : toNumber(noches?.current, NaN)) -
          (Number.isFinite(noches?.before)
            ? noches.before
            : toNumber(noches?.before, NaN));

        cambia_precio_de_venta = Calculo.cambia_precio_de_venta(venta);
        delta_precio_venta =
          (Number.isFinite(venta?.current?.total)
            ? venta.current.total
            : toNumber(venta?.current?.total, 0)) -
          (Number.isFinite(venta?.before?.total)
            ? venta.before.total
            : toNumber(venta?.before?.total, 0));
        delta_precio_venta = toNumber(delta_precio_venta, 0);

        console.log("🔔 [MONETARIO] Cambia precio de venta:", {
          cambia_precio_de_venta,
          delta_precio_venta,
          cambian_noches,
          delta_noches_seguro,
          TASA_IVA_DECIMAL,
        });

        tipo_pago_original = await get_payment_type(
          metadata.id_solicitud,
          metadata.id_servicio,
        );

        estado_fiscal = await is_invoiced_reservation(
          connection,
          metadata.id_servicio,
        );
        console.log("🧾 [FISCAL] Estado fiscal de la reserva:", estado_fiscal);

        saldos_aplicados = Array.isArray(saldos)
          ? saldos.filter(
              (s) => s.usado === true && parseFloat(s.saldo_usado || 0) > 0,
            )
          : [];

        // <<<< REDEFINICIÓN USADA >>>>
        const { saldos_filtrados, facturas_wallet } =
          await are_invoiced_payments({ saldos: saldos_aplicados });

        monto_restante_a_credito = Number.isFinite(restanteNum)
          ? Math.max(restanteNum, 0)
          : 0;
        console.log(
          "💰 [MONETARIO] saldos_aplicados:",
          saldos_aplicados.length,
          "saldos_facturados_usados:",
          saldos_filtrados.length,
          "restanteNum:",
          restanteNum,
          "monto_restante_a_credito:",
          monto_restante_a_credito,
        );

        let items_activos_originales = await Item.findActivos(
          connection,
          metadata.id_hospedaje,
          "ASC",
        );

        let items_nuevos = [];
        let items_activos_actuales;

        // 1) ITEMS
        if (
          tipo_pago_original === "credito" &&
          (delta_precio_venta < 0 || delta_noches_seguro < 0)
        ) {
          console.log("🧾 [ITEMS] Modo crédito decremental.");

          // 1.1 Ajuste de crédito (pagos_credito + saldo agente)
          await actualizar_credito_existente(
            connection,
            metadata.id_servicio,
            delta_precio_venta,
            metadata.id_agente,
          );

          // 1.2 Refrescamos items activos actuales (antes de aplicar split)
          items_activos_actuales = await Item.findActivos(
            connection,
            metadata.id_hospedaje,
            "ASC",
          );
        } else {
          // Caso normal (no crédito decremental): partimos de los items originales
          items_activos_actuales = [...items_activos_originales];

          // A) ΔNoches
          if (delta_noches_seguro > 0) {
            const fecha_ultima =
              items_activos_actuales.length > 0
                ? items_activos_actuales[items_activos_actuales.length - 1]
                    .fecha_uso
                : check_in?.current;

            const noches_finales = toNumber(noches?.current, 0);
            const precio_noche_std =
              noches_finales > 0 ? venta.current.total / noches_finales : 0;

            // nuevas noches (saldo=0)
            items_nuevos = await Item.agregar_nuevas_noches(
              connection,
              metadata.id_hospedaje,
              fecha_ultima,
              delta_noches_seguro,
              precio_noche_std,
            );
            console.log(
              "🧾 [ITEMS] Nuevas noches creadas:",
              items_nuevos.length,
            );
          } else if (delta_noches_seguro < 0) {
            const items_desactivados = await Item.desactivar_noches_lifo(
              connection,
              metadata.id_hospedaje,
              Math.abs(delta_noches_seguro),
            );
            console.log(
              "🧾 [ITEMS] Noches desactivadas (LIFO):",
              items_desactivados.length,
            );
            if (estado_fiscal.es_facturada && items_desactivados.length > 0) {
              await manejar_desactivacion_fiscal(
                connection,
                items_desactivados,
                estado_fiscal.facturas,
              );
            }
          }

          // Refrescamos items activos con las noches nuevas / desactivadas
          items_activos_actuales = await Item.findActivos(
            connection,
            metadata.id_hospedaje,
            "ASC",
          );
        }

        // B) ΔPrecio
        const nuevo_total_venta = venta?.current?.total ?? venta?.before?.total;
        if (delta_precio_venta > 0) {
          const costo_noches_nuevas = (
            Array.isArray(items_nuevos) ? items_nuevos : []
          ).reduce((sum, it) => sum + getItemTotal(it), 0);

          const delta_residual = delta_precio_venta - costo_noches_nuevas;
          if (delta_residual > 0.01) {
            item_ajuste = await Item.crear_item_ajuste(
              connection,
              metadata.id_hospedaje,
              delta_residual,
              TASA_IVA_DECIMAL,
            );
            console.log(
              "🧾 [ITEMS] Item de ajuste creado por delta residual:",
              delta_residual,
              "id_item:",
              item_ajuste?.id_item,
            );
          } else {
            console.log(
              "🧾 [ITEMS] Delta cubierto por noches nuevas; no se crea item de ajuste.",
            );
          }
        } else if (delta_precio_venta < 0) {
          await Item.aplicar_split_precio(
            connection,
            items_activos_actuales,
            nuevo_total_venta,
            TASA_IVA_DECIMAL,
          );
          console.log(
            "🧾 [ITEMS] Split de precio aplicado ->",
            nuevo_total_venta,
          );
          if (estado_fiscal.es_facturada) {
            await manejar_reduccion_fiscal(
              connection,
              items_activos_actuales,
              estado_fiscal.facturas,
              metadata.id_agente,
              restanteNum,
            );
          }
        } else if (delta_precio_venta === 0 && cambian_noches) {
          await Item.aplicar_split_precio(
            connection,
            items_activos_actuales,
            nuevo_total_venta,
            TASA_IVA_DECIMAL,
          );
          console.log(
            "🧾 [ITEMS] Split de precio por cambio de noches con delta_precio_venta=0.",
          );
        }
      }

      // === HERENCIA FISCAL (reserva facturada y/o wallets facturados) ===
      try {
        const hayReservaFacturada = !!estado_fiscal?.es_facturada;
        const haySaldosFacturados = saldos_filtrados.length > 0;

        // Items a fiscalizar: noches nuevas + ajuste positivo
        const items_para_fiscal = [
          ...(Array.isArray(items_nuevos) ? items_nuevos : []),
          ...(item_ajuste ? [item_ajuste] : []),
        ];

        if (
          (hayReservaFacturada || haySaldosFacturados) &&
          items_para_fiscal.length > 0
        ) {
          // ================================================
          // 🛠 FIX REAL DE ESPACIO FISCAL DISPONIBLE
          // ================================================
          const facturas_disponibles_final = Array.isArray(
            estado_fiscal?.facturas,
          )
            ? estado_fiscal.facturas.map((f) => {
                const total = Number(f.total || 0);
                const facturado = Number(f.monto_reserva_facturado || 0);

                // Espacio fiscal REAL disponible
                const espacioDisponible = Math.max(total - facturado, 0);

                return {
                  id_factura: String(f.id_factura),
                  saldo_interpretado_para_items: espacioDisponible,
                };
              })
            : [];

          console.log(
            "🧾[FISCAL][FIX] facturas_disponibles_final =",
            facturas_disponibles_final,
          );

          // Calcular total de espacio REAL disponible
          const totalSaldoDisponible = facturas_disponibles_final.reduce(
            (acc, f) => acc + Number(f.saldo_interpretado_para_items || 0),
            0,
          );

          console.log(
            "🧾[FISCAL][FIX] totalSaldoDisponible (REAL) =",
            totalSaldoDisponible,
          );

          // ================================================
          // 🛡 BLOQUEADOR: si no hay espacio → NO asociar incremento
          // ================================================
          if (totalSaldoDisponible <= 0.009) {
            console.warn(
              "🧾[FISCAL][FIX] 0 de espacio fiscal → NO se asociará el incremento a facturas.",
            );
            facturas_disponibles_final.length = 0;
          }

          // ================================================
          // EJECUCIÓN DE HERENCIA FISCAL SI QUEDA ESPACIO
          // ================================================
          if (facturas_disponibles_final.length === 0) {
            console.warn(
              "🧾[FISCAL] No hay facturas disponibles (después del FIX). Se omite herencia fiscal.",
            );
          } else {
            console.log(
              "🧾[FISCAL] Ejecutando herencia fiscal para items:",
              items_para_fiscal.map((i) => i.id_item),
              "con facturas:",
              facturas_disponibles_final.map(
                (f) => `${f.id_factura}:${f.saldo_interpretado_para_items}`,
              ),
            );

            await asociar_factura_items_logica(
              connection,
              metadata.id_hospedaje,
              items_para_fiscal,
              facturas_disponibles_final,
            );

            console.log(
              "🧾[FISCAL] Herencia fiscal completada para",
              items_para_fiscal.length,
              "items.",
            );
          }
        } else {
          console.log(
            "🧾[FISCAL] No se ejecuta herencia fiscal. Condiciones:",
            {
              hayReservaFacturada,
              haySaldosFacturados,
              items_para_fiscal: items_para_fiscal.length,
            },
          );
        }
      } catch (e) {
        console.error(
          "🧾[FISCAL][ERROR] Falló herencia fiscal:",
          e?.message || e,
        );
        throw e; // rollback
      }

      // 2) PAGOS – WALLET / CRÉDITO
      if (
        delta_precio_venta > 0 ||
        saldos_aplicados.length > 0 ||
        monto_restante_a_credito > 0
      ) {
        let monto_total_a_cubrir = Math.max(delta_precio_venta, 0);
        const items_a_pagar = [];

        if (item_ajuste)
          items_a_pagar.push({
            id_item: item_ajuste.id_item,
            total: parseFloat(item_ajuste.total),
          });
        for (const it of items_nuevos) {
          items_a_pagar.push({
            id_item: it.id_item,
            total: getItemTotal(it),
          });
        }

        console.log(
          "💳 [PAGOS] Items a pagar (ajuste+nuevos):",
          items_a_pagar.length,
          "monto_total_a_cubrir:",
          monto_total_a_cubrir,
        );

        // 2.1 WALLET -> split a items_pagos
        if (saldos_aplicados.length > 0) {
          const walletDisponible = Array.isArray(saldos_aplicados)
            ? saldos_aplicados.reduce((acc, s) => {
                const v =
                  Number(s?.saldo_usado) ??
                  Number(s?.saldo_disponible) ??
                  Number(s?.saldo) ??
                  Number(s?.monto) ??
                  0;
                return acc + (Number.isFinite(v) ? v : 0);
              }, 0)
            : 0;

          let restanteWallet = Math.min(
            walletDisponible,
            monto_total_a_cubrir || walletDisponible,
          );
          const asociacionesWallet = [];

          for (const it of items_a_pagar) {
            if (restanteWallet <= 0) break;
            let asignar = Math.min(
              Number(it.total || 0),
              Number(restanteWallet || 0),
            );
            asignar = Number(asignar.toFixed(2));
            if (asignar > 0.009) {
              asociacionesWallet.push({
                id_item: it.id_item,
                monto: asignar,
              });
              restanteWallet = Number((restanteWallet - asignar).toFixed(2));
            }
          }
          const cubiertoWallet = Number(
            (
              Math.min(
                walletDisponible,
                monto_total_a_cubrir || walletDisponible,
              ) - Math.max(restanteWallet, 0)
            ).toFixed(2),
          );

          if (asociacionesWallet.length > 0 && cubiertoWallet > 0.009) {
            // 1) Crear el pago con el monto EXACTO aplicado a ítems
            const id_pago_wallet = await crear_pago_desde_wallet(
              connection,
              metadata.id_servicio,
              metadata.id_agente,
              cubiertoWallet, // 👈 usa el cubierto real, no "monto_total"
              saldos_aplicados,
            );

            if (id_pago_wallet) {
              // 2) Tu asociar_items_a_pago, por lo que se ve en tus logs previos, espera: [id_item, id_pago, monto, id_hospedaje]
              const asociacionesWalletConPago = asociacionesWallet.map((a) => [
                a.id_item, // id del item
                id_pago_wallet, // id del pago recién creado
                a.monto, // monto para ese item
                metadata.id_hospedaje, // id_hospedaje
              ]);

              await asociar_items_a_pago(
                connection,
                metadata.id_hospedaje,
                id_pago_wallet,
                asociacionesWallet,
              );
              console.log(
                "💳 [PAGOS] asociacionesWallet:",
                asociacionesWalletConPago.length,
                "id_pago:",
                id_pago_wallet,
              );

              // 3) Rebaja SÓLO lo realmente usado en wallet (distribución simple en orden)
              let restantePorRebajar = cubiertoWallet;
              const saldos_para_rebajar = [];

              for (const s of saldos_aplicados) {
                if (restantePorRebajar <= 0.009) break;
                const disponible =
                  Number(s?.saldo_usado) ??
                  Number(s?.saldo_disponible) ??
                  Number(s?.saldo) ??
                  Number(s?.monto) ??
                  0;

                const usa = Math.min(disponible, restantePorRebajar);
                if (s?.id_saldos && usa > 0.009) {
                  saldos_para_rebajar.push({
                    id_saldos: s.id_saldos,
                    saldo_usado: Number(usa.toFixed(2)),
                  });
                  restantePorRebajar = Number(
                    (restantePorRebajar - usa).toFixed(2),
                  );
                }
              }

              if (saldos_para_rebajar.length > 0) {
                await rebajar_wallet_saldos(connection, saldos_para_rebajar);
                console.log(
                  "💳 [WALLET] Rebaja aplicada:",
                  saldos_para_rebajar,
                );
              }
            } else {
              console.warn(
                "💳 [WALLET] No se pudo crear el pago desde wallet (id_pago_wallet nulo).",
              );
            }
          }

          if (monto_total_a_cubrir > 0) {
            const cubiertoWallet =
              walletDisponible - Math.max(restanteWallet, 0);
            monto_total_a_cubrir -= cubiertoWallet;
            console.log(
              "💳 [PAGOS] Wallet cubrió:",
              cubiertoWallet,
              "pendiente por cubrir:",
              monto_total_a_cubrir,
            );
          }
        }

        // 2.2 CRÉDITO (si queda pendiente)
        if (
          monto_restante_a_credito > 0 &&
          (monto_total_a_cubrir || 0) > 0.01
        ) {
          const aplicarCredito = Math.min(
            monto_total_a_cubrir,
            monto_restante_a_credito,
          );
          await crear_nuevo_pago_credito(
            connection,
            metadata.id_servicio,
            aplicarCredito,
            metadata.id_agente,
            metadata.id_empresa,
          );
          await connection.execute(
            "UPDATE agentes SET saldo = saldo - ? WHERE id_agente = ?",
            [aplicarCredito, metadata.id_agente],
          );
          console.log(
            "🏦 [CREDITO] Aplicado a servicio:",
            aplicarCredito,
            "agente:",
            metadata.id_agente,
          );
        }
      }

      // 2.3 Devoluciones por ajuste negativo (restante < 0)
      console.log(
        "🔄 [DEVOLUCION] Checando devolución por ajuste negativo...",
        { cambia_precio_de_venta, delta_precio_venta, restanteNum },
      );

      //DEVOLUCIÓN DE SALDO
      // === BLOQUE CORREGIDO: DEVOLUCIÓN DE SALDO (MANEJO DE SALDO EXISTENTE Y FACTURACIÓN) ===
      if (
        cambia_precio_de_venta &&
        delta_precio_venta < 0 &&
        Number.isFinite(restanteNum) &&
        restanteNum <= 0
      ) {
        const monto_devolucion = Math.abs(restanteNum);
        const concepto = `Devolucion por ajuste de reserva en ${metadata.hotel_reserva ?? ""}`;

        if (!metadata?.id_agente) {
          console.warn(
            "🔄 [DEVOLUCION] No hay id_agente en metadata; se omite devolución.",
          );
        } else if (tipo_pago_original === "credito") {
          console.log(
            "🔄 [DEVOLUCION] Reserva a crédito: se omite devolución de saldo.",
          );
        } else {
          // 1. Buscamos el pago y verificamos si ya tiene un saldo asociado y si está facturado
          const [rows_pago] = await connection.execute(
            `SELECT id_pago, id_saldo_a_favor, is_facturado, total, saldo_aplicado 
       FROM pagos WHERE id_servicio = ? ORDER BY fecha_creacion ASC LIMIT 1`,
            [metadata.id_servicio],
          );

          if (rows_pago.length > 0) {
            const pago = rows_pago[0];
            const id_pago_original = pago.id_pago;

            if (pago.id_saldo_a_favor) {
              // --- ESCENARIO B: REINTEGRAR A SALDO EXISTENTE ---
              console.log(
                "🔄 [DEVOLUCION] El pago ya tiene saldo asociado. Reintegrando...",
              );
              await connection.execute(
                `UPDATE saldos_a_favor 
           SET saldo = saldo + ?, updated_at = NOW(), activo = 1 
           WHERE id_saldos = ?`,
                [monto_devolucion, pago.id_saldo_a_favor],
              );

              await connection.execute(
                `UPDATE pagos 
           SET saldo_aplicado = GREATEST(0, COALESCE(saldo_aplicado, 0) - ?),
               estado = IF(COALESCE(saldo_aplicado, 0) - ? <= 0, 'Devuelto', estado)
           WHERE id_pago = ?`,
                [monto_devolucion, monto_devolucion, id_pago_original],
              );
            } else {
              // --- ESCENARIO A: CREAR NUEVO SALDO A FAVOR (PAGO DIRECTO) ---
              console.log(
                "🔄 [DEVOLUCION] Creando nuevo saldo a favor y vinculando facturación...",
              );

              const [resultSaldo] = await connection.execute(
                `INSERT INTO saldos_a_favor (
            id_agente, monto, saldo, concepto, activo, is_facturable, 
            is_devolucion, is_facturado, monto_facturado, fecha_creacion, fecha_pago
          ) VALUES (?, ?, ?, ?, 1, 0, 1, ?, 0, NOW(), NOW())`,
                [
                  metadata.id_agente,
                  pago.total, // El monto total del pago original
                  monto_devolucion, // Lo que realmente se devuelve como saldo disponible
                  concepto,
                  pago.is_facturado, // Heredamos si el pago ya estaba facturado
                ],
              );

              const newIdSaldo = resultSaldo.insertId;

              // Actualizar el pago con el nuevo saldo
              await connection.execute(
                `UPDATE pagos 
           SET id_saldo_a_favor = ?, saldo_aplicado = ?, estado = 'Devuelto' 
           WHERE id_pago = ?`,
                [newIdSaldo, monto_devolucion, id_pago_original],
              );

              // VINCULACIÓN DE FACTURACIÓN: Si el pago estaba en una factura, asociamos el saldo
              await connection.execute(
                `UPDATE facturas_pagos_y_saldos 
           SET id_saldo_a_favor = ?, updated_at = NOW() 
           WHERE id_pago = ?`,
                [newIdSaldo, id_pago_original],
              );
            }

            // --- AJUSTE DE ITEMS_PAGOS (Reparto igualitario) ---
            // Mantenemos tu lógica de redondeo para que los items sumen el nuevo total de venta
            const objetivoPago = Number(Formato.number(venta?.current?.total));

            await connection.execute(
              `UPDATE items_pagos ip
         JOIN (SELECT id_pago, COUNT(*) AS n FROM items_pagos WHERE id_pago = ?) t ON t.id_pago = ip.id_pago
         SET ip.monto = ROUND(? / NULLIF(t.n, 0), 2)
         WHERE ip.id_pago = ?`,
              [id_pago_original, objetivoPago, id_pago_original],
            );

            // Ajuste de centavos final
            const [sumRows] = await connection.execute(
              `SELECT COALESCE(SUM(monto), 0) AS suma, MIN(id_item) AS any_item 
         FROM items_pagos WHERE id_pago = ?`,
              [id_pago_original],
            );
            const delta = Number((objetivoPago - sumRows[0].suma).toFixed(2));
            if (Math.abs(delta) >= 0.01 && sumRows[0].any_item) {
              await connection.execute(
                `UPDATE items_pagos SET monto = monto + ? WHERE id_item = ?`,
                [delta, sumRows[0].any_item],
              );
            }
          }
        }
      }

      console.log(
        "🧾 [TX] --- FIN PASO 2: TRANSACCION MONETARIA COMPLETA (COMMIT) ---",
      );

      // console.log("✅ [EDITAR_RESERVA] Reserva actualizada exitosamente.");
      return res.status(200).json({
        message: "Reserva actualizada exitosamente",
        resultado_paso_1: respBase,
      });
    });
  } catch (error) {
    console.error(
      "💥 [EDITAR_RESERVA][ERROR] Capturado en el controlador:",
      error,
    );

    // Manejo específico de errores
    if (error?.message === "(revisar la data con finanzas)") {
      return res.status(400).json({
        error: "Conflicto de integridad de datos.",
        detalle: error.message,
      });
    }

    // Error general
    return res.status(500).json({
      error: "Ocurrió un error al procesar la edición.",
      detalle: error?.message,
    });
  }
};

const obtener = async (req, res) => {
  let { page, length, usuario_creador } = req.query;

  if (usuario_creador && !req.query.id_client) {
    throw new Error("No puede existir un usuario creador sin un id cliente");
  }
  page = page ? Number(page) : null;
  length = length ? Number(length) : null;

  const hasPagination = page && length;

  if (hasPagination && page < 1) {
    return res.status(400).json({ message: "Parámetros inválidos" });
  }

  const offset = hasPagination ? (page - 1) * length : null;

  const where = [];
  const params = [];

  /* =========================
     FILTROS
  ==========================*/
  where.push(`(admin_creador <> ? OR admin_creador is null)`);
  params.push("cef88247-b690-11f0-9e79-06cc8e8ac9fd");

  // Código reservación
  if (req.query.codigo_reservacion) {
    where.push(`codigo_confirmacion LIKE CONCAT('%', ?, '%')`);
    params.push(req.query.codigo_reservacion);
  }

  // Proveedor
  if (req.query.proveedor) {
    where.push(`proveedor LIKE CONCAT('%', ?, '%')`);
    params.push(req.query.proveedor);
  }

  // ID cliente
  if (req.query.id_client) {
    where.push(`id_agente LIKE CONCAT('%', ?, '%')`);
    params.push(req.query.id_client);
  }

  // Cliente (nombre agente)
  if (req.query.cliente) {
    where.push(`agente LIKE CONCAT('%', ?, '%')`);
    params.push(req.query.cliente);
  }

  // Viajero
  if (req.query.traveler) {
    where.push(`viajero LIKE CONCAT('%', ?, '%')`);
    params.push(req.query.traveler);
  }

  // Estado
  if (req.query.status) {
    where.push(`estado = ?`);
    params.push(req.query.status);
  }

  // Etapa reservación
  if (req.query.reservationStage) {
    where.push(`etapa_reservacion = ?`);
    params.push(req.query.reservationStage);
  }

  // Reservante
  if (req.query.reservante) {
    where.push(`reservante = ?`);
    params.push(req.query.reservante);
  }

  // Método de pago
  if (req.query.paymentMethod) {
    where.push(`metodo_pago = ?`);
    params.push(req.query.paymentMethod);
  }

  /* =========================
     FILTRO DE FECHA DINÁMICO
  ==========================*/

  const { startDate, endDate, filterType } = req.query;

  if (startDate || endDate) {
    let column = "created_at";

    if (filterType) {
      const type = filterType.toLowerCase();

      if (type === "check in") column = "check_in";
      if (type === "check out") column = "check_out";
      if (type === "transaccion") column = "created_at";
    }
    if (startDate && endDate) {
      where.push(`${column} >= ? AND ${column} <= ?`);
      params.push(startDate + " 00:00:00", endDate + " 23:59:59");
      console.log(startDate, endDate);
    } else if (startDate) {
      where.push(`${column} >= ?`);
      params.push(startDate + " 00:00:00");
    } else if (endDate) {
      where.push(`${column} <= ?`);
      params.push(endDate + " 23:59:59");
    }
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sqlTotal = `
    SELECT COUNT(*) AS total
    FROM vw_new_reservas
    ${whereSQL}
  `;

  const sqlData = `
  SELECT *
  FROM vw_new_reservas
  ${whereSQL}
  ORDER BY created_at DESC
  ${hasPagination ? `LIMIT ${length} OFFSET ${offset}` : ""}
`;

  try {
    const [{ total }] = await executeQuery(sqlTotal, params);

    let data = await executeQuery(sqlData, [...params]);
    if (usuario_creador && req.query.id_client) {
      const [{ restringido }] = await executeQuery(
        `select restringido from agentes where id_agente = ?`,
        [req.query.id_client],
      );
      if (Boolean(restringido)) {
        data = data.filter((i) => i.id_user_creador == usuario_creador);
      }
    }

    res.status(200).json({
      message: "ok",
      data,
      metadata: { page, length, total },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error });
  }
};

const cancelarBooking = async (req, res) => {
  const { id_booking } = req.body;
  const cancelar = async (conn, id_booking) => {
    try {
      conn.execute(
        `UPDATE bookings SET estado = "Cancelada" WHERE id_booking = ?`,
        [id_booking],
      );
    } catch (error) {
      throw error;
    }
  };
  try {
    const response = await runTransaction(async (conn) => {
      await cancelar(conn, id_booking);
    });
    res.status(200).json({ message: "obtenido bien", data: { response } });
  } catch (error) {
    res.status(error.status || error.statusCode || 500).json({
      message: error.message || "Error al obtenr los datos",
      error,
      data: null,
    });
  }
};

module.exports = { editar_reserva_definitivo, obtener, cancelarBooking };
