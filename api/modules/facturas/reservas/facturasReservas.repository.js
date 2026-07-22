const { getExecutor } = require("../../../../config/db");

class FacturasReservasRepository {
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
        SUM(fi.monto)          AS monto_asignado,
        fi.id_relacion,
        vw.id_booking,
        vw.id_agente,
        vw.nombre_agente,
        vw.id_confirmacion     AS codigo_confirmacion,
        vw.proveedor,
        vw.total,
        vw.nombre_viajero
      FROM items_facturas fi
        LEFT JOIN vw_details_booking vw ON vw.id_relacion = fi.id_relacion
      WHERE fi.id_factura = ?
      GROUP BY fi.id_relacion
      `,
      [id_factura],
    );
  }

  async findPendientes(id_agente, conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT
        vw.id_relacion,
        vw.id_confirmacion AS codigo_confirmacion,
        vw.proveedor,
        vw.type,
        vw.nombre_agente,
        vw.metodo_pago,
        vw.total,
        vw.check_in,
        vw.check_out,
        vw.created_at,
        COALESCE(SUM(fi.monto), 0) AS total_facturado,
        (vw.total - COALESCE(SUM(fi.monto), 0)) AS pendiente_facturar
      FROM vw_details_booking vw
        LEFT JOIN items_facturas fi ON fi.id_relacion = vw.id_relacion
      WHERE vw.id_agente = ? AND vw.estado <> "Cancelada"
      GROUP BY vw.id_relacion
      HAVING (vw.total - COALESCE(SUM(fi.monto), 0)) > 0`,
      [id_agente],
    );
  }
}

module.exports = new FacturasReservasRepository();
