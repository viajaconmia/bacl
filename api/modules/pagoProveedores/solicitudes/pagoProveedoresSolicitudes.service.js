const { validateArrayIds } = require("../../../../v4/utils/validate");
const { CustomError } = require("../../../../middleware/errorHandler");
const reservasService = require("../reservas/pagoProveedoresReservas.service");
const cuentasService = require("../../proveedores/cuentas/proveedoresCuentas.service");
const dispersionService = require("./dispersion/pagoProveedoresDispersion.service");
const repository = require("./pagoProveedoresSolicitudes.repository");

// Campos editables vía PATCH /solicitudes. Agregar aquí para habilitar más.
const ALLOWED_FIELDS = new Set(["notas_internas"]);

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

  /**
   * Update genérico y acotado por ALLOWED_FIELDS. Por ahora solo permite
   * `notas_internas`; agregar más campos a ALLOWED_FIELDS para habilitarlos.
   *
   * `usuario_edit` siempre se sobreescribe con el usuario de la sesión (no es
   * controlable por el cliente) para dejar rastro de quién hizo el cambio,
   * igual que el `EditCampos` legacy de v1 para esta misma tabla.
   * @param {number} id_solicitud_proveedor
   * @param {Record<string, unknown>} fields
   * @param {{ id?: string } | null} [user] - req.session.user
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async editar(id_solicitud_proveedor, fields = {}, user = null, conn = null) {
    if (!id_solicitud_proveedor) {
      throw new CustomError(
        "id_solicitud_proveedor es requerido",
        400,
        "VALIDATION_ERROR",
      );
    }

    const keys = Object.keys(fields).filter((k) => fields[k] !== undefined);

    if (keys.length === 0) {
      throw new CustomError(
        "No se enviaron campos para actualizar",
        400,
        "VALIDATION_ERROR",
      );
    }

    const camposInvalidos = keys.filter((k) => !ALLOWED_FIELDS.has(k));
    if (camposInvalidos.length > 0) {
      throw new CustomError(
        `Campo(s) no permitido(s) para actualizar: ${camposInvalidos.join(", ")}`,
        400,
        "VALIDATION_ERROR",
        { permitido: Array.from(ALLOWED_FIELDS) },
      );
    }

    const fieldsToUpdate = Object.fromEntries(keys.map((k) => [k, fields[k]]));
    fieldsToUpdate.usuario_edit = user?.id ?? null;

    const affectedRows = await repository.updateFields(
      id_solicitud_proveedor,
      fieldsToUpdate,
      conn,
    );

    if (affectedRows === 0) {
      throw new CustomError(
        "No se encontró la solicitud",
        404,
        "SOLICITUD_NOT_FOUND",
      );
    }

    return { id_solicitud_proveedor, ...fieldsToUpdate };
  }
}

module.exports = new PagoProveedoresSolicitudesService();
