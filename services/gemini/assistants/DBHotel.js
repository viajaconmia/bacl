const { Type } = require("@google/genai");
const { Assistant } = require("./Assistant");

class DBHotel extends Assistant {
  constructor() {
    super({
      model: "gemini-2.5-pro",
      instrucciones: PROMPT,
      dependencias: {
        tools: [
          {
            functionDeclarations: [routeToAssistantFunctionDeclaration],
          },
        ],
      },
      name: "db_hotel",
    });
  }

  async call(task, history, stack) {}
}

const routeToAssistantFunctionDeclaration = {
  name: "conectar_a_asistente",
  description:
    "Routes the user's request to the most appropriate specialized assistant by generating the necessary XML instruction.",
  parameters: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        ciudad: {
          type: Type.STRING,
          description:
            'The name of the specialized assistant to call (e.g., "CODE", "DATA", or "GENERAL").',
        },
        desayuno_incluido: {
          type: Type.BOOLEAN,
          description:
            "The complete and finalized XML instruction block (e.g., <INSTRUCCION_CODE>...</INSTRUCCION_CODE>) for the selected assistant.",
        },
      },
      required: ["ciudad", "instruction_xml"],
    },
  },
};

const PROMPT = `<INSTRUCCION_ASISTENTE_DB_HOTELES>`;

module.exports = { DBHotel };
