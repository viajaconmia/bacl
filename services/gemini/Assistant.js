const { GoogleGenAI } = require("@google/genai");
const { Cola } = require("./Orquestador");

class Assistant {
  constructor({ model, instrucciones = "", dependencias = [], name = "" }) {
    this.ai = Gemini.getInstance();
    this.model = model || "gemini-2.5-flash-lite" || "gemini-2.0-flash";
    this.instrucciones = instrucciones || "";
    this.dependencias = dependencias;
    this.name = name;
  }

  async message(message, intent = false) {
    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: message,
        config: {
          systemInstruction: this.instrucciones,
          ...this.dependencias,
        },
      });
      return response;
    } catch (error) {
      if (!intent) {
        this.model =
          this.model == "gemini-2.5-flash-lite"
            ? "gemini-2.0-flash"
            : "gemini-2.5-flash-lite";
        const response = await this.message(message, true);
        return response;
      }
      throw error;
    }
  }

  async execute(message) {
    const response = await this.message(message);
    const cola = new Cola(...response.candidates[0].content.parts);

    while ("functionCall" in cola) {
      const callfuncion = cola.pop().functionCall.args;
      console.log(response);
      const response = await this.orquestador.call(callfuncion, historial);
      cola.push(...response);
      historial.update(...response);
    }

    //TODO
    /**
     * ME QUEDE EN CREAR UN OBJETO TAREA, ESTE ME SERVIRA PARA PODER MANEJAR LAS TAREAS Y CORRERLAS PARA DARLAS POR TERMINADAS UNA VES QUE EL ORQUESTADOR PUEDA REVISARLAS
     */

    return response.candidates[0].content.parts.map((part) => ({
      role: "assistant",
      assistant: this.name,
      ...part,
    }));
  }

  async call(args) {
    //Esta creo que seria la funcion a llamar, se debera sobreescribir
    // throw new Error("No se ha sobreescrito esta funcion");
    console.log("ME ESTAN LLAMANDO, quien?", this.name);
  }
}

class Gemini {
  static #aiInstance = null;

  static getInstance() {
    if (!Gemini.#aiInstance) {
      Gemini.#aiInstance = new GoogleGenAI({});
    }
    return Gemini.#aiInstance;
  }
}

module.exports = { Assistant };
