const { CustomError } = require("../../../../middleware/errorHandler");
const repository = require("./pagoProveedoresFacturas.repository");

class PagoProveedoresFacturasService {
  /**
   * @param {string} uuidFactura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async buscarSolicitudesPorUuid(uuidFactura, conn = null) {
    const uuid = String(uuidFactura ?? "").trim();
    if (!uuid) {
      throw new CustomError("uuid_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const rows = await repository.findSolicitudesByUuidFactura(uuid, conn);
    if (!rows.length) {
      throw new CustomError(
        "No se encontraron solicitudes para ese uuid_factura",
        404,
        "SOLICITUD_NOT_FOUND",
      );
    }

    return rows;
  }

  /**
   * Trae el detalle completo (saldos incluidos) de una factura por su uuid.
   * @param {string} uuidFactura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async buscarFacturaPorUuid(uuidFactura, conn = null) {
    const uuid = String(uuidFactura ?? "").trim().toUpperCase();
    if (!uuid) {
      throw new CustomError("uuid_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const rows = await repository.findFacturaByUuid(uuid, conn);
    if (!rows.length) {
      throw new CustomError(
        "No se encontró ninguna factura con ese uuid",
        404,
        "FACTURA_NOT_FOUND",
      );
    }

    return rows[0];
  }

  /**
   * Elimina la asignación factura↔solicitud y devuelve el registro eliminado.
   * @param {string} idFactura
   * @param {number|string} idSolicitud
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async eliminarPagoFactura(idFactura, idSolicitud, conn = null) {
    const idFacturaStr = String(idFactura ?? "").trim();
    if (!idFacturaStr) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const idSolicitudNum = Number(idSolicitud);
    if (!Number.isInteger(idSolicitudNum) || idSolicitudNum <= 0) {
      throw new CustomError("id_solicitud debe ser un entero positivo", 400, "VALIDATION_ERROR");
    }

    const existente = await repository.findPagoByFacturaYSolicitud(idFacturaStr, idSolicitudNum, conn);
    if (!existente.length) {
      throw new CustomError(
        "No se encontró ningún registro con esa combinación de id_factura e id_solicitud",
        404,
        "PAGO_FACTURA_NOT_FOUND",
      );
    }

    await repository.deleteByFacturaYSolicitud(idFacturaStr, idSolicitudNum, conn);
    return existente[0];
  }
}

module.exports = new PagoProveedoresFacturasService();
