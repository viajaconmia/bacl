const { CustomError } = require("../../../middleware/errorHandler");
const repository = require("./facturas.repository");

// Campos editables vía PATCH /factura/:id_factura.
const ALLOWED_FIELDS = new Set(["uuid_crp"]);

const MAX_LENGTHS = {
  uuid_crp: 50,
};

class FacturasService {
  /**
   * @param {string} id_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async getById(id_factura, conn = null) {
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const factura = await repository.findById(id_factura, conn);

    if (!factura) {
      throw new CustomError(
        `Factura ${id_factura} no encontrada`,
        404,
        "FACTURA_NOT_FOUND",
      );
    }

    return factura;
  }

  async getAll(filters = {}, conn = null) {
    return repository.findAll(filters, conn);
  }

  /**
   * Update genérico y acotado por ALLOWED_FIELDS de los campos generales de
   * facturas (por ahora, solo uuid_crp).
   * @param {string} id_factura
   * @param {Record<string, unknown>} fields
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async editarCamposGenerales(id_factura, fields = {}, conn = null) {
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
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

    const fieldsToUpdate = {};

    for (const key of keys) {
      const value = fields[key];
      const normalized = value === "" ? null : value;

      if (normalized !== null && typeof normalized !== "string") {
        throw new CustomError(`El campo ${key} debe ser texto`, 400, "VALIDATION_ERROR");
      }

      if (normalized !== null && normalized.length > MAX_LENGTHS[key]) {
        throw new CustomError(
          `El campo ${key} excede el máximo de ${MAX_LENGTHS[key]} caracteres`,
          400,
          "VALIDATION_ERROR",
        );
      }

      fieldsToUpdate[key] = normalized;
    }

    const affectedRows = await repository.updateFields(id_factura, fieldsToUpdate, conn);

    if (affectedRows === 0) {
      throw new CustomError(
        `Factura ${id_factura} no encontrada`,
        404,
        "FACTURA_NOT_FOUND",
      );
    }

    return { id_factura, ...fieldsToUpdate };
  }
}

module.exports = new FacturasService();
