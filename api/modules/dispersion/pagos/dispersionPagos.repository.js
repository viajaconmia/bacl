const { getExecutor } = require("../../../../config/db");
const { sqlIn } = require("../../../../v4/utils/sql");

class DispersionPagosRepository {
  /**
   * @param {number[]} ids - id_pago_dispersion a verificar
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<number[]>} ids que ya tienen un pago creado
   */
  async findExistingByDispersionIds(ids, conn = null) {
    const run = getExecutor(conn);
    const { placeholders, params } = sqlIn(ids);
    const rows = await run(
      `SELECT id_pago_dispersion FROM pago_proveedores WHERE id_pago_dispersion IN (${placeholders})`,
      params,
    );
    return rows.map((r) => Number(r.id_pago_dispersion));
  }

  /**
   * INSERT genérico a pago_proveedores — no asume que las filas vienen de una
   * dispersión (id_pago_dispersion puede ir null), reutilizable por otros flujos.
   * @param {Array<[number|null, number|null, string|null, number, Date, string, string|null, number, number]>} rows
   *   [id_pago_dispersion, id_solicitud_proveedor, codigo_dispersion, monto_pagado, fecha_pago, url_pdf, concepto, monto, total]
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{ insertId: number, affectedRows: number }>}
   */
  async insertPagos(rows, conn = null) {
    const run = getExecutor(conn);
    const placeholders = rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");

    const result = await run(
      `INSERT INTO pago_proveedores (
        id_pago_dispersion,
        id_solicitud_proveedor,
        codigo_dispersion,
        monto_pagado,
        fecha_pago,
        url_pdf,
        concepto,
        monto,
        total
      ) VALUES ${placeholders}`,
      rows.flat(),
    );

    return { insertId: result.insertId, affectedRows: result.affectedRows };
  }
}

module.exports = new DispersionPagosRepository();
