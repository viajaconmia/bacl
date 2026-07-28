const { getExecutor } = require("../../../../config/db");

const BASE_SELECT = `
  SELECT
    pc.id,
    pc.id_proveedor,
    pc.cuenta,
    pc.banco,
    pc.titular,
    pc.alias,
    pc.tipo_cta,
    pc.cta,
    pc.email,
    pc.url_caratula,
    pc.comentarios,
    pc.active,
    pc.revision_pendiente,
    pc.fecha_revision,
    pc.revisado_por,
    pc.cantidad_cambios,
    pc.created_at,
    pc.created_by,
    pc.created_by_nombre,
    pc.ultimo_cambio_at,
    pc.updated_at
  FROM proveedores_cuentas pc
`;

class ProveedoresCuentasRepository {
  /**
   * @param {number|number[]} ids - Uno o varios id_proveedor
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findByProveedor(ids, conn = null) {
    const run = getExecutor(conn);
    const idList = Array.isArray(ids) ? ids : [ids];
    return run(`${BASE_SELECT} WHERE pc.id_proveedor IN (?) AND pc.active = 1`, [idList]);
  }

  /**
   * @param {number} id - id de la cuenta (proveedores_cuentas.id)
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object|null>}
   */
  async findById(id, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(`${BASE_SELECT} WHERE pc.id = ?`, [id]);
    return rows[0] ?? null;
  }
}

module.exports = new ProveedoresCuentasRepository();
