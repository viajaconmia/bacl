const { Type } = require("@google/genai");
const { Assistant } = require("../Assistant");

class SearchHotel extends Assistant {
  constructor() {
    super("gemini-2.5-flash", PROMPT, [searchHotel]);
  }

  async execute(message) {
    const response = await this.message(message);
    return response.candidates[0].content.parts;
  }
}

const searchHotel = {
  name: "search_hotel",
  description: "Routes the user's request to the most appropriate Hotel.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: "the id from the hotel",
      },
    },
    required: ["id"],
  },
};

const PROMPT = `<INSTRUCCION_SEARCHER_FUNCTION>
  <ROL>Eres el Buscador de hoteles. Tu única función es analizar la <TAREA_USUARIO> y decidir qué hotel es el más apropiado para el usuario. Tu respuesta DEBE ser una llamada a la función 'search_hotel' utilizando las cosas que el usuario te diga para encontrar el mejor hotel para el</ROL>

  <REGLAS_CLAVE>
    1. **NO RESPONDER**: Nunca respondas la pregunta del usuario directamente.
    2. **USAR FUNCIÓN**: Debes usar la herramienta 'search_hotel' para delegar la tarea.
  </REGLAS_CLAVE>
</INSTRUCCION_SEARCHER_FUNCTION>`;

module.exports = { SearchHotel };
