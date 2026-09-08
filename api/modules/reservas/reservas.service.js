const { CustomError } = require("../../../middleware/errorHandler");
const repository = require("./reservas.repository");

// Campos editables vía PATCH /reservas/:id_booking.
const ALLOWED_FIELDS = new Set([
  "ticket_zoho",
  "portal",
  "orden_compra",
  "cliente_solicitante_reserva",
]);

const MAX_LENGTHS = {
  ticket_zoho: 50,
  portal: 100,
  orden_compra: 100,
  cliente_solicitante_reserva: 100,
};

class ReservasService {
  /**
   * Update genérico y acotado por ALLOWED_FIELDS de los campos generales de
   * bookings (ticket_zoho, portal, orden_compra, cliente_solicitante_reserva).
   * @param {string} id_booking
   * @param {Record<string, unknown>} fields
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async editarCamposGenerales(id_booking, fields = {}, conn = null) {
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

    const affectedRows = await repository.updateFields(id_booking, fieldsToUpdate, conn);

    if (affectedRows === 0) {
      throw new CustomError("No se encontró el booking", 404, "BOOKING_NOT_FOUND");
    }

    return { id_booking, ...fieldsToUpdate };
  }
}

module.exports = new ReservasService();
