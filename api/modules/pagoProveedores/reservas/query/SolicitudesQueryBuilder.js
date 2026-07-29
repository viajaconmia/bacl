const { applyLike, applyExact, applyDateRange, applyBucket } = require("./filters");
const { sqlIn } = require("../../../../../v4/utils/sql");

class SolicitudesQueryBuilder {
  #select;
  #joins = [];
  #conditions = ["vw.id_booking IS NOT NULL"];
  #groupByFields;
  #orderBy = "spp.id_solicitud_proveedor DESC";
  #params = [];

  constructor(filters = {}) {
    this._filters = filters;

    this.#select = [
      "spp.id_solicitud_proveedor",
      "spp.created_at",
      "spp.monto_solicitado",
      "spp.saldo",
      "spp.saldo_dispersion",
      "spp.fecha_solicitud",
      "spp.estado_solicitud",
      "spp.estado_facturacion",
      `CASE WHEN spp.forma_pago_solicitada = 'credit' THEN 'credit' ELSE 'contado' END AS forma_pago`,
      "spp.comentario_CXP",
      "spp.comentario_AP",
      "spp.comentario_ajuste",
      "spp.notas_internas",
    ];

    this.#groupByFields = ["spp.id_solicitud_proveedor"];

    this.#applyBaseFilters(filters);
  }

  #applyBaseFilters(f) {
    if (Array.isArray(f.ids) && f.ids.length > 0) {
      const { placeholders, params } = sqlIn(f.ids);
      this.addWhere(`spp.id_solicitud_proveedor IN (${placeholders})`, ...params);
    }

    applyLike(this, "spp.notas_internas",     f.notas_internas);
    applyExact(this, "spp.estado_solicitud",   f.estado_solicitud);
    applyExact(this, "spp.estado_facturacion", f.estado_facturacion);
    applyLike(this, "spp.comentario_AP",       f.comentarios_ops);
    applyLike(this, "spp.comentario_CXP",      f.comentarios_cxp);
    applyDateRange(this, "spp.created_at",     f.fecha_inicio_creacion, f.fecha_fin_creacion);
    applyDateRange(this, "spp.fecha_solicitud", f.fecha_solicitud_inicio, f.fecha_solicitud_fin);

    if (f.forma_pago === "credit")   this.addWhere("spp.forma_pago_solicitada = 'credit'");
    else if (f.forma_pago === "contado") this.addWhere("spp.forma_pago_solicitada <> 'credit'");

    applyBucket(this, f.bucket);
  }

  addSelect(...fields) {
    this.#select.push(...fields);
    return this;
  }

  addJoin(sql) {
    this.#joins.push(sql);
    return this;
  }

  addWhere(condition, ...params) {
    this.#conditions.push(condition);
    this.#params.push(...params);
    return this;
  }

  addGroupBy(...fields) {
    this.#groupByFields.push(...fields);
    return this;
  }

  use(include) {
    include.apply(this, this._filters);
    return this;
  }

  build({ page = null, length = null } = {}) {
    const pageNum   = Number(page);
    const lengthNum = Number(length);
    const hasPagination =
      Number.isFinite(pageNum) && Number.isFinite(lengthNum) && lengthNum > 0;
    const safePage   = Math.max(1, Math.trunc(pageNum) || 1);
    const safeLength = Math.trunc(lengthNum) || 20;
    const offset     = (safePage - 1) * safeLength;

    const joinsSql   = this.#joins.join("\n      ");
    const whereSql   = `WHERE ${this.#conditions.join(" AND ")}`;
    const groupBySql = `GROUP BY ${this.#groupByFields.join(", ")}`;
    const limitSql   = hasPagination ? `LIMIT ${safeLength} OFFSET ${offset}` : "";

    const sql = `
      SELECT
        ${this.#select.join(",\n        ")}
      FROM solicitudes_pago_proveedor spp
      ${joinsSql}
      ${whereSql}
      ${groupBySql}
      ORDER BY ${this.#orderBy}
      ${limitSql}
    `.trim();

    const countSql = hasPagination
      ? `SELECT COUNT(*) AS total FROM (
           SELECT spp.id_solicitud_proveedor
           FROM solicitudes_pago_proveedor spp
           ${joinsSql}
           ${whereSql}
           ${groupBySql}
         ) AS sub`
      : null;

    return {
      sql,
      params:      [...this.#params],
      countSql,
      countParams: hasPagination ? [...this.#params] : null,
      hasPagination,
    };
  }
}

module.exports = SolicitudesQueryBuilder;
