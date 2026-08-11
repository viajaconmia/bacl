const { CustomError } = require("../../../../middleware/errorHandler");
const repository = require("./pagoProveedoresFacturas.repository");

const CAMPOS_EDITABLES = {
  propina: (valor) => {
    const num = Number(valor);
    if (!Number.isFinite(num) || num < 0) {
      throw new CustomError("propina debe ser un número mayor o igual a 0", 400, "VALIDATION_ERROR");
    }
    return num;
  },
  impsan: (valor) => {
    const num = Number(valor);
    if (!Number.isFinite(num) || num < 0) {
      throw new CustomError("impsan debe ser un número mayor o igual a 0", 400, "VALIDATION_ERROR");
    }
    return num;
  },
};

class PagoProveedoresFacturasService {
  /**
   * @param {string} uuidFactura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async buscarSolicitudesPorUuid(uuidFactura, conn = null) {
    const uuid = String(uuidFactura ?? "").trim();
    if (!uuid) {
      throw new CustomError("uuid_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const rows = await repository.findSolicitudesByUuidFactura(uuid, conn);
    if (!rows.length) {
      throw new CustomError(
        "No se encontraron solicitudes para ese uuid_factura",
        404,
        "SOLICITUD_NOT_FOUND",
      );
    }

    return rows;
  }

  /**
   * Trae el detalle completo (saldos incluidos) de una factura por su uuid.
   * @param {string} uuidFactura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async buscarFacturaPorUuid(uuidFactura, conn = null) {
    const uuid = String(uuidFactura ?? "").trim().toUpperCase();
    if (!uuid) {
      throw new CustomError("uuid_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const rows = await repository.findFacturaByUuid(uuid, conn);
    if (!rows.length) {
      throw new CustomError(
        "No se encontró ninguna factura con ese uuid",
        404,
        "FACTURA_NOT_FOUND",
      );
    }

    return rows[0];
  }

  /**
   * Edita los campos editables de una factura de proveedor (update dinámico:
   * solo actualiza los campos presentes en `cambios`).
   * @param {string} idFacturaProveedor
   * @param {{ propina?: number|string, impsan?: number|string }} cambios
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async editarFactura(idFacturaProveedor, cambios = {}, conn = null) {
    const idFacturaStr = String(idFacturaProveedor ?? "").trim();
    if (!idFacturaStr) {
      throw new CustomError("id_factura_proveedor es requerido", 400, "VALIDATION_ERROR");
    }

    const campos = {};
    for (const [campo, validar] of Object.entries(CAMPOS_EDITABLES)) {
      if (cambios[campo] !== undefined) {
        campos[campo] = validar(cambios[campo]);
      }
    }

    if (!Object.keys(campos).length) {
      throw new CustomError("Debes enviar al menos un campo para actualizar", 400, "VALIDATION_ERROR");
    }

    const existente = await repository.findFacturaById(idFacturaStr, conn);
    if (!existente.length) {
      throw new CustomError(
        "No se encontró ninguna factura con ese id_factura_proveedor",
        404,
        "FACTURA_NOT_FOUND",
      );
    }

    await repository.updateFactura(idFacturaStr, campos, conn);
    return { id_factura_proveedor: idFacturaStr, ...campos };
  }

  /**
   * Elimina la asignación factura↔solicitud y devuelve el registro eliminado.
   * @param {string} idFactura
   * @param {number|string} idSolicitud
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async eliminarPagoFactura(idFactura, idSolicitud, conn = null) {
    const idFacturaStr = String(idFactura ?? "").trim();
    if (!idFacturaStr) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const idSolicitudNum = Number(idSolicitud);
    if (!Number.isInteger(idSolicitudNum) || idSolicitudNum <= 0) {
      throw new CustomError("id_solicitud debe ser un entero positivo", 400, "VALIDATION_ERROR");
    }

    const existente = await repository.findPagoByFacturaYSolicitud(idFacturaStr, idSolicitudNum, conn);
    if (!existente.length) {
      throw new CustomError(
        "No se encontró ningún registro con esa combinación de id_factura e id_solicitud",
        404,
        "PAGO_FACTURA_NOT_FOUND",
      );
    }

    await repository.deleteByFacturaYSolicitud(idFacturaStr, idSolicitudNum, conn);
    return existente[0];
  }

  /**
   * Edita la relación factura↔solicitud (update dinámico: solo escribe los campos
   * presentes en `cambios`), validando que ninguno de los montos deje sobre-asignada
   * la factura (propina, impsan, monto base del CFDI y el total final).
   * @param {string} idFactura
   * @param {number|string} idSolicitud
   * @param {{ monto_facturado?: number|string, monto_propina?: number|string, monto_impsan?: number|string }} cambios
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async editarPagoFactura(idFactura, idSolicitud, cambios = {}, conn = null) {
    const idFacturaStr = String(idFactura ?? "").trim();
    if (!idFacturaStr) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const idSolicitudNum = Number(idSolicitud);
    if (!Number.isInteger(idSolicitudNum) || idSolicitudNum <= 0) {
      throw new CustomError("id_solicitud debe ser un entero positivo", 400, "VALIDATION_ERROR");
    }

    const camposEnviados = ["monto_facturado", "monto_propina", "monto_impsan"].filter(
      (campo) => cambios[campo] !== undefined,
    );
    if (!camposEnviados.length) {
      throw new CustomError("Debes enviar al menos un campo para actualizar", 400, "VALIDATION_ERROR");
    }

    const relaciones = await repository.findPagoParaEdicion(idFacturaStr, idSolicitudNum, conn);
    if (!relaciones.length) {
      throw new CustomError(
        "No se encontró ningún registro con esa combinación de id_factura e id_solicitud",
        404,
        "PAGO_FACTURA_NOT_FOUND",
      );
    }
    const relacionActual = relaciones[0];

    const facturas = await repository.findFacturaParaEdicionPago(idFacturaStr, conn);
    if (!facturas.length) {
      throw new CustomError(
        "No se encontró ninguna factura con ese id_factura_proveedor",
        404,
        "FACTURA_NOT_FOUND",
      );
    }
    const factura = facturas[0];

    const nuevoMontoFacturado =
      cambios.monto_facturado !== undefined
        ? Number(cambios.monto_facturado)
        : Number(relacionActual.monto_facturado ?? 0);
    const nuevoMontoPropina =
      cambios.monto_propina !== undefined
        ? Number(cambios.monto_propina)
        : Number(relacionActual.monto_propina ?? 0);
    const nuevoMontoImpsan =
      cambios.monto_impsan !== undefined
        ? Number(cambios.monto_impsan)
        : Number(relacionActual.monto_impsan ?? 0);

    if (!Number.isFinite(nuevoMontoFacturado) || nuevoMontoFacturado < 0) {
      throw new CustomError(
        "monto_facturado debe ser un número mayor o igual a 0",
        400,
        "MONTO_FACTURADO_NEGATIVO",
      );
    }
    if (!Number.isFinite(nuevoMontoPropina) || nuevoMontoPropina < 0) {
      throw new CustomError("monto_propina debe ser un número mayor o igual a 0", 400, "MONTO_PROPINA_NEGATIVO");
    }
    if (!Number.isFinite(nuevoMontoImpsan) || nuevoMontoImpsan < 0) {
      throw new CustomError("monto_impsan debe ser un número mayor o igual a 0", 400, "MONTO_IMPSAN_NEGATIVO");
    }

    const propinaDisponible =
      Number(factura.propina ?? 0) - Number(factura.propina_aplicada ?? 0) + Number(relacionActual.monto_propina ?? 0);
    if (nuevoMontoPropina > propinaDisponible) {
      throw new CustomError(
        `monto_propina (${nuevoMontoPropina}) excede la propina disponible de la factura (${propinaDisponible})`,
        400,
        "PROPINA_EXCEDE_DISPONIBLE",
      );
    }

    const otras = await repository.sumOtrasRelacionesPago(idFacturaStr, idSolicitudNum, conn);

    const impsanDisponible = Number(factura.impsan ?? 0) - Number(otras.monto_impsan_otros ?? 0);
    if (nuevoMontoImpsan > impsanDisponible) {
      throw new CustomError(
        `monto_impsan (${nuevoMontoImpsan}) excede el impsan disponible de la factura (${impsanDisponible})`,
        400,
        "IMPSAN_EXCEDE_DISPONIBLE",
      );
    }

    const montoBaseDisponible = Number(factura.total ?? 0) - Number(otras.monto_facturado_otros ?? 0);
    if (nuevoMontoFacturado > montoBaseDisponible) {
      throw new CustomError(
        `monto_facturado (${nuevoMontoFacturado}) excede el monto base disponible de la factura (${montoBaseDisponible})`,
        400,
        "MONTO_BASE_EXCEDE_DISPONIBLE",
      );
    }

    const nuevoMontoFacturadoFinal = nuevoMontoFacturado + nuevoMontoPropina + nuevoMontoImpsan;
    const nuevoTotalAsignado = Number(otras.monto_facturado_final_otros ?? 0) + nuevoMontoFacturadoFinal;
    if (nuevoTotalAsignado > Number(factura.total_final ?? 0)) {
      throw new CustomError(
        `El total asignado (${nuevoTotalAsignado}) excede el total final de la factura (${factura.total_final})`,
        400,
        "TOTAL_FINAL_EXCEDE_FACTURA",
      );
    }

    const campos = {};
    if (cambios.monto_facturado !== undefined) campos.monto_facturado = nuevoMontoFacturado;
    if (cambios.monto_propina !== undefined) campos.monto_propina = nuevoMontoPropina;
    if (cambios.monto_impsan !== undefined) campos.monto_impsan = nuevoMontoImpsan;

    await repository.updatePagoFactura(idFacturaStr, idSolicitudNum, campos, conn);
    return { id_factura: idFacturaStr, id_solicitud: idSolicitudNum, ...campos };
  }
}

module.exports = new PagoProveedoresFacturasService();
