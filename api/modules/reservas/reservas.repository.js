const { getExecutor } = require("../../../config/db");

class ReservasRepository {
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

module.exports = new ReservasRepository();
