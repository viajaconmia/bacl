const { OrquestadorAssistant } = require("./assistants/Orquestador");

class Orquestador {
  orquestador;

  constructor() {
    this.orquestador = new OrquestadorAssistant(this.cambiarAssistant);
  }

  async execute(message, queue = [], updates = []) {
    let pila = new Pila(...queue);
    let historial = new Historial(...updates);
    if (message) historial.update({ user: message });
    if (pila.isEmpty()) {
      let parts = await this.orquestador.execute(message);
      pila.push(...parts);
      historial.update(...parts);
    }

    while ("functionCall" in pila.seeNext()) {
      const callfuncion = pila.pop().functionCall.args;
      const response = await this.orquestador.call(callfuncion, historial);
      pila.push(...response);
      historial.update(...response);
    }

    return { pila: pila.getAll(), historial: historial.getHistorial() };
  }
}

class Pila {
  pila = [];

  constructor(...data) {
    this.pila.push(...data);
  }

  push = (...data) => (this.pila = [...data, ...this.pila]);
  seeNext = () => (this.pila.length > 0 ? this.pila[0] : {});
  pop = () => this.pila.shift();
  getAll = () => [...this.pila];
  isEmpty = () => this.pila.length == 0;
}

class Historial {
  historial;

  constructor(...data) {
    this.historial = new Pila(...data);
  }

  update = (...data) => this.historial.push(...data.reverse());
  getClean = () =>
    this.historial.pila.map(({ thoughtSignature, ...rest }) => ({ ...rest }));
  getHistorial = () => this.historial.pila;
}

module.exports = { Orquestador };
