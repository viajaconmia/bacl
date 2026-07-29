const { getExecutor } = require("../../../config/db");
const { sqlIn } = require("../../../v4/utils/sql");

/**
 * Referencia — estructura de dispersion_pagos_proveedor:
 *
 * CREATE TABLE `dispersion_pagos_proveedor` (
 *   `id_dispersion_pagos_proveedor` int unsigned NOT NULL AUTO_INCREMENT,
 *   `id_solicitud_proveedor` int unsigned NOT NULL,
 *   `monto_solicitado` decimal(12,2) DEFAULT NULL,
 *   `saldo` decimal(12,2) DEFAULT NULL,
 *   `monto_pagado` decimal(12,2) DEFAULT NULL,
 *   `codigo_dispersion` varchar(45) DEFAULT NULL,
 *   `fecha_pago` date DEFAULT NULL,
 *   `fecha_update` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *   `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   `url_comprobante` text,
 *   `id_proveedor_cuenta` varchar(45) DEFAULT NULL,
 *   PRIMARY KEY (`id_dispersion_pagos_proveedor`),
 *   KEY `id_solicitud_proveedor` (`id_solicitud_proveedor`),
 *   CONSTRAINT `dispersion_pagos_proveedor_ibfk_1` FOREIGN KEY (`id_solicitud_proveedor`)
 *     REFERENCES `solicitudes_pago_proveedor` (`id_solicitud_proveedor`)
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
 */
class DispersionRepository {
  /**
   * @param {string} codigo - codigo_dispersion a verificar
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<boolean>}
   */
  async existsByCodigo(codigo, conn = null) {
    const run = getExecutor(conn);
    const rows = await run(
      `SELECT 1 FROM dispersion_pagos_proveedor WHERE codigo_dispersion = ? LIMIT 1`,
      [codigo],
    );
    return rows.length > 0;
  }

  /**
   * @param {Array<[number, number, number, number, string, string|null, number]>} rows
   *   [id_solicitud_proveedor, monto_solicitado, saldo, monto_pagado, codigo_dispersion, fecha_pago, id_proveedor_cuenta]
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{ insertId: number, affectedRows: number }>}
   */
  async insertDispersiones(rows, conn = null) {
    const run = getExecutor(conn);
    const placeholders = rows.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");

    const result = await run(
      `INSERT INTO dispersion_pagos_proveedor (
        id_solicitud_proveedor,
        monto_solicitado,
        saldo,
        monto_pagado,
        codigo_dispersion,
        fecha_pago,
        id_proveedor_cuenta
      ) VALUES ${placeholders}`,
      rows.flat(),
    );

    return { insertId: result.insertId, affectedRows: result.affectedRows };
  }

  /**
   * Filtra filas de dispersion_pagos_proveedor.
   * @param {object}   [filters={}]
   * @param {string}   [filters.codigo_dispersion]     - LIKE en codigo_dispersion
   * @param {string}   [filters.fecha_pago_inicio]     - fecha_pago >=
   * @param {string}   [filters.fecha_pago_fin]        - fecha_pago <=
   * @param {string}   [filters.id_proveedor_cuenta]   - Exacto en id_proveedor_cuenta
   * @param {boolean}  [filters.saldo_cero]            - true → saldo = 0 (ya pagada), false → saldo <> 0 (pendiente)
   * @param {number[]} [filters.ids]                   - IN sobre id_solicitud_proveedor
   * @param {number}   [filters.page]
   * @param {number}   [filters.length]
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{ rows: object[], total: number|null, hasPagination: boolean }>}
   */
  async findAll(filters = {}, conn = null) {
    const run = getExecutor(conn);

    const conditions = [];
    const params = [];

    if (filters.codigo_dispersion) {
      conditions.push("codigo_dispersion LIKE ?");
      params.push(`%${filters.codigo_dispersion}%`);
    }
    if (filters.fecha_pago_inicio) {
      conditions.push("fecha_pago >= ?");
      params.push(filters.fecha_pago_inicio);
    }
    if (filters.fecha_pago_fin) {
      conditions.push("fecha_pago <= ?");
      params.push(filters.fecha_pago_fin);
    }
    if (filters.id_proveedor_cuenta) {
      conditions.push("id_proveedor_cuenta = ?");
      params.push(filters.id_proveedor_cuenta);
    }
    if (filters.saldo_cero !== undefined) {
      const saldoCero =
        filters.saldo_cero === true || filters.saldo_cero === "true";
      conditions.push("saldo > 0");
    }
    if (Array.isArray(filters.ids) && filters.ids.length > 0) {
      const { placeholders, params: idsParams } = sqlIn(filters.ids);
      conditions.push(`id_solicitud_proveedor IN (${placeholders})`);
      params.push(...idsParams);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const page = filters.page !== undefined ? Number(filters.page) : undefined;
    const length =
      filters.length !== undefined ? Number(filters.length) : undefined;
    const hasPagination =
      Number.isFinite(page) && Number.isFinite(length) && length > 0;
    const safeLength = Math.trunc(length) || 20;
    const offset = hasPagination
      ? (Math.max(1, Math.trunc(page) || 1) - 1) * safeLength
      : 0;
    const limitSql = hasPagination
      ? `LIMIT ${safeLength} OFFSET ${offset}`
      : "";

    const [rows, countRows] = await Promise.all([
      run(
        `SELECT * FROM dispersion_pagos_proveedor ${whereSql} ORDER BY id_dispersion_pagos_proveedor DESC ${limitSql}`,
        params,
      ),
      hasPagination
        ? run(
            `SELECT COUNT(*) AS total FROM dispersion_pagos_proveedor ${whereSql}`,
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

  /**
   * @param {number[]} ids - id_dispersion_pagos_proveedor (PK propio de la tabla)
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findByIds(ids, conn = null) {
    const run = getExecutor(conn);
    const { placeholders, params } = sqlIn(ids);
    return run(
      `SELECT * FROM dispersion_pagos_proveedor WHERE id_dispersion_pagos_proveedor IN (${placeholders})`,
      params,
    );
  }
}

module.exports = new DispersionRepository();
