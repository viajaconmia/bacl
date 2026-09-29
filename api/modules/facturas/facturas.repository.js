const { getExecutor } = require("../../../config/db");

class FacturasRepository {
  #table = "facturas";

  /**
   * @param {string} id_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object|null>}
   */
  async findById(id_factura, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT id_factura, total, saldo, saldo_x_aplicar_items, estado, id_facturama FROM ${this.#table} WHERE id_factura = ?`,
      [id_factura],
    );
    return rows[0] ?? null;
  }

  async findAll(filters = {}, conn = null) {
    const run = getExecutor(conn);
    const {
      estatusFactura,
      id_factura,
      id_cliente,
      cliente,
      uuid,
      rfc,
      startDate,
      endDate,
      page = null,
      length = null,
    } = filters;

    const conditions = [];
    const params = [];

    if (estatusFactura && String(estatusFactura).trim().toUpperCase() !== "TODAS") {
      conditions.push("f.estado = ?");
      params.push(estatusFactura);
    }
    if (id_factura) {
      conditions.push("f.id_factura LIKE CONCAT('%', ?, '%')");
      params.push(id_factura);
    }
    if (id_cliente) {
      conditions.push("f.usuario_creador = ?");
      params.push(id_cliente);
    }
    if (cliente) {
      conditions.push("f.nombre_cliente LIKE CONCAT('%', ?, '%')");
      params.push(cliente);
    }
    if (uuid) {
      conditions.push("f.uuid_factura LIKE CONCAT('%', ?, '%')");
      params.push(uuid);
    }
    if (rfc) {
      conditions.push("f.rfc LIKE CONCAT('%', ?, '%')");
      params.push(rfc);
    }
    if (startDate) {
      conditions.push("f.created_at >= CONCAT(DATE(?), ' 00:00:00')");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("f.created_at <= CONCAT(DATE(?), ' 23:59:59')");
      params.push(endDate);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const pageNum = Number(page);
    const lengthNum = Number(length);
    const hasPagination =
      Number.isFinite(pageNum) && Number.isFinite(lengthNum) && lengthNum > 0;
    const safePage = Math.max(1, Math.trunc(pageNum) || 1);
    const safeLength = Math.trunc(lengthNum) || 20;
    const offset = (safePage - 1) * safeLength;

    const [rows, countRows] = await Promise.all([
      run(
        `SELECT f.*,
                (SELECT COUNT(*) FROM historial_envio_facturas h WHERE h.id_factura = f.id_factura) AS veces_enviada
         FROM ${this.#table} f
         ${whereSql}
         ORDER BY f.created_at DESC, f.id_factura DESC
         ${hasPagination ? `LIMIT ${safeLength} OFFSET ${offset}` : ""}`,
        params,
      ),
      hasPagination
        ? run(`SELECT COUNT(*) AS total FROM ${this.#table} f ${whereSql}`, params)
        : Promise.resolve(null),
    ]);

    return { rows, total: countRows ? (countRows[0]?.total ?? 0) : null, hasPagination };
  }

  /**
   * Update genérico y acotado por ALLOWED_FIELDS (ver service) sobre facturas.
   * @param {string} id_factura
   * @param {Record<string, unknown>} fields - dbField: value ya validados
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<number>} affectedRows
   */
  async updateFields(id_factura, fields, conn = null) {
    const run = getExecutor(conn);
    const setParts = Object.keys(fields).map((field) => `\`${field}\` = ?`);
    const params = Object.values(fields);

    const result = await run(
      `UPDATE ${this.#table}
       SET ${setParts.join(", ")}
       WHERE id_factura = ?`,
      [...params, id_factura],
    );
    return result?.affectedRows ?? 0;
  }

  /**
   * @param {string} uuid_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{id_factura: string, saldo: number}|null>}
   */
  async findByUuidFacturaConSaldo(uuid_factura, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT id_factura, saldo FROM ${this.#table} WHERE uuid_factura = ?`,
      [uuid_factura],
    );
    return rows[0] ?? null;
  }

  /**
   * @param {string} id_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<boolean>}
   */
  async tieneItemsFacturas(id_factura, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT 1 FROM items_facturas WHERE id_factura = ? LIMIT 1`,
      [id_factura],
    );
    return rows.length > 0;
  }

  /**
   * @param {string} id_pago
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{id_pago: string, total: number}|null>}
   */
  async findPago(id_pago, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(`SELECT id_pago, total FROM pagos WHERE id_pago = ?`, [id_pago]);
    return rows[0] ?? null;
  }

  /**
   * @param {string|number} id_saldos
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{id_saldos: number, saldo: number}|null>}
   */
  async findSaldo(id_saldos, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT id_saldos, saldo FROM saldos_a_favor WHERE id_saldos = ?`,
      [id_saldos],
    );
    return rows[0] ?? null;
  }

