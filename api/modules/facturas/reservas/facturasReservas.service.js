const { CustomError } = require("../../../../middleware/errorHandler");
const repository = require("./facturasReservas.repository");
const {
  mapEstadoToClave,
  getEstadoClaveFromLocation,
  getCodigoConfirmacionBase,
  toYMD,
} = require("./estadosMexico.helper");

class FacturasReservasService {
  /**
   * @param {string} id_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async getReservasByFactura(id_factura, conn = null) {
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    return repository.findByFactura(id_factura, conn);
  }

  async getPendientes({ id_agente, page = null, length = null } = {}, conn = null) {
    if (!id_agente) {
      throw new CustomError("id_agente es requerido", 400, "VALIDATION_ERROR");
    }

    return repository.findPendientes({ id_agente, page, length }, conn);
  }

  /**
   * Reporte de facturas de un agente con el detalle de la(s) reserva(s) que cubre cada una.
   * @param {{ id_agente?: string, fecha_desde?: string, fecha_hasta?: string, page?: number, length?: number }} filters
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async getReporteAgente(
    { id_agente, fecha_desde, fecha_hasta, page = null, length = null } = {},
    conn = null,
  ) {
    const normalizeDate = (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s.length ? s : null;
    };

    const { rows, total, hasPagination } = await repository.findReporteAgente(
      {
        id_agente: id_agente ? String(id_agente).trim() : null,
        fecha_desde: normalizeDate(fecha_desde),
        fecha_hasta: normalizeDate(fecha_hasta),
        page,
        length,
      },
      conn,
    );

    const data = rows.map((row) => {
      const origen_estado = getEstadoClaveFromLocation(row.origen);
      const destino_estado = getEstadoClaveFromLocation(row.destino);

      const estado_reserva_original = mapEstadoToClave(row.estado_reserva);
      const estado_reserva =
        [origen_estado, destino_estado].filter(Boolean).join("-") ||
        estado_reserva_original;

      const { origen, destino, ...rest } = row;

      return {
        ...rest,
        chin: toYMD(row.chin),
        chout: toYMD(row.chout),
        codigo_confirmacion_base: getCodigoConfirmacionBase(row.codigo_confirmacion),
        origen_estado,
        destino_estado,
        estado_reserva,
      };
    });

    return { rows: data, total, hasPagination };
  }
}

module.exports = new FacturasReservasService();
