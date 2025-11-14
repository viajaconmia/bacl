const { GoogleGenAI } = require("@google/genai");

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

    return response.candidates[0].content.parts.map((part) => ({
      role: "assistant",
      assistant: this.name,
      ...("functionCall" in part
        ? {
            functionCall: new Task({
              id: (Math.random() * 9999999).toFixed(0),
              tarea: part.functionCall.name,
              args: part.functionCall.args,
              assistant: this.name,
            }),
          }
        : part),
    }));
  }

  async call(args, historial, pila) {
    return [
      {
        message: "Aun no se implementa algo para esta función",
        assistant: this.name,
      },
    ];
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

class Task {
  constructor({
    finalizada = false,
    tarea = "",
    assistant = "",
    args = {},
    id = "",
  }) {
    this.finalizada = finalizada;
    this.tarea = tarea;
    this.assistant = assistant;
    this.args = args;
    this.id = id;
  }

  finalizar(resolucion) {
    this.finalizada = true;
    this.resolucion = resolucion;
  }

  get() {
    return {
      finalizada: this.finalizada,
      tarea: this.tarea,
      assistant: this.assistant,
      args: this.args,
    };
  }
}

module.exports = { Assistant };

// src/core/Assistant.js
// const { Task } = require("./Task");

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
            id: Math.random().toString(36).substring(2, 9),
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
  async call(args, historial, pila) {
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
