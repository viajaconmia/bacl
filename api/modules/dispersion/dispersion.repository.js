const { getExecutor } = require("../../../config/db");

class DispersionRepository {
  /**
   * @param {string} codigo - codigo_dispersion a verificar
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<boolean>}
   */
  async existsByCodigo(codigo, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT 1 FROM dispersion_pagos_proveedor WHERE codigo_dispersion = ? LIMIT 1`,
      [codigo],
    );
    return rows.length > 0;
  }

  /**
   * @param {Array<[number, number, number, number, string, string|null, number]>} rows
   *   [id_solicitud_proveedor, monto_solicitado, saldo, monto_pagado, codigo_dispersion, fecha_pago, id_proveedor_cuenta]
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{ insertId: number, affectedRows: number }>}
   */
  async insertDispersiones(rows, conn = null) {
    const run = getExecutor(conn);
    const placeholders = rows.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");

    const result = await run(
      `INSERT INTO dispersion_pagos_proveedor (
        id_solicitud_proveedor,
        monto_solicitado,
        saldo,
        monto_pagado,
        codigo_dispersion,
        fecha_pago,
        id_proveedor_cuenta
      ) VALUES ${placeholders}`,
      rows.flat(),
    );

    return { insertId: result.insertId, affectedRows: result.affectedRows };
  }
}

module.exports = new DispersionRepository();
