const { getExecutor } = require("../../../../config/db");

class PagoProveedoresFacturasRepository {
  /**
   * Busca la solicitud de pago proveedor y el booking asociados a una factura por su uuid_cfdi.
   * @param {string} uuid - uuid_factura, ya trim()eado por el service
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findSolicitudesByUuidFactura(uuid, conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT sfp.monto_facturado, spp.monto_solicitado, fpp.uuid_cfdi AS uuid_factura,
              fpp.id_factura_proveedor, spp.id_booking, vdb.id_confirmacion AS codigo_confirmacion,
              spp.estado_solicitud AS estado, spp.id_solicitud_proveedor AS id_solicitud
       FROM pagos_facturas_proveedores sfp
       INNER JOIN facturas_pago_proveedor fpp ON fpp.id_factura_proveedor = sfp.id_factura
       INNER JOIN solicitudes_pago_proveedor spp ON spp.id_solicitud_proveedor = sfp.id_solicitud
       INNER JOIN vw_details_booking vdb ON vdb.id_booking = spp.id_booking
       WHERE fpp.uuid_cfdi LIKE TRIM(?)`,
      [uuid],
    );
  }

  /**
   * Trae el detalle completo (saldos incluidos) de una factura de proveedor por su uuid.
   * @param {string} uuid - uuid_factura, ya normalizado por el service
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findFacturaByUuid(uuid, conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT *
       FROM vw_saldos_facturas_proveedores
       WHERE uuid_factura = ?
       LIMIT 1`,
      [uuid],
    );
  }

  /**
   * Busca el registro de asignación factura↔solicitud en pagos_facturas_proveedores.
   * @param {string} idFactura
   * @param {number} idSolicitud
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findPagoByFacturaYSolicitud(idFactura, idSolicitud, conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT id, id_solicitud, id_factura, monto_facturado, monto_pago
       FROM pagos_facturas_proveedores
       WHERE id_factura = ? AND id_solicitud = ?
       LIMIT 1`,
      [idFactura, idSolicitud],
    );
  }

  /**
   * Elimina el registro de asignación factura↔solicitud.
   * @param {string} idFactura
   * @param {number} idSolicitud
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async deleteByFacturaYSolicitud(idFactura, idSolicitud, conn = null) {
    const run = getExecutor(conn);
    return run(
      `DELETE FROM pagos_facturas_proveedores WHERE id_factura = ? AND id_solicitud = ?`,
      [idFactura, idSolicitud],
    );
  }
}

module.exports = new PagoProveedoresFacturasRepository();
