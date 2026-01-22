class Cola {
  cola = [];

  constructor(...data) {
    this.cola.push(...data);
  }

  push = (...data) => (this.cola = [...data, ...this.cola]);
  shift = (...data) => (this.cola = [...this.cola, ...data]);
  seeNext = () => (this.cola.length > 0 ? this.cola[0] : {});
  getClean = () =>
    this.cola.map(({ thoughtSignature, ...rest }) => ({ ...rest }));
  pop = () => this.cola.shift();
  getCola = () => [...this.cola];
  isEmpty = () => this.cola.length == 0;
}

class Historial {
  historial = [];

  constructor(...data) {
    this.historial = new Cola(...data);
  }

  update = (...data) => this.historial.push(...data.reverse());
  isEmpty = () => this.historial.isEmpty();
  map = (callback) =>
    (this.historial = new Cola(...this.historial.getCola().map(callback)));
  
  // 🔥 MODIFICADO: Preservar 'assistant' y 'thoughtSignature'
  getClean = () =>
    this.historial.cola.map(({ /* thoughtSignature, assistant, */ ...rest }) => ({
      ...rest,
      // Preservar assistant si existe
      ...(rest.functionCall?.assistant && { assistant: rest.functionCall.assistant }),
      // Agregar thoughtSignature de vuelta si es necesario
      // ...(thoughtSignature && { thoughtSignature }),
    }));
    
  getHistorial = () => this.historial.cola;
}

module.exports = { Historial, Cola };
