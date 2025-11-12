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

  constructor() {
    if (Orquestador.instance) {
      throw new Error(
        "Usa Orquestador.getInstance() para obtener la instancia."
      );
    }
    this.orquestador = new OrquestadorAssistant(ASSISTANTS_MAP);
  }

  // Método de acceso estático
  static getInstance() {
    if (!Orquestador.instance) {
      Orquestador.instance = new Orquestador(); // Crea la instancia si no existe
    }
    return Orquestador.instance;
  }

  async execute(message, queue = [], updates = []) {
    let cola = new Cola(...queue);
    let historial = new Historial(...updates);
    if (message) historial.update({ user: message });
    if (cola.isEmpty()) {
      let parts = await this.orquestador.execute(message);
      cola.push(...parts);
      historial.update(...parts);
    }

    while ("functionCall" in cola.seeNext()) {
      const callfuncion = cola.pop().functionCall.args;
      const response = await this.orquestador.call(callfuncion, historial);
      console.log("THIS IS RESPOMSE:", response);
      cola.push(...response);
      historial.update(...response);
    }

    return { cola: cola.getAll(), historial: historial.getHistorial() };
  }
}

class Cola {
  cola = [];

  constructor(...data) {
    this.cola.push(...data);
  }

  push = (...data) => (this.cola = [...data, ...this.cola]);
  seeNext = () => (this.cola.length > 0 ? this.cola[0] : {});
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
    this.historial.cola.map(({ thoughtSignature, ...rest }) => ({ ...rest }));
  getHistorial = () => this.historial.cola;
}

module.exports = { Orquestador };
