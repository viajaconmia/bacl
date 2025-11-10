const { OrquestadorAssistant } = require("./assistants/Orquestador");

class Orquestador {
  orquestador;

  constructor() {
    this.orquestador = new OrquestadorAssistant(this.cambiarAssistant);
  }

  async execute(message = "", queue = []) {
    let pila = new Pila(...queue);
    if (pila.isEmpty()) {
      let parts = await this.orquestador.execute(message);
      pila.push(...parts);
    }

    while ("functionCall" in pila.seeNext()) {
      const callfuncion = pila.pop().functionCall.args;
      const response = await this.orquestador.call(callfuncion);
      pila.push(...response);
    }

    return pila.getAll();
  }
}

class Pila {
  pila = [];

  constructor(...data) {
    this.pila.push(...data);
  }

  push = (...data) => this.pila.push(...data);
  seeNext = () => (this.pila.length > 0 ? this.pila[0] : {});
  pop = () => this.pila.shift();
  getAll = () => [...this.pila];
  isEmpty = () => this.pila.length == 0;
}

module.exports = { Orquestador };
