const { CustomError } = require("../../../../middleware/errorHandler");
const repository = require("./agentesEmpresas.repository");

class AgentesEmpresasService {
  /**
   * @param {string} id_agente
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async getDatosFiscalesByAgente(id_agente, conn = null) {
    if (!id_agente) {
      throw new CustomError("id_agente es requerido", 400, "VALIDATION_ERROR");
    }
    return repository.findDatosFiscalesByAgente(id_agente, conn);
  }
}

module.exports = new AgentesEmpresasService();
