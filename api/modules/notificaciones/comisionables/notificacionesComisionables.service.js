const reservasComisionablesService = require("../../reservas/comisionables/reservasComisionables.service");

class NotificacionesComisionablesService {
  async getConteo(conn = null) {
    return reservasComisionablesService.getConteo(conn);
  }
}

module.exports = new NotificacionesComisionablesService();
