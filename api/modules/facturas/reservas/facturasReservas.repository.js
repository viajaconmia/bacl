const { getExecutor } = require("../../../../config/db");

class FacturasReservasRepository {
  /**
   * @param {string} id_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findByFactura(id_factura, conn = null) {
    const run = getExecutor(conn);
    return run(
      `
      SELECT
        SUM(fi.monto)          AS monto_asignado,
        fi.id_relacion,
        vw.id_booking,
        vw.id_agente,
        vw.nombre_agente,
        vw.id_confirmacion     AS codigo_confirmacion,
        vw.proveedor,
        vw.total,
        vw.nombre_viajero
      FROM items_facturas fi
        LEFT JOIN vw_details_booking vw ON vw.id_relacion = fi.id_relacion
      WHERE fi.id_factura = ?
      GROUP BY fi.id_relacion
      `,
      [id_factura],
    );
  }

  async findPendientes({ id_agente, page = null, length = null }, conn = null) {
    const run = getExecutor(conn);

    const pageNum = Number(page);
    const lengthNum = Number(length);
    const hasPagination =
      Number.isFinite(pageNum) && Number.isFinite(lengthNum) && lengthNum > 0;
    const safePage = Math.max(1, Math.trunc(pageNum) || 1);
    const safeLength = Math.trunc(lengthNum) || 20;
    const offset = (safePage - 1) * safeLength;

    const baseSql = `
      FROM vw_details_booking vw
        LEFT JOIN items_facturas fi ON fi.id_relacion = vw.id_relacion
      WHERE vw.id_agente = ? AND vw.estado <> "Cancelada"
      GROUP BY vw.id_relacion
      HAVING (vw.total - COALESCE(SUM(fi.monto), 0)) > 0`;

    const [rows, countRows] = await Promise.all([
      run(
        `SELECT
          vw.id_relacion,
          vw.id_confirmacion AS codigo_confirmacion,
          vw.proveedor,
          vw.type,
          vw.nombre_agente,
          vw.metodo_pago,
          vw.total,
          vw.check_in,
          vw.check_out,
          vw.created_at,
          COALESCE(SUM(fi.monto), 0) AS total_facturado,
          (vw.total - COALESCE(SUM(fi.monto), 0)) AS pendiente_facturar
        ${baseSql}
        ${hasPagination ? `LIMIT ${safeLength} OFFSET ${offset}` : ""}`,
        [id_agente],
      ),
      hasPagination
        ? run(`SELECT COUNT(*) AS total FROM (SELECT vw.id_relacion ${baseSql}) AS sub`, [id_agente])
        : Promise.resolve(null),
    ]);

    return { rows, total: countRows ? (countRows[0]?.total ?? 0) : null, hasPagination };
  }

  /**
   * @param {{ id_agente?: string|null, fecha_desde?: string|null, fecha_hasta?: string|null, page?: number|null, length?: number|null }} filters
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async findReporteAgente(
    { id_agente = null, fecha_desde = null, fecha_hasta = null, page = null, length = null } = {},
    conn = null,
  ) {
    const run = getExecutor(conn);

    const pageNum = Number(page);
    const lengthNum = Number(length);
    const hasPagination =
      Number.isFinite(pageNum) && Number.isFinite(lengthNum) && lengthNum > 0;
    const safePage = Math.max(1, Math.trunc(pageNum) || 1);
    const safeLength = Math.trunc(lengthNum) || 20;
    const offset = (safePage - 1) * safeLength;

    const conditions = [];
    const params = [];

    if (id_agente) {
      conditions.push("f.id_agente = ?");
      params.push(id_agente);
    }
    if (fecha_desde) {
      conditions.push("DATE(f.fecha_emision) >= ?");
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      conditions.push("DATE(f.fecha_emision) <= ?");
      params.push(fecha_hasta);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const baseSql = `
      FROM facturas f
      INNER JOIN (
        SELECT id_factura, id_relacion, SUM(COALESCE(monto, 0)) AS monto_total_estancia
        FROM items_facturas
        GROUP BY id_factura, id_relacion
      ) ri ON ri.id_factura = f.id_factura
      LEFT JOIN vw_new_details_booking vw ON vw.id_relacion = ri.id_relacion
      LEFT JOIN viajeros v ON v.id_viajero = vw.id_viajero
      LEFT JOIN proveedores p ON p.id = vw.id_proveedor
      LEFT JOIN bookings b ON b.id_booking = vw.id_booking
      ${whereSql}`;

    const [rows, countRows] = await Promise.all([
      run(
        `SELECT
          vw.codigo_confirmacion,
          f.uuid_factura,
          f.folio,
          f.id_factura,
          DATE(f.fecha_emision) AS fecha_emision,
          ri.id_relacion,
          vw.id_booking,
          vw.nombre_agente AS agente,
          vw.nombre_viajero AS viajero,
          v.numero_empleado,
          vw.proveedor AS host,
          vw.tipo_cuarto_vuelo AS tipo_habitacion,
          vw.check_in AS chin,
          vw.check_out AS chout,
          vw.type AS servicio,
          CASE
            WHEN vw.check_in IS NULL OR vw.check_out IS NULL THEN 1
            WHEN DATEDIFF(vw.check_out, vw.check_in) <= 0 THEN 1
            ELSE DATEDIFF(vw.check_out, vw.check_in)
          END AS noches,
          CASE
            WHEN vw.check_in IS NULL OR vw.check_out IS NULL THEN ROUND(ri.monto_total_estancia, 2)
            WHEN DATEDIFF(vw.check_out, vw.check_in) <= 0 THEN ROUND(ri.monto_total_estancia, 2)
            ELSE ROUND(ri.monto_total_estancia / DATEDIFF(vw.check_out, vw.check_in), 2)
          END AS tarifa_por_noche,
          ri.monto_total_estancia AS monto_total_por_estancia,
          p.estado AS estado_reserva,
          vw.origen AS origen,
          vw.destino AS destino,
          b.subtotal AS booking_subtotal,
          b.impuestos AS booking_iva,
          b.total AS booking_total,
          b.ticket_zoho,
          b.portal,
          b.orden_compra,
          b.cliente_solicitante_reserva
        ${baseSql}
        ORDER BY f.fecha_emision DESC, f.id_factura, vw.id_booking
        ${hasPagination ? `LIMIT ${safeLength} OFFSET ${offset}` : ""}`,
        params,
      ),
      hasPagination
        ? run(`SELECT COUNT(*) AS total ${baseSql}`, params)
        : Promise.resolve(null),
    ]);

    return { rows, total: countRows ? (countRows[0]?.total ?? 0) : null, hasPagination };
  }
}

module.exports = new FacturasReservasRepository();
