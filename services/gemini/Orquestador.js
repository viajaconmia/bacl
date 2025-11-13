const { GeneralAssistant } = require("./assistants/General");
const { OrquestadorAssistant } = require("./assistants/Orquestador");
const { SearchHotel } = require("./assistants/SearchHotel");

const ASSISTANTS_MAP = {
  general: new GeneralAssistant(),
  search_hotel: new SearchHotel(),
};

class Orquestador {
  static instance = null;
  orquestador;

  constructor() {}

  async execute(message, queue = [], updates = []) {
    let cola = new Cola(...queue);
    let historial = new Historial(...updates);

    if (message) historial.update({ role: "user", text: message });

    if (cola.isEmpty()) this.orquestador = new OrquestadorAssistant();

    await this.orquestador.execute(message, cola, historial);

    // while ("functionCall" in cola.seeNext()) {
    //   const callfuncion = cola.pop().functionCall.args;
    //   const response = await this.orquestador.call(callfuncion, historial);
    //   console.log("THIS IS RESPOMSE:", response);
    //   cola.push(...response);
    //   historial.update(...response);
    // }

    return { cola: cola.getClean(), historial: historial.getClean() };
  }
}

class Cola {
  cola = [];

  constructor(...data) {
    this.cola.push(...data);
  }

  push = (...data) => (this.cola = [...data, ...this.cola]);
  seeNext = () => (this.cola.length > 0 ? this.cola[0] : {});
  getClean = () =>
    this.cola.map(({ thoughtSignature, ...rest }) => ({ ...rest }));
  pop = () => this.cola.shift();
  getAll = () => [...this.cola];
  isEmpty = () => this.cola.length == 0;
}

class Historial {
  historial;

  constructor(...data) {
    this.historial = new Cola(...data);
  }

  update = (...data) => this.historial.push(...data.reverse());
  getClean = () =>
    this.historial.cola.map(({ thoughtSignature, assistant, ...rest }) => ({
      ...rest,
    }));
  getHistorial = () => this.historial.cola;
}

module.exports = { Orquestador, Cola };
