const { getExecutor } = require("../../../../config/db");
const SolicitudesQueryBuilder = require("./query/SolicitudesQueryBuilder");
const {
  BookingInclude,
  FacturasInclude,
  PagosInclude,
} = require("./query/includes");

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
   * Filtros de pagos (tabla `pp`, solo cuando includePagos = true):
   * @param {boolean} [filters.includePagos=false]    - Si true, agrega JOIN de pago_proveedores
   *   (codigo_dispersion, url_pdf, monto). Una solicitud puede tener varios registros de pago;
   *   igual que includeFacturas, cada uno repite la fila de la solicitud (indice_pago/total_pagos
   *   indican el grupo). Combinar includeFacturas + includePagos multiplica filas (producto
   *   cruzado factura × pago) — evitar activar ambos a la vez salvo que se necesite explícitamente.
   * @param {boolean} [filters.con_dispersion]        - Solo solicitudes con pago_proveedores.id_pago_dispersion
   *   NOT NULL. Requiere includePagos=true — si no viene ese flag, este filtro no tiene efecto
   *   (PagosInclude, donde vive la condición, no se instancia sin includePagos).
   *
   * Orden:
   * @param {'id_solicitud_proveedor'|'created_at'|'fecha_solicitud'|'monto_solicitado'|'saldo'|
   *   'estado_solicitud'|'check_in'|'check_out'|'total'|'costo_total'|'pago_created_at'} [filters.order_by] -
   *   Columna a ordenar (allowlist, ver ORDER_BY_MAP en SolicitudesQueryBuilder). Valor no
   *   reconocido u omitido → default spp.id_solicitud_proveedor DESC. 'pago_created_at' requiere
   *   includePagos=true (el service valida esto y tira 400 si no viene — ver ORDER_BY_REQUIRES).
   * @param {'asc'|'desc'} [filters.order_dir='desc'] - Dirección; cualquier valor que no sea 'asc' → DESC.
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

    if (filters.includePagos) {
      builder.use(new PagosInclude());
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
