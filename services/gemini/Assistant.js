const { GoogleGenAI } = require("@google/genai");

class Gemini {
  static #aiInstance = null;

  static getInstance() {
    if (!Gemini.#aiInstance) {
      Gemini.#aiInstance = new GoogleGenAI({});
    }
    return Gemini.#aiInstance;
  }
}

class Assistant {
  constructor(model, instrucciones, dependencias = []) {
    this.ai = Gemini.getInstance();
    this.model = model || "gemini-2.5-flash-lite" || "gemini-2.0-flash";
    this.instrucciones = instrucciones || "";
    this.dependencias = dependencias;
  }

  async execute(message) {
    //Aqui debo ejecutar y verificar que mi call se llame o que en mis funciones tenga ese tipo de funcion a llamar, si no entonces me salto el while y lo regreso al orquestador
    throw new Error("No se ha sobreescrito esta funcion");
  }

  async call(args) {
    //Esta creo que seria la funcion a llamar, se debera sobreescribir
    throw new Error("No se ha sobreescrito esta funcion");
  }

  async message(message) {
    //Aqui podria manejar el volver a intentar
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: message,
      config: {
        systemInstruction: this.instrucciones,
        ...this.dependencias,
      },
    });
    return response;
  }
}

module.exports = { Assistant };
