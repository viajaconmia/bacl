const { GoogleGenAI } = require("@google/genai");
const { v4: uuidv4 } = require("uuid");

class Task {
  constructor({
    status = false,
    tarea = "",
    assistant = "",
    args = {},
    id = "",
  }) {
    this.status = status; // loading, success, error
    this.tarea = tarea;
    this.assistant = assistant;
    this.args = args;
    this.id = id;
  }

  finalizar(resolucion) {
    this.status = true;
    this.resolucion = resolucion;
  }

  get() {
    return {
      status: this.status,
      tarea: this.tarea,
      assistant: this.assistant,
      args: this.args,
    };
  }
}

class Assistant {
  constructor({ model, instrucciones = "", dependencias = [], name = "" }) {
    this.ai = Assistant.getInstance();
    this.model = model || "gemini-2.5-flash-lite";
    this.instrucciones = instrucciones;
    this.dependencias = dependencias;
    this.name = name;
  }

  static getInstance() {
    if (!Assistant.instance) {
      Assistant.instance = new GoogleGenAI({});
    }
    return Assistant.instance;
  }

  async message(message, retry = false) {
    try {
      if (!message) throw new Error("Mensaje vacío no permitido");
      if (message.length === 2000) throw new Error("Mensaje demasiado largo");

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
      console.error(`[${this.name}] Error:`, error.message);

      if (!retry) {
        // Retry con modelo alternativo
        this.model =
          this.model === "gemini-2.5-flash-lite"
            ? "gemini-2.0-flash"
            : "gemini-2.5-flash-lite";
        console.log(`[${this.name}] Reintentando con modelo: ${this.model}`);
        return this.message(message, true);
      }

      throw new Error(
        error.message || `[${this.name}] Falló mensaje tras retry`
      );
    }
  }

  async execute(message) {
    const response = await this.message(message);

    const parts = response?.candidates?.[0]?.content?.parts || [];

    return parts.map((part) => {
      if ("functionCall" in part) {
        return {
          role: "assistant",
          assistant: this.name,
          functionCall: new Task({
            id: uuidv4(),
            tarea: part.functionCall.name,
            args: part.functionCall.args,
            assistant: this.name,
          }),
        };
      }

      return {
        role: "assistant",
        assistant: this.name,
        message: part.text || "",
      };
    });
  }

  // Método genérico a sobreescribir en subclases
  async call(task, pila) {
    return [
      {
        role: "assistant",
        assistant: this.name,
        message: "⚠️ Esta función aún no está implementada.",
      },
    ];
  }
}

module.exports = { Assistant };
