const { getExecutor } = require("../../../config/db");

class CotizacionesIaRepository {
  /**
   * @param {object} cotizacion datos ya validados
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async insertCotizacion(cotizacion, conn = null) {
    const run = getExecutor(conn);
    return run(
      `INSERT INTO cotizaciones_ia (
        id_cotizacion,
        id_usuario,
        id_agente,
        solicitante_nombre,
        solicitante_correo,
        origen_entrada,
        resumen,
        notas,
        items,
        tipos,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nueva')`,
      [
        cotizacion.id_cotizacion,
        cotizacion.id_usuario,
        cotizacion.id_agente ?? null,
        cotizacion.solicitante_nombre ?? null,
        cotizacion.solicitante_correo ?? null,
        cotizacion.origen_entrada,
        cotizacion.resumen,
        cotizacion.notas ?? null,
        JSON.stringify(cotizacion.items),
        cotizacion.tipos,
      ],
    );
  }

  /**
   * Inserta el archivo y devuelve su id autoincremental (se usa para armar url_archivo).
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async insertArchivo(idCotizacion, archivo, conn = null) {
    const run = getExecutor(conn);
    const result = await run(
      `INSERT INTO cotizaciones_ia_archivos (
        id_cotizacion,
        nombre_archivo,
        tipo_mime,
        tamano_bytes,
        storage_path,
        url_archivo
      ) VALUES (?, ?, ?, ?, ?, '')`,
      [
        idCotizacion,
        archivo.nombre,
        archivo.mime,
        archivo.size,
        archivo.storage_path ?? null,
      ],
    );
    return result.insertId;
  }

  /** @param {import('mysql2/promise').PoolConnection} [conn] */
  async updateUrlArchivo(idArchivo, urlArchivo, conn = null) {
    const run = getExecutor(conn);
    return run(
      `UPDATE cotizaciones_ia_archivos SET url_archivo = ? WHERE id = ?`,
      [urlArchivo, idArchivo],
    );
  }

  /**
   * Listado con filtros opcionales y paginación opcional (page + length juntos).
   * @param {{ estado?: string, tipo?: string, q?: string, page?: number, length?: number }} filters
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async findAll(filters = {}, conn = null) {
    const run = getExecutor(conn);
    const where = [];
    const params = [];

    if (filters.estado) {
      where.push("c.estado = ?");
      params.push(filters.estado);
    }
    if (filters.tipo) {
      where.push("FIND_IN_SET(?, c.tipos) > 0");
      params.push(filters.tipo);
    }
    if (filters.q) {
      where.push(
        `(c.id_cotizacion LIKE CONCAT('%', ?, '%')
          OR c.solicitante_nombre LIKE CONCAT('%', ?, '%')
          OR c.solicitante_correo LIKE CONCAT('%', ?, '%')
          OR c.resumen LIKE CONCAT('%', ?, '%'))`,
      );
      params.push(filters.q, filters.q, filters.q, filters.q);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const hasPagination = Boolean(filters.page && filters.length);
    // page y length ya llegan como enteros positivos validados por el service.
    const limitSql = hasPagination
      ? `LIMIT ${Number(filters.length)} OFFSET ${
          (Number(filters.page) - 1) * Number(filters.length)
        }`
      : "";

    const [rows, countRows] = await Promise.all([
      run(
        `SELECT
          c.id_cotizacion,
          c.estado,
          c.solicitante_nombre,
          c.solicitante_correo,
          c.resumen,
          c.tipos,
          (SELECT COUNT(*) FROM cotizaciones_ia_archivos a
            WHERE a.id_cotizacion = c.id_cotizacion) AS total_archivos,
          c.created_at
        FROM cotizaciones_ia c
        ${whereSql}
        ORDER BY c.created_at DESC
        ${limitSql}`,
        params,
      ),
      hasPagination
        ? run(
            `SELECT COUNT(*) AS total FROM cotizaciones_ia c ${whereSql}`,
            params,
          )
        : Promise.resolve(null),
    ]);

    return {
      rows,
      total: countRows ? (countRows[0]?.total ?? 0) : null,
      hasPagination,
    };
  }

  /** @param {import('mysql2/promise').PoolConnection} [conn] */
  async findById(idCotizacion, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT * FROM cotizaciones_ia WHERE id_cotizacion = ? LIMIT 1`,
      [idCotizacion],
    );
    return rows[0] ?? null;
  }

  /** @param {import('mysql2/promise').PoolConnection} [conn] */
  async findArchivos(idCotizacion, conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT id, nombre_archivo, tipo_mime, tamano_bytes, url_archivo
       FROM cotizaciones_ia_archivos
       WHERE id_cotizacion = ?
       ORDER BY id ASC`,
      [idCotizacion],
    );
  }

  /** @param {import('mysql2/promise').PoolConnection} [conn] */
  async findArchivo(idCotizacion, idArchivo, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT id, nombre_archivo, tipo_mime, storage_path
       FROM cotizaciones_ia_archivos
       WHERE id_cotizacion = ? AND id = ?
       LIMIT 1`,
      [idCotizacion, idArchivo],
    );
    return rows[0] ?? null;
  }
}

module.exports = new CotizacionesIaRepository();
module.exports.CotizacionesIaRepository = CotizacionesIaRepository;
