const { CustomError } = require("../../../../middleware/errorHandler");
const repository = require("./reservasComisionables.repository");

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
}

module.exports = new ReservasComisionablesService();
