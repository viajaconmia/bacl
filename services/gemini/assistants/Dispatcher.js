const { Historial } = require("../../../lib/utils/estructuras");
const { DBHotel } = require("./DBHotel");
const { GeneralAssistant } = require("./General");
const { OrquestadorAssistant } = require("./Orquestador");
const { SearchHotel } = require("./SearchHotel");

/*Esta es la forma que se pone:
 * KEY: name del XML agregado al orquestador y el name del assistant
 * VALUE: instancia del asistente especializado
 */
const agentes = {
  general: new GeneralAssistant(),
  search_hotel: new SearchHotel(),
  orquestador: new OrquestadorAssistant(),
  db_hotel: new DBHotel(),
};

const agentes_context = ["general", "orquestador"];

async function dispatcher(agentName, task, history = [], stack = []) {
  const agent = agentes[agentName];
  if (!agent) throw new Error(`Agente no encontrado: ${agentName}`);

  return await agent.call(task, history, stack);
}

async function executer(agentName, input, history = []) {
  const agent = agentes[agentName];
  if (!agent) throw new Error(`Agente no encontrado: ${agentName}`);

  return await agent.execute(
    input,
    agentes_context.includes(agentName) ? history : new Historial()
  );
}

module.exports = { agentes, dispatcher, executer };
