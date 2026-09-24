const { getExecutor } = require("../../../../config/db");

class AgentesEmpresasRepository {
  /**
   * Datos fiscales de las empresas activas asociadas a un agente.
   * Mismo query que el v1 legacy (api/v1/model/agentes.js:56-76,
   * getEmpresasDatosFiscales), reusado tal cual.
   * @param {string} id_agente
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findDatosFiscalesByAgente(id_agente, conn = null) {
    const run = getExecutor(conn);
    return run(
      `SELECT
        vw.*,
        e.*,
        ROW_NUMBER() OVER (PARTITION BY vw.id_agente ORDER BY e.created_at) AS rn
       FROM vw_datos_fiscales_detalle vw
       LEFT JOIN empresas e ON e.id_empresa = vw.id_empresa
       WHERE vw.id_agente = ? AND e.active = 1
       GROUP BY vw.id_empresa
       ORDER BY e.created_at DESC`,
      [id_agente],
    );
  }
}

module.exports = new AgentesEmpresasRepository();
