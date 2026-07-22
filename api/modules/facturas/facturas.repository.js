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
      `SELECT id_factura, total, saldo, saldo_x_aplicar_items, estado FROM ${this.#table} WHERE id_factura = ?`,
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

    const rows = await run(
      `SELECT f.*
       FROM ${this.#table} f
       ${whereSql}
       ORDER BY f.created_at DESC, f.id_factura DESC
       ${hasPagination ? `LIMIT ${safeLength} OFFSET ${offset}` : ""}`,
      params,
    );

    let total = null;
    if (hasPagination) {
      const countRows = await run(
        `SELECT COUNT(*) AS total FROM ${this.#table} f ${whereSql}`,
        params,
      );
      total = countRows[0]?.total ?? 0;
    }

    return { rows, total, hasPagination };
  }
}

module.exports = new FacturasRepository();
