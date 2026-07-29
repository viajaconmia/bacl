const repository = require("./reservasSolicitudes.repository");

class ReservasSolicitudesService {
  async getPendientes(conn = null) {
    return repository.findPendientes(conn);
  }
}

module.exports = new ReservasSolicitudesService();
