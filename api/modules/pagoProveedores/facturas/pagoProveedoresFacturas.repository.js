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
      `SELECT sfp.monto_facturado, sfp.monto_propina, sfp.monto_impsan, sfp.monto_facturado_final,
              spp.monto_solicitado, fpp.uuid_cfdi AS uuid_factura,
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
       FROM facturas_pago_proveedor
       WHERE uuid_cfdi = ?
       LIMIT 1`,
      [uuid],
    );
  }

  /**
   * Busca una factura de proveedor por su PK.
   * @param {string} idFacturaProveedor
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findFacturaById(idFacturaProveedor, conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT id_factura_proveedor, propina
       FROM facturas_pago_proveedor
       WHERE id_factura_proveedor = ?
       LIMIT 1`,
      [idFacturaProveedor],
    );
  }

  /**
   * Actualiza dinámicamente los campos recibidos de una factura de proveedor.
   * Las keys de `campos` ya vienen validadas contra un whitelist en el service.
   * @param {string} idFacturaProveedor
   * @param {object} campos - mapa campo → valor a actualizar
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async updateFactura(idFacturaProveedor, campos, conn = null) {
    const run = getExecutor(conn);
    const setSql = Object.keys(campos)
      .map((campo) => `${campo} = ?`)
      .join(", ");
    return run(
      `UPDATE facturas_pago_proveedor SET ${setSql} WHERE id_factura_proveedor = ?`,
      [...Object.values(campos), idFacturaProveedor],
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

  /**
   * Actualiza dinámicamente los campos recibidos de la relación factura↔solicitud.
   * Las keys de `campos` ya vienen validadas contra un whitelist en el service.
   * @param {string} idFactura
   * @param {number} idSolicitud
   * @param {object} campos - mapa campo → valor a actualizar
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async updatePagoFactura(idFactura, idSolicitud, campos, conn = null) {
    const run = getExecutor(conn);
    const setSql = Object.keys(campos)
      .map((campo) => `${campo} = ?`)
      .join(", ");
    return run(
      `UPDATE pagos_facturas_proveedores SET ${setSql} WHERE id_factura = ? AND id_solicitud = ?`,
      [...Object.values(campos), idFactura, idSolicitud],
    );
  }

  /**
   * Busca y bloquea (FOR UPDATE) la relación factura↔solicitud para editarla dentro de una transacción.
   * @param {string} idFactura
   * @param {number} idSolicitud
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findPagoParaEdicion(idFactura, idSolicitud, conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT id, id_factura, id_solicitud, monto_facturado, monto_propina,
              monto_impsan, monto_facturado_final
       FROM pagos_facturas_proveedores
       WHERE id_factura = ? AND id_solicitud = ?
       LIMIT 1
       FOR UPDATE`,
      [idFactura, idSolicitud],
    );
  }

  /**
   * Busca y bloquea (FOR UPDATE) la factura con los totales necesarios para validar disponibilidad.
   * @param {string} idFacturaProveedor
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findFacturaParaEdicionPago(idFacturaProveedor, conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT id_factura_proveedor, total, propina, impsan, total_final, propina_aplicada
       FROM facturas_pago_proveedor
       WHERE id_factura_proveedor = ?
       LIMIT 1
       FOR UPDATE`,
      [idFacturaProveedor],
    );
  }

  /**
   * Suma monto_facturado / monto_impsan / monto_facturado_final de las demás
   * relaciones de la misma factura (excluye la relación id_factura+id_solicitud actual).
   * @param {string} idFactura
   * @param {number} idSolicitud
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async sumOtrasRelacionesPago(idFactura, idSolicitud, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT COALESCE(SUM(monto_facturado), 0) AS monto_facturado_otros,
              COALESCE(SUM(monto_impsan), 0) AS monto_impsan_otros,
              COALESCE(SUM(monto_facturado_final), 0) AS monto_facturado_final_otros
       FROM pagos_facturas_proveedores
       WHERE id_factura = ? AND id_solicitud <> ?
       FOR UPDATE`,
      [idFactura, idSolicitud],
    );
    return rows[0];
  }
}

module.exports = new PagoProveedoresFacturasRepository();
