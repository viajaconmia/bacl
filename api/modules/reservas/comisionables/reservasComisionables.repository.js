const { getExecutor } = require("../../../../config/db");

const WHERE_COMISIONABLES =
  "WHERE is_comisionable = 1 AND comision_cobrada = 0";

class ReservasComisionablesRepository {
  /**
   * Detalle completo de bookings comisionables pendientes de cobro.
   * @param {{page?: number, length?: number}} filters
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async findAll(filters = {}, conn = null) {
    const run = getExecutor(conn);
    const { page, length } = filters;

    const hasPagination = Boolean(page && length);
    const safeLength = Math.max(Number(length) || 0, 0);
    const offset = hasPagination
      ? (Math.max(Number(page), 1) - 1) * safeLength
      : 0;

    const [rows, countRows] = await Promise.all([
      run(
        `SELECT *
         FROM vw_new_details_booking
         ${WHERE_COMISIONABLES}
         ${hasPagination ? `LIMIT ${safeLength} OFFSET ${offset}` : ""}`,
      ),
      hasPagination
        ? run(
            `SELECT COUNT(*) AS total FROM vw_new_details_booking ${WHERE_COMISIONABLES}`,
          )
        : Promise.resolve(null),
    ]);

    return {
      rows,
      total: countRows ? (countRows[0]?.total ?? 0) : null,
      hasPagination,
    };
  }

  /**
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<number>}
   */
  async count(conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT COUNT(*) AS conteo FROM vw_new_details_booking ${WHERE_COMISIONABLES}`,
    );
    return rows[0]?.conteo ?? 0;
  }

  /**
   * Marca la comisión de un booking como cobrada.
   * @param {number|string} id_booking
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<number>} affectedRows
   */
  async marcarCobrada(id_booking, conn = null) {
    const run = getExecutor(conn);
    const result = await run(
      `UPDATE bookings SET comision_cobrada = 1 WHERE id_booking = ?`,
      [id_booking],
    );
    return result?.affectedRows ?? 0;
  }

  /**
   * Update genérico y acotado por ALLOWED_FIELDS (ver service) sobre bookings.
   * @param {string} id_booking
   * @param {Record<string, unknown>} fields - dbField: value ya validados
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<number>} affectedRows
   */
  async updateFields(id_booking, fields, conn = null) {
    const run = getExecutor(conn);
    const setParts = Object.keys(fields).map((field) => `\`${field}\` = ?`);
    const params = Object.values(fields);

    const result = await run(
      `UPDATE bookings
       SET ${setParts.join(", ")}
       WHERE id_booking = ?`,
      [...params, id_booking],
    );
    return result?.affectedRows ?? 0;
  }
}

module.exports = new ReservasComisionablesRepository();
