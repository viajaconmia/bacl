const { CustomError } = require("../../../../middleware/errorHandler");
const repository = require("./proveedoresCuentas.repository");

class ProveedoresCuentasService {
  /**
   * Cuentas activas de uno o varios proveedores.
   * @param {number|number[]} ids
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async getByProveedor(ids, conn = null) {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) throw new CustomError("Se requiere al menos un id_proveedor", 400, "VALIDATION_ERROR");
    return repository.findByProveedor(idList, conn);
  }

  /**
   * Cuentas por su propio id (proveedores_cuentas.id).
   * @param {number[]} ids
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async getByIds(ids, conn = null) {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return [];
    return repository.findByIds(idList, conn);
  }

  /**
   * Cuenta por id. Lanza 404 si no existe.
   * @param {number} id
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async getById(id, conn = null) {
    if (!id) throw new CustomError("id es requerido", 400, "VALIDATION_ERROR");
    const cuenta = await repository.findById(id, conn);
    if (!cuenta) throw new CustomError("Cuenta no encontrada", 404, "CUENTA_NOT_FOUND");
    return cuenta;
  }
}

module.exports = new ProveedoresCuentasService();
