const { getExecutor } = require("../../../../config/db");
const { sqlIn } = require("../../../../v4/utils/sql");

class PagoProveedoresSolicitudesRepository {
  /**
   * @param {number[]} ids - Array de id_solicitud_proveedor
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findSaldosDispersionByIds(ids, conn = null) {
    const run = getExecutor(conn);
    const { placeholders, params } = sqlIn(ids);
    return run(
      `SELECT id_solicitud_proveedor, saldo_dispersion, estado_solicitud
       FROM solicitudes_pago_proveedor
       WHERE id_solicitud_proveedor IN (${placeholders})`,
      params,
    );
  }

  /**
   * @param {number[]} ids - Array de id_solicitud_proveedor
   * @param {string} estado - Nuevo valor de estado_solicitud
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async updateEstado(ids, estado, conn = null) {
    const run = getExecutor(conn);
    const { placeholders, params } = sqlIn(ids);
    return run(
      `UPDATE solicitudes_pago_proveedor
       SET estado_solicitud = ?
       WHERE id_solicitud_proveedor IN (${placeholders})`,
      [estado, ...params],
    );
  }

  /**
   * Update genérico y acotado por allowlist (ver ALLOWED_FIELDS en el service).
   * @param {number} id_solicitud_proveedor
   * @param {Record<string, unknown>} fields - dbField: value ya validados
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<number>} affectedRows
   */
  async updateFields(id_solicitud_proveedor, fields, conn = null) {
    const run = getExecutor(conn);
    const setParts = Object.keys(fields).map((field) => `\`${field}\` = ?`);
    const params = Object.values(fields);

    const result = await run(
      `UPDATE solicitudes_pago_proveedor
       SET ${setParts.join(", ")}
       WHERE id_solicitud_proveedor = ?`,
      [...params, id_solicitud_proveedor],
    );
    return result?.affectedRows ?? 0;
  }
}

module.exports = new PagoProveedoresSolicitudesRepository();
