const { getExecutor } = require("../../../../config/db");

class FacturasPagosRepository {
  /**
   * @param {string} id_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findByFactura(id_factura, conn = null) {
    const run = getExecutor(conn);
    return run(
      `
      SELECT
        SUM(fps.monto) AS monto_asignado,
        p.*
      FROM facturas_pagos_y_saldos fps
        LEFT JOIN pagos p ON fps.id_pago = p.id_pago
      WHERE fps.id_factura = ?
      GROUP BY fps.id_pago, fps.id_factura
      `,
      [id_factura],
    );
  }

  /**
   * Pagos de prepago pendientes de facturar. Usa vw_new_pagos_prepago_facturables
   * (versión optimizada de vw_pagos_prepago_facturables, corre en milisegundos).
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findPrepagoFacturables(conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT *
       FROM vw_new_pagos_prepago_facturables
       WHERE is_facturado = 0 AND monto_por_facturar <> 0 AND id_agente IS NOT NULL`,
    );
  }

  /**
   * Balance de pagos y facturas.
   * PENDIENTE: vw_balance_pagos_facturas es lenta, a diferencia de
   * vw_new_pagos_prepago_facturables. Se deja igual por ahora, separada en su
   * propio endpoint para no bloquear el de prepagoFacturables mientras se optimiza.
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findBalancePagosFacturas(conn = null) {
    const run = getExecutor(conn);
    return run(`SELECT * FROM vw_balance_pagos_facturas`);
  }
}

module.exports = new FacturasPagosRepository();
