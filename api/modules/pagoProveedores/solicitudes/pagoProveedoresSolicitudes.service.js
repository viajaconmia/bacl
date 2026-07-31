const { validateArrayIds } = require("../../../../v4/utils/validate");
const { CustomError } = require("../../../../middleware/errorHandler");
const reservasService = require("../reservas/pagoProveedoresReservas.service");
const cuentasService = require("../../proveedores/cuentas/proveedoresCuentas.service");
const dispersionService = require("./dispersion/pagoProveedoresDispersion.service");
const repository = require("./pagoProveedoresSolicitudes.repository");

class PagoProveedoresSolicitudesService {
  /**
   * Devuelve las solicitudes indicadas, cada una con sus cuentas bancarias y facturas.
   * Las cuentas corresponden al intermediario si existe, o al proveedor directo.
   * @param {number[]} ids - Array de id_solicitud_proveedor
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async getDispersion(ids, conn = null) {
    validateArrayIds(ids);

    const { rows: solicitudes } = await reservasService.getAll({ ids }, conn);

    const proveedorIdsUnicos = [
      ...new Set(
        solicitudes
          .map((s) => s.id_intermediario ?? s.id_proveedor)
          .filter(Boolean),
      ),
    ];

    const [cuentas, facturas] = await Promise.all([
      proveedorIdsUnicos.length > 0
        ? cuentasService.getByProveedor(proveedorIdsUnicos, conn)
        : Promise.resolve([]),
      dispersionService.getFacturas(ids, conn),
    ]);

    const cuentasPorProveedor = cuentas.reduce((acc, c) => {
      if (!acc[c.id_proveedor]) acc[c.id_proveedor] = [];
      acc[c.id_proveedor].push(c);
      return acc;
    }, {});

    const facturasPorSolicitud = facturas.reduce((acc, f) => {
      if (!acc[f.id_solicitud]) acc[f.id_solicitud] = [];
      acc[f.id_solicitud].push(f);
      return acc;
    }, {});

    return solicitudes.map((s) => {
      const idProveedor = s.id_intermediario ?? s.id_proveedor;
      return {
        ...s,
        cuentas: cuentasPorProveedor[idProveedor] ?? [],
        facturas: facturasPorSolicitud[s.id_solicitud_proveedor] ?? [],
      };
    });
  }

  /**
   * Saldo de dispersión y estado actual de las solicitudes indicadas.
   * Lanza si alguna no existe.
   * @param {number[]} ids - Array de id_solicitud_proveedor
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<Map<number, { saldo_dispersion: number, estado_solicitud: string }>>}
   */
  async getSaldosDispersion(ids, conn = null) {
    validateArrayIds(ids);

    const rows = await repository.findSaldosDispersionByIds(ids, conn);
    const saldosMap = new Map(
      rows.map((r) => [
        Number(r.id_solicitud_proveedor),
        {
          saldo_dispersion: Number(r.saldo_dispersion ?? 0),
          estado_solicitud: String(r.estado_solicitud ?? "").trim(),
        },
      ]),
    );

    const faltantes = ids.filter((id) => !saldosMap.has(id));
    if (faltantes.length > 0) {
      throw new CustomError(
        "No se encontró saldo para una o más solicitudes en solicitudes_pago_proveedor",
        400,
        "SOLICITUDES_NOT_FOUND",
        { faltantes },
      );
    }

    return saldosMap;
  }

  /**
   * @param {number[]} ids - Array de id_solicitud_proveedor
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async marcarEnDispersion(ids, conn = null) {
    validateArrayIds(ids);
    return repository.updateEstado(ids, "DISPERSION", conn);
  }
}

module.exports = new PagoProveedoresSolicitudesService();
