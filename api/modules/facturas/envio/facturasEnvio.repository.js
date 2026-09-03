const { getExecutor } = require("../../../../config/db");

class FacturasEnvioRepository {
  /**
   * @param {{ id_factura: string, correo_destino: string, id_usuario: string }} data
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{ insertId: number }>}
   */
  async insert({ id_factura, correo_destino, id_usuario }, conn = null) {
    const run = getExecutor(conn);
    const result = await run(
      `INSERT INTO historial_envio_facturas (id_factura, correo_destino, id_usuario) VALUES (?, ?, ?)`,
      [id_factura, correo_destino, id_usuario],
    );
    return { insertId: result.insertId };
  }

  /**
   * @param {string} id_factura
   * @param {{ page?: number|string|null, length?: number|string|null }} pagination
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async findByFactura(id_factura, { page = null, length = null } = {}, conn = null) {
    const run = getExecutor(conn);

    const pageNum = Number(page);
    const lengthNum = Number(length);
    const hasPagination =
      Number.isFinite(pageNum) && Number.isFinite(lengthNum) && lengthNum > 0;
    const safePage = Math.max(1, Math.trunc(pageNum) || 1);
    const safeLength = Math.trunc(lengthNum) || 20;
    const offset = (safePage - 1) * safeLength;

    const [rows, countRows] = await Promise.all([
      run(
        `SELECT id_envio, id_factura, correo_destino, id_usuario, nombre_usuario, fecha_envio
         FROM historial_envio_facturas
         WHERE id_factura = ?
         ORDER BY fecha_envio DESC
         ${hasPagination ? `LIMIT ${safeLength} OFFSET ${offset}` : ""}`,
        [id_factura],
      ),
      hasPagination
        ? run(
            `SELECT COUNT(*) AS total FROM historial_envio_facturas WHERE id_factura = ?`,
            [id_factura],
          )
        : Promise.resolve(null),
    ]);

    return { rows, total: countRows ? (countRows[0]?.total ?? 0) : null, hasPagination };
  }
}

module.exports = new FacturasEnvioRepository();
