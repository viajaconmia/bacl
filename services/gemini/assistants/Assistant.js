const { GoogleGenAI } = require("@google/genai");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

class Task {
  constructor({
    status = "queue",
    tarea = "",
    assistant = "",
    args = {},
    id = "",
  }) {
    this.status = status; // loading, success, error, queue
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
    this.ai = new GoogleGenAI({});
    this.model = model || "gemini-2.5-flash-lite";
    this.instrucciones = instrucciones;
    this.dependencias = dependencias;
    this.name = name;
  }

  async message(message, history, retry = false) {
    try {
      if (!message) throw new Error("Mensaje vacío no permitido");
      if (message.length === 2000) throw new Error("Mensaje demasiado largo");

      const formatted = history
        .getClean()
        .reverse()
        .slice(-30)
        .map((item) => {
          // Si es functionCall
          if (item.functionCall) {
            return {
              role: "model",
              parts: [
                {
                  text: `functionCall: ${
                    item.functionCall.name
                  }\nargs: ${JSON.stringify(item.functionCall.args, null, 2)}`,
                },
              ],
            };
          }
          // Mensajes normales
          return {
            role: item.role == "assistant" ? "model" : item.role,
            parts: [{ text: item.text || item.message || "" }],
          };
        });

      const contents = [
        ...(history.isEmpty()
          ? [{ role: "user", parts: [{ text: message }] }]
          : [...formatted]),
      ];

      console.log("contents:", ...contents);

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents,
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
        return this.message(message, history, true);
      }

      throw new Error(
        error.message || `[${this.name}] Falló mensaje tras retry`
      );
    }
  }

  async execute(message, history) {
    const response = await this.message(message, history);

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
        text: part.text || "",
      };
    });
  }

  // Método genérico a sobreescribir en subclases
  async call(task, history, stack) {
    throw new Error("Method not implemented.");
  }
}

module.exports = { Assistant };