  /**
   * Pagos fondeados por un saldo a favor (un saldo puede fondear más de uno).
   * @param {string|number} id_saldos
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<string[]>} ids de pago
   */
  async findPagosPorSaldo(id_saldos, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT id_pago FROM pagos WHERE id_saldo_a_favor = ?`,
      [id_saldos],
    );
    return rows.map((r) => r.id_pago);
  }

  /**
   * Reservas (items) que cubren uno o más pagos, con lo que les queda
   * disponible por facturar (monto pagado - ya facturado en items_facturas,
   * de cualquier factura, no solo de la que se está armando ahora). Excluye
   * items ya facturados por completo. Más antiguas primero.
   * @param {string[]} idsPagos
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{id_item: string, monto: number}[]>} monto = lo disponible, no lo pagado original
   */
  async findItemsPagosPorPagos(idsPagos, conn = null) {
    if (!idsPagos.length) return [];
    const run = getExecutor(conn);
    const placeholders = idsPagos.map(() => "?").join(",");
    return run(
      `SELECT x.id_item, (x.monto_pagado - COALESCE(fi.facturado, 0)) AS monto
       FROM (
         SELECT id_item, SUM(monto) AS monto_pagado
         FROM items_pagos
         WHERE id_pago IN (${placeholders})
         GROUP BY id_item
       ) x
       JOIN items i ON i.id_item = x.id_item
       LEFT JOIN (
         SELECT id_item, SUM(monto) AS facturado
         FROM items_facturas
         GROUP BY id_item
       ) fi ON fi.id_item = x.id_item
       WHERE (x.monto_pagado - COALESCE(fi.facturado, 0)) > 0
       ORDER BY i.fecha_uso ASC, x.id_item ASC`,
      idsPagos,
    );
  }

  /**
   * @param {string} id_factura
   * @param {{id_item: string, monto: number}[]} items
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async insertItemsFacturasBatch(id_factura, items, conn = null) {
    if (!items.length) return;
    const run = getExecutor(conn);
    const values = items.map(() => "(?, ?, ?)").join(",");
    const params = items.flatMap((it) => [id_factura, it.id_item, it.monto]);
    await run(
      `INSERT INTO items_facturas (id_factura, id_item, monto) VALUES ${values}`,
      params,
    );
  }

  /**
   * @param {{fkColumn: "id_pago"|"id_saldo_a_favor", raw_id: string|number, id_factura: string, monto: number}} params
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async insertFacturaPagoLink({ fkColumn, raw_id, id_factura, monto }, conn = null) {
    const run = getExecutor(conn);
    // fkColumn viene de código propio (nunca de req.body), es seguro interpolarlo
    const result = await run(
      `INSERT INTO facturas_pagos_y_saldos (${fkColumn}, id_factura, monto) VALUES (?, ?, ?)`,
      [raw_id, id_factura, monto],
    );
    if (!result?.affectedRows) throw new Error("No se pudo vincular el pago/saldo a la factura");
    return result;
  }

  /**
   * @param {{fkColumn: "id_pago"|"id_saldo_a_favor", raw_id: string|number, id_factura: string}} params
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<number>} affectedRows
   */
  async deleteFacturaPagoLink({ fkColumn, raw_id, id_factura }, conn = null) {
    const run = getExecutor(conn);
    // fkColumn viene de código propio (nunca de req.body), es seguro interpolarlo
    const result = await run(
      `DELETE FROM facturas_pagos_y_saldos WHERE ${fkColumn} = ? AND id_factura = ?`,
      [raw_id, id_factura],
    );
    return result?.affectedRows ?? 0;
  }
}

module.exports = new FacturasRepository();
