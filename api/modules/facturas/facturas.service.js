const { CustomError } = require("../../../middleware/errorHandler");
const repository = require("./facturas.repository");

class FacturasService {
  /**
   * @param {string} id_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async getById(id_factura, conn = null) {
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const factura = await repository.findById(id_factura, conn);

    if (!factura) {
      throw new CustomError(
        `Factura ${id_factura} no encontrada`,
        404,
        "FACTURA_NOT_FOUND",
      );
    }

    return factura;
  }

  async getAll(filters = {}, conn = null) {
    return repository.findAll(filters, conn);
  }
}

module.exports = new FacturasService();
