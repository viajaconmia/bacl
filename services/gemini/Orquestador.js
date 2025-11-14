const { Cola, Historial } = require("../../lib/utils/estructuras");
const { GeneralAssistant } = require("./assistants/General");
const { OrquestadorAssistant } = require("./assistants/Orquestador");
const { SearchHotel } = require("./assistants/SearchHotel");

const ASSISTANTS_MAP = {
  general: new GeneralAssistant(),
  search_hotel: new SearchHotel(),
  orquestador: new OrquestadorAssistant(),
};

class Orquestador {
  static instance = null;
  orquestador;

  constructor() {}

  async execute(message, queue = [], updates = []) {
    let cola = new Cola(...queue);
    let historial = new Historial(...updates);

    if (message) historial.update({ role: "user", text: message });

    if (cola.isEmpty()) {
      this.orquestador = ASSISTANTS_MAP["orquestador"];
    } else {
      this.orquestador = ASSISTANTS_MAP[cola.seeNext().assistant];
    }
    let response;

    console.log(cola);

    if (cola.seeNext().functionCall) {
      const task = cola.pop();
      response = await this.orquestador.call(
        task.functionCall.args,
        historial,
        cola
      );
    } else {
      response = await this.orquestador.execute(message);
    }
    console.log(response);

    let parts = response.map((part) => ({
      role: "assistant",
      assistant: this.name,
      ...("functionCall" in part
        ? {
            functionCall: new Task({
              tarea: part.functionCall.name,
              args: part.functionCall.args,
              assistant: this.name,
            }),
          }
        : part),
    }));

    cola.push(...parts);
    historial.update(...parts);

    return { cola: cola.getClean(), historial: historial.getClean() };
  }
}

module.exports = { Orquestador };
