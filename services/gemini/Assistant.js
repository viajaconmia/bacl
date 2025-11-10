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
  constructor(model, instrucciones, functions = []) {
    this.ai = Gemini.getInstance();
    this.model = model || "gemini-2.0-flash" || "gemini-2.5-flash";
    this.instrucciones = instrucciones || "";
    this.functions = functions;
  }

  async execute(message) {
    throw new Error("No se ha sobreescrito esta funcion");
  }

  async call(args) {
    throw new Error("No se ha sobreescrito esta funcion");
  }

  async message(message) {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: message,
      config: {
        systemInstruction: this.instrucciones,
        tools: [
          {
            functionDeclarations: this.functions,
          },
        ],
      },
    });
    return response;
  }
}

module.exports = { Assistant };
