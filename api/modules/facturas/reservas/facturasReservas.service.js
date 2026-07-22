const { CustomError } = require("../../../../middleware/errorHandler");
const repository = require("./facturasReservas.repository");

class FacturasReservasService {
  /**
   * @param {string} id_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async getReservasByFactura(id_factura, conn = null) {
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    return repository.findByFactura(id_factura, conn);
  }

  async getPendientes(id_agente, conn = null) {
    if (!id_agente) {
      throw new CustomError("id_agente es requerido", 400, "VALIDATION_ERROR");
    }

    return repository.findPendientes(id_agente, conn);
  }
}

module.exports = new FacturasReservasService();
