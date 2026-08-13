const { CustomError } = require("../../../../middleware/errorHandler");
const repository = require("./reservasComisionables.repository");

// Campos editables vía PATCH /reservas/comisionables/:id_booking.
// comision_cobrada NO va aquí a propósito: tiene su propio endpoint /cobrar.
const ALLOWED_FIELDS = new Set([
  "is_comisionable",
  "monto_comisionable",
  "porcentaje_comisionable",
  "comentarios_comisionables",
]);

const NUMERIC_FIELDS = new Set([
  "is_comisionable",
  "monto_comisionable",
  "porcentaje_comisionable",
]);

class ReservasComisionablesService {
  async getAll(filters = {}, conn = null) {
    return repository.findAll(filters, conn);
  }

  async getConteo(conn = null) {
    return repository.count(conn);
  }

  async marcarComisionCobrada(id_booking, conn = null) {
    if (!id_booking) {
      throw new CustomError(
        "id_booking es requerido",
        400,
        "VALIDATION_ERROR",
      );
    }

    const affectedRows = await repository.marcarCobrada(id_booking, conn);

    if (affectedRows === 0) {
      throw new CustomError(
        "No se encontró el booking",
        404,
        "BOOKING_NOT_FOUND",
      );
    }

    return { id_booking, comision_cobrada: true };
  }

  /**
   * Update genérico y acotado por ALLOWED_FIELDS de los campos comisionables
   * de bookings (is_comisionable, monto_comisionable, porcentaje_comisionable,
   * comentarios_comisionables). No toca comision_cobrada — usa /cobrar para eso.
   * @param {string} id_booking
   * @param {Record<string, unknown>} fields
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async editarCamposComisionables(id_booking, fields = {}, conn = null) {
    if (!id_booking) {
      throw new CustomError("id_booking es requerido", 400, "VALIDATION_ERROR");
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

      if (!NUMERIC_FIELDS.has(key)) {
        fieldsToUpdate[key] = value;
        continue;
      }

      const numericValue = value === null || value === "" ? null : Number(value);

      if (numericValue !== null && Number.isNaN(numericValue)) {
        throw new CustomError(
          `El campo ${key} debe ser numérico`,
          400,
          "VALIDATION_ERROR",
        );
      }

      if (key === "is_comisionable" && numericValue !== null && ![0, 1].includes(numericValue)) {
        throw new CustomError(
          "is_comisionable debe ser 0 o 1",
          400,
          "VALIDATION_ERROR",
        );
      }

      fieldsToUpdate[key] = numericValue;
    }

    const affectedRows = await repository.updateFields(
      id_booking,
      fieldsToUpdate,
      conn,
    );

    if (affectedRows === 0) {
      throw new CustomError("No se encontró el booking", 404, "BOOKING_NOT_FOUND");
    }

    return { id_booking, ...fieldsToUpdate };
  }
}

module.exports = new ReservasComisionablesService();
