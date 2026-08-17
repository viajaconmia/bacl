const { CustomError } = require("../../../../middleware/errorHandler");
const repository = require("./pagoProveedoresReservas.repository");

// order_by cuya columna vive en una tabla de un include condicional —
// mapea al filtro que debe venir en true para que ese alias exista en la query.
const ORDER_BY_REQUIRES = {
  pago_created_at: "includePagos",
};

class PagoProveedoresReservasService {
  /**
   * Devuelve solicitudes de pago proveedor con reservas y (opcionalmente) facturas.
   * Acepta los mismos filtros que el repositorio: notas_internas, estado_solicitud,
   * estado_facturacion, estatus_pagos, comentarios_ops, comentarios_cxp, fecha_inicio_creacion,
   * fecha_fin_creacion, fecha_solicitud_inicio, fecha_solicitud_fin, forma_pago,
   * codigo_confirmacion, cliente, proveedor, tipo_negociacion, servicio,
   * checkin_inicio, checkin_fin, includeFacturas (boolean, default true), rfc, uuid,
   * includePagos (boolean, default false), con_dispersion (boolean, requiere includePagos=true),
   * order_by (allowlist de columnas, ver repository), order_dir ('asc'|'desc'), page, length.
   * @param {object} [filters={}]
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{ rows: object[], total: number|null, hasPagination: boolean }>}
   */
  async getAll(filters = {}, conn = null) {
    const page = filters.page !== undefined ? Number(filters.page) : undefined;
    const length =
      filters.length !== undefined ? Number(filters.length) : undefined;

    if (page !== undefined && (!Number.isFinite(page) || page < 1)) {
      throw new CustomError("page debe ser un número mayor a 0", 400, "VALIDATION_ERROR");
    }
    if (length !== undefined && (!Number.isFinite(length) || length < 1)) {
      throw new CustomError("length debe ser un número mayor a 0", 400, "VALIDATION_ERROR");
    }

    const requiredFlag = ORDER_BY_REQUIRES[filters.order_by];
    if (requiredFlag && !filters[requiredFlag]) {
      throw new CustomError(
        `order_by=${filters.order_by} requiere ${requiredFlag}=true`,
        400,
        "VALIDATION_ERROR",
      );
    }

    return repository.findAll(filters, conn);
  }
}

module.exports = new PagoProveedoresReservasService();
