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
};

async function dispatcher(agentName, input, history = [], stack = []) {
  const agent = agentes[agentName];
  if (!agent) throw new Error(`Agente no encontrado: ${agentName}`);

  return await agent.call(input, history, stack);
}
async function executer(agentName, input) {
  const agent = agentes[agentName];
  if (!agent) throw new Error(`Agente no encontrado: ${agentName}`);

  return await agent.execute(input);
}

module.exports = { agentes, dispatcher, executer };
