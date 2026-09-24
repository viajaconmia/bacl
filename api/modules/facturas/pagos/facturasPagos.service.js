const { CustomError } = require("../../../../middleware/errorHandler");
const repository = require("./facturasPagos.repository");

class FacturasPagosService {
  /**
   * @param {string} id_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async getPagosByFactura(id_factura, conn = null) {
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    return repository.findByFactura(id_factura, conn);
  }

  /**
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async getPrepagoFacturables(conn = null) {
    return repository.findPrepagoFacturables(conn);
  }

  /**
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async getBalancePagosFacturas(conn = null) {
    return repository.findBalancePagosFacturas(conn);
  }
}

module.exports = new FacturasPagosService();
