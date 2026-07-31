const { validateArrayIds } = require("../../../../../v4/utils/validate");
const repository = require("./pagoProveedoresDispersion.repository");

class PagoProveedoresDispersionService {
  /**
   * @param {number[]} ids - Array de id_solicitud_proveedor
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async getFacturas(ids, conn = null) {
    validateArrayIds(ids);
    return repository.findFacturasByIds(ids, conn);
  }
}

module.exports = new PagoProveedoresDispersionService();
