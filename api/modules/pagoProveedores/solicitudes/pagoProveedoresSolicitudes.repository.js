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
}

module.exports = new PagoProveedoresSolicitudesRepository();
