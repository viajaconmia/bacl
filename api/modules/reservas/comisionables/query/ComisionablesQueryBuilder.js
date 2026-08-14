const { applyLike, applyExact } = require("./filters");

class ComisionablesQueryBuilder {
  // is_comisionable = 1 es fijo: este builder es solo para bookings comisionables.
  // comision_cobrada NO va fijo aquí — es filtro opcional (ver #applyBaseFilters).
  #conditions = ["vw.is_comisionable = 1"];
  #params = [];

  constructor(filters = {}) {
    this.#applyBaseFilters(filters);
  }

  #applyBaseFilters(f) {
    applyLike(this, "vw.proveedor", f.proveedor);
    applyExact(this, "vw.id_intermediario", f.id_intermediario);
    applyLike(this, "vw.comentarios_comisionables", f.comentarios_comisionables);
    applyExact(this, "vw.estado", f.estado);
    applyLike(this, "vw.codigo_confirmacion", f.codigo_confirmacion);

    // applyExact usa `if (value)`, que ignora 0 — comision_cobrada=0 es un
    // valor válido y distinto de "sin filtro", así que se valida aparte.
    if (
      f.comision_cobrada !== undefined &&
      f.comision_cobrada !== null &&
      f.comision_cobrada !== ""
    ) {
      this.addWhere("vw.comision_cobrada = ?", Number(f.comision_cobrada));
    }
  }

  addWhere(condition, ...params) {
    this.#conditions.push(condition);
    this.#params.push(...params);
    return this;
  }

  build({ page = null, length = null } = {}) {
    const pageNum = Number(page);
    const lengthNum = Number(length);
    const hasPagination =
      Number.isFinite(pageNum) && Number.isFinite(lengthNum) && lengthNum > 0;
    const safePage = Math.max(1, Math.trunc(pageNum) || 1);
    const safeLength = Math.trunc(lengthNum) || 20;
    const offset = (safePage - 1) * safeLength;

    const whereSql = `WHERE ${this.#conditions.join(" AND ")}`;
    const limitSql = hasPagination
      ? `LIMIT ${safeLength} OFFSET ${offset}`
      : "";

    const sql = `
      SELECT vw.*
      FROM vw_new_details_booking vw
      ${whereSql}
      ${limitSql}
    `.trim();

    const countSql = hasPagination
      ? `SELECT COUNT(*) AS total FROM vw_new_details_booking vw ${whereSql}`
      : null;

    return {
      sql,
      params: [...this.#params],
      countSql,
      countParams: hasPagination ? [...this.#params] : null,
      hasPagination,
    };
  }
}

module.exports = ComisionablesQueryBuilder;
