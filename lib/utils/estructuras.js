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

module.exports = { Historial, Cola };
