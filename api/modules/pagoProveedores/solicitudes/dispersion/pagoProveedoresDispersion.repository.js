const { getExecutor } = require("../../../../../config/db");

class PagoProveedoresDispersionRepository {
  /**
   * @param {number[]} ids - Array de id_solicitud_proveedor
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findFacturasByIds(ids, conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT
        pfp.id_solicitud,
        fpp.id_factura_proveedor AS id_factura,
        fpp.rfc_emisor           AS rfc,
        fpp.uuid_cfdi            AS uuid,
        fpp.fecha_emision,
        fpp.subtotal,
        fpp.iva,
        fpp.total                AS total_factura,
        pfp.monto_facturado      AS asignado
      FROM pagos_facturas_proveedores pfp
      INNER JOIN facturas_pago_proveedor fpp
        ON fpp.id_factura_proveedor = pfp.id_factura
      WHERE pfp.id_solicitud IN (?)`,
      [ids],
    );
  }
}

module.exports = new PagoProveedoresDispersionRepository();
