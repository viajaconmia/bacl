const { getExecutor } = require("../../../../config/db");

class PagoProveedoresReservasRepository {
  /**
   * @param {object} [filters={}]
   * @param {string}  [filters.notas_internas]
   * @param {string}  [filters.codigo_confirmacion]
   * @param {string}  [filters.fecha_inicio_creacion]    YYYY-MM-DD
   * @param {string}  [filters.fecha_fin_creacion]       YYYY-MM-DD
   * @param {string}  [filters.estado_solicitud]
   * @param {string}  [filters.estado_facturacion]
   * @param {string}  [filters.cliente]
   * @param {string}  [filters.proveedor]
   * @param {string}  [filters.forma_pago]               "credit" | "contado"
   * @param {string}  [filters.tipo_negociacion]
   * @param {string}  [filters.fecha_solicitud_inicio]   YYYY-MM-DD
   * @param {string}  [filters.fecha_solicitud_fin]      YYYY-MM-DD
   * @param {string}  [filters.comentarios_ops]
   * @param {string}  [filters.comentarios_cxp]
   * @param {string}  [filters.servicio]
   * @param {string}  [filters.rfc]
   * @param {string}  [filters.uuid]
   * @param {number}  [filters.page]
   * @param {number}  [filters.length]
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findAll(filters = {}, conn = null) {
    const run = getExecutor(conn);
    const conditions = ["vw.id_booking IS NOT NULL"];
    const params = [];

    if (filters.notas_internas) {
      conditions.push("spp.notas_internas LIKE ?");
      params.push(`%${filters.notas_internas}%`);
    }
    if (filters.codigo_confirmacion) {
      conditions.push("vw.codigo_confirmacion LIKE ?");
      params.push(`%${filters.codigo_confirmacion}%`);
    }
    if (filters.fecha_inicio_creacion) {
      conditions.push("DATE(spp.created_at) >= ?");
      params.push(filters.fecha_inicio_creacion);
    }
    if (filters.fecha_fin_creacion) {
      conditions.push("DATE(spp.created_at) <= ?");
      params.push(filters.fecha_fin_creacion);
    }
    if (filters.estado_solicitud) {
      conditions.push("spp.estado_solicitud = ?");
      params.push(filters.estado_solicitud);
    }
    if (filters.estado_facturacion) {
      conditions.push("spp.estado_facturacion = ?");
      params.push(filters.estado_facturacion);
    }
    if (filters.cliente) {
      conditions.push("vw.nombre_agente LIKE ?");
      params.push(`%${filters.cliente}%`);
    }
    if (filters.proveedor) {
      conditions.push("vw.proveedor LIKE ?");
      params.push(`%${filters.proveedor}%`);
    }
    if (filters.forma_pago) {
      if (filters.forma_pago === "credit") {
        conditions.push("spp.forma_pago_solicitada = 'credit'");
      } else if (filters.forma_pago === "contado") {
        conditions.push("spp.forma_pago_solicitada <> 'credit'");
      }
    }
    if (filters.tipo_negociacion) {
      conditions.push("vw.negociacion_proveedor LIKE ?");
      params.push(`%${filters.tipo_negociacion}%`);
    }
    if (filters.fecha_solicitud_inicio) {
      conditions.push("DATE(spp.fecha_solicitud) >= ?");
      params.push(filters.fecha_solicitud_inicio);
    }
    if (filters.fecha_solicitud_fin) {
      conditions.push("DATE(spp.fecha_solicitud) <= ?");
      params.push(filters.fecha_solicitud_fin);
    }
    if (filters.comentarios_ops) {
      conditions.push("spp.comentario_AP LIKE ?");
      params.push(`%${filters.comentarios_ops}%`);
    }
    if (filters.comentarios_cxp) {
      conditions.push("spp.comentario_CXP LIKE ?");
      params.push(`%${filters.comentarios_cxp}%`);
    }
    if (filters.servicio) {
      conditions.push("vw.type = ?");
      params.push(filters.servicio);
    }

    // RFC y UUID: buscan solicitudes que tengan ALGUNA factura con ese valor,
    // y luego traen TODAS las facturas de esas solicitudes.
    if (filters.rfc) {
      conditions.push(`
        spp.id_solicitud_proveedor IN (
          SELECT pfp2.id_solicitud
          FROM pagos_facturas_proveedores pfp2
          INNER JOIN facturas_pago_proveedor fpp2
            ON fpp2.id_factura_proveedor = pfp2.id_factura
          WHERE fpp2.rfc_emisor LIKE ?
        )
      `);
      params.push(`%${filters.rfc}%`);
    }
    if (filters.uuid) {
      conditions.push(`
        spp.id_solicitud_proveedor IN (
          SELECT pfp2.id_solicitud
          FROM pagos_facturas_proveedores pfp2
          INNER JOIN facturas_pago_proveedor fpp2
            ON fpp2.id_factura_proveedor = pfp2.id_factura
          WHERE fpp2.uuid_cfdi LIKE ?
        )
      `);
      params.push(`%${filters.uuid}%`);
    }

    const whereSql = `WHERE ${conditions.join(" AND ")}`;

    const pageNum = Number(filters.page);
    const lengthNum = Number(filters.length);
    const hasPagination =
      Number.isFinite(pageNum) &&
      Number.isFinite(lengthNum) &&
      lengthNum > 0;
    const safePage = Math.max(1, Math.trunc(pageNum) || 1);
    const safeLength = Math.trunc(lengthNum) || 20;
    const offset = (safePage - 1) * safeLength;
    const paginationSql = hasPagination
      ? `LIMIT ${safeLength} OFFSET ${offset}`
      : "";

    const fromSql = `
      FROM solicitudes_pago_proveedor spp
        LEFT JOIN vw_new_details_booking vw
          ON spp.id_booking = vw.id_booking
        LEFT JOIN pagos_facturas_proveedores pfp
          ON pfp.id_solicitud = spp.id_solicitud_proveedor
        LEFT JOIN facturas_pago_proveedor fpp
          ON fpp.id_factura_proveedor = pfp.id_factura
        LEFT JOIN proveedores inter
          ON inter.id = vw.id_intermediario
      ${whereSql}
      GROUP BY spp.id_solicitud_proveedor, pfp.id
      ORDER BY spp.id_solicitud_proveedor DESC`;

    const [rows, countRows] = await Promise.all([
      run(
        `SELECT
          vw.type,
          spp.id_solicitud_proveedor,
          spp.created_at,
          spp.monto_solicitado,
          spp.saldo,
          spp.saldo_dispersion,
          spp.fecha_solicitud,
          spp.estado_solicitud,
          spp.estado_facturacion,
          CASE
            WHEN spp.forma_pago_solicitada = 'credit' THEN 'credit'
            ELSE 'contado'
          END AS forma_pago,
          vw.nombre_agente          AS cliente,
          vw.codigo_confirmacion,
          vw.id_proveedor,
          vw.proveedor,
          vw.check_in,
          vw.check_out,
          GREATEST(DATEDIFF(vw.check_out, vw.check_in), 1) AS noches,
          vw.costo_total,
          ((vw.total - vw.costo_total) / vw.total) * 100   AS markup,
          vw.total,
          vw.negociacion_proveedor,
          inter.id                  AS id_intermediario,
          inter.proveedor           AS intermediario,
          inter.negociacion         AS negociacion_intermediario,
          spp.comentario_CXP,
          spp.comentario_AP,
          spp.comentario_ajuste,
          spp.notas_internas,
          fpp.rfc_emisor            AS rfc,
          fpp.uuid_cfdi             AS uuid,
          pfp.monto_facturado       AS asignado_a_factura
        ${fromSql}
        ${paginationSql}`,
        params,
      ),
      hasPagination
        ? run(`SELECT COUNT(*) AS total FROM (SELECT spp.id_solicitud_proveedor ${fromSql}) AS sub`, params)
        : Promise.resolve(null),
    ]);

    return { rows, total: countRows ? (countRows[0]?.total ?? 0) : null, hasPagination };
  }
}

module.exports = new PagoProveedoresReservasRepository();
