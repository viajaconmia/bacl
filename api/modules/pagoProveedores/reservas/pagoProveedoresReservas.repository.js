const { getExecutor } = require("../../../../config/db");
const SolicitudesQueryBuilder = require("./query/SolicitudesQueryBuilder");
const { BookingInclude, FacturasInclude } = require("./query/includes");

class PagoProveedoresReservasRepository {
  /**
   * Filtra solicitudes de pago proveedor con sus reservas asociadas.
   *
   * Filtros de solicitud (tabla `spp`):
   * @param {object}  [filters={}]
   * @param {string}  [filters.notas_internas]       - LIKE en spp.notas_internas
   * @param {string}  [filters.estado_solicitud]      - Exacto en spp.estado_solicitud
   * @param {string}  [filters.estado_facturacion]    - Exacto en spp.estado_facturacion
   * @param {'pagado'|'enviado_a_pago'} [filters.estatus_pagos] - Exacto en spp.estatus_pagos
   * @param {string}  [filters.comentarios_ops]       - LIKE en spp.comentario_AP
   * @param {string}  [filters.comentarios_cxp]       - LIKE en spp.comentario_CXP
   * @param {string}  [filters.fecha_inicio_creacion] - DATE(spp.created_at) >=
   * @param {string}  [filters.fecha_fin_creacion]    - DATE(spp.created_at) <=
   * @param {string}  [filters.fecha_solicitud_inicio]- DATE(spp.fecha_solicitud) >=
   * @param {string}  [filters.fecha_solicitud_fin]   - DATE(spp.fecha_solicitud) <=
   * @param {'credit'|'contado'} [filters.forma_pago] - Filtra por forma de pago
   * @param {'spei'|'pago_tdc'|'pago_link'|'pagada'|'notificados'|'canceladas'|'ap_credito'|'pendiente_credito'|'todos'} [filters.bucket] - Grupo predefinido de estado; omitir o 'todos' = sin filtro
   *
   * Filtros de booking (tabla `vw`, siempre incluida):
   * @param {string}  [filters.codigo_confirmacion]   - LIKE en vw.codigo_confirmacion
   * @param {string}  [filters.cliente]               - LIKE en vw.nombre_agente
   * @param {string}  [filters.proveedor]             - LIKE en vw.proveedor
   * @param {string}  [filters.tipo_negociacion]      - LIKE en vw.negociacion_proveedor
   * @param {string}  [filters.servicio]              - Exacto en vw.type
   * @param {string}  [filters.checkin_inicio]        - DATE(vw.check_in) >=
   * @param {string}  [filters.checkin_fin]           - DATE(vw.check_in) <=
   *
   * Filtros de facturas (tabla `pfp`/`fpp`, solo cuando includeFacturas !== false):
   * @param {boolean} [filters.includeFacturas=true]  - Si false, omite JOINs de facturas
   * @param {string}  [filters.rfc]                   - LIKE en fpp.rfc_emisor (subquery)
   * @param {string}  [filters.uuid]                  - LIKE en fpp.uuid_cfdi (subquery)
   *
   * Paginación:
   * @param {number}  [filters.page]   - Página (1-based); omitir para sin paginación
   * @param {number}  [filters.length] - Registros por página
   *
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{ rows: object[], total: number|null, hasPagination: boolean }>}
   */
  async findAll(filters = {}, conn = null) {
    const run = getExecutor(conn);

    const builder = new SolicitudesQueryBuilder(filters).use(
      new BookingInclude(),
    );

    if (filters.includeFacturas) {
      builder.use(new FacturasInclude());
    }

    const { sql, params, countSql, countParams, hasPagination } = builder.build(
      {
        page: filters.page,
        length: filters.length,
      },
    );

    const [rows, countRows] = await Promise.all([
      run(sql, params),
      countSql ? run(countSql, countParams) : Promise.resolve(null),
    ]);

    return {
      rows,
      total: countRows ? (countRows[0]?.total ?? 0) : null,
      hasPagination,
    };
  }
}

module.exports = new PagoProveedoresReservasRepository();
