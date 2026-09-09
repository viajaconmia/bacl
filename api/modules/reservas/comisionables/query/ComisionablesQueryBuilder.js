const { applyLike, applyExact, applyDateRange } = require("./filters");

class ComisionablesQueryBuilder {
  #select;
  #joins;
  // is_comisionable = 1 es fijo: este builder es solo para bookings comisionables.
  // comision_cobrada NO va fijo aquí — es filtro opcional (ver #applyBaseFilters).
  #conditions = ["vw.is_comisionable = 1"];
  #groupByFields;
  #orderBy = "fpp.id_factura_proveedor DESC, vw.created_at DESC, vw.id_booking DESC";
  #params = [];

  constructor(filters = {}) {
    this.#select = [
      "vw.*",
      "fpp.id_factura_proveedor AS id_factura",
      "fpp.uuid_cfdi AS uuid_factura",
      "fpp.rfc_emisor AS rfc_factura",
      "fpp.subtotal AS subtotal_factura",
      "fpp.total AS total_factura",
      "pfp.monto_facturado_final AS asignado_a_factura",
      "pfp.monto_propina",
      "pfp.monto_impsan",
      "spp.id_solicitud_proveedor",
      "spp.estado_solicitud",
      "spp.estado_facturacion",
      `ROW_NUMBER() OVER (
        PARTITION BY vw.id_booking
        ORDER BY (pfp.id IS NULL) ASC, pfp.id ASC
      ) AS indice_factura`,
      `COUNT(pfp.id) OVER (
        PARTITION BY vw.id_booking
      ) AS total_facturas`,
    ];

    this.#joins = [
      "LEFT JOIN solicitudes_pago_proveedor spp ON spp.id_booking = vw.id_booking AND UPPER(TRIM(COALESCE(spp.estado_solicitud, ''))) <> 'CANCELADA'",
      "LEFT JOIN pagos_facturas_proveedores pfp ON pfp.id_solicitud = spp.id_solicitud_proveedor",
      "LEFT JOIN facturas_pago_proveedor fpp ON fpp.id_factura_proveedor = pfp.id_factura",
    ];

    this.#groupByFields = [
      "vw.id_booking",
      "spp.id_solicitud_proveedor",
      "pfp.id",
    ];

    this.#applyBaseFilters(filters);
  }

  #applyBaseFilters(f) {
    applyLike(this, "vw.proveedor", f.proveedor);
    applyExact(this, "vw.id_intermediario", f.id_intermediario);
    applyLike(this, "vw.comentarios_comisionables", f.comentarios_comisionables);
    applyExact(this, "vw.estado", f.estado);
    applyLike(this, "vw.codigo_confirmacion", f.codigo_confirmacion);
    applyDateRange(this, "vw.check_in", f.checkin_inicio, f.checkin_fin);
    applyDateRange(this, "vw.check_out", f.checkout_inicio, f.checkout_fin);
    applyLike(this, "fpp.uuid_cfdi", f.uuid_factura || f.uuid);
    applyLike(this, "fpp.rfc_emisor", f.rfc_factura || f.rfc);

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

  build({ page = null, length = null } = {}) {
    const pageNum = Number(page);
    const lengthNum = Number(length);
    const hasPagination =
      Number.isFinite(pageNum) && Number.isFinite(lengthNum) && lengthNum > 0;
    const safePage = Math.max(1, Math.trunc(pageNum) || 1);
    const safeLength = Math.trunc(lengthNum) || 20;
    const offset = (safePage - 1) * safeLength;

    const joinsSql = this.#joins.join("\n      ");
    const whereSql = `WHERE ${this.#conditions.join(" AND ")}`;
    const groupBySql = `GROUP BY ${this.#groupByFields.join(", ")}`;
    const limitSql = hasPagination
      ? `LIMIT ${safeLength} OFFSET ${offset}`
      : "";

    const sql = `
      SELECT
        ${this.#select.join(",\n        ")}
      FROM vw_new_details_booking vw
      ${joinsSql}
      ${whereSql}
      ${groupBySql}
      ORDER BY ${this.#orderBy}
      ${limitSql}
    `.trim();

    const countSql = hasPagination
      ? `SELECT COUNT(*) AS total FROM (
           SELECT vw.id_booking
           FROM vw_new_details_booking vw
           ${joinsSql}
           ${whereSql}
           ${groupBySql}
         ) AS sub`
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

