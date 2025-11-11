const { Type } = require("@google/genai");
const { Assistant } = require("../Assistant");
const { GeneralAssistant } = require("./General");
const { SearchHotel } = require("./SearchHotel");

const assistant = {
  general: new GeneralAssistant(),
  search_hotel: new SearchHotel(),
};

class OrquestadorAssistant extends Assistant {
  constructor() {
    super("gemini-2.5-flash", PROMPT, [routeToAssistantFunctionDeclaration]);
  }

  async execute(message) {
    const response = await this.message(message);
    return response.candidates[0].content.parts;
  }

  async call({ assistant_name, instruction_xml }, historial) {
    console.log(assistant_name, instruction_xml);
    return await assistant[(assistant_name || "").toLowerCase()].execute(
      instruction_xml
    );
  }
}

const routeToAssistantFunctionDeclaration = {
  name: "route_to_assistant",
  description:
    "Routes the user's request to the most appropriate specialized assistant by generating the necessary XML instruction.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      assistant_name: {
        type: Type.STRING,
        description:
          'The name of the specialized assistant to call (e.g., "CODE", "DATA", or "GENERAL").',
      },
      instruction_xml: {
        type: Type.STRING,
        description:
          "The complete and finalized XML instruction block (e.g., <INSTRUCCION_CODE>...</INSTRUCCION_CODE>) for the selected assistant.",
      },
    },
    required: ["assistant_name", "instruction_xml"],
  },
};

const PROMPT = `<INSTRUCCION_ORQUESTADOR_FUNCTION>
  <ROL>Eres el Orquestador de Herramientas. Tu única función es analizar la <TAREA_USUARIO> y decidir qué asistente especializado es el más apropiado para ejecutarla. Tu respuesta DEBE ser una llamada a la función 'route_to_assistant' y un mensaje avisando al usuario con un comentario breve cual es el paso siguiente que realizara el agente, un ejemplo seria, comenzare a buscar hoteles....</ROL>

  <REGLAS_CLAVE>
    1. **NO RESPONDER**: Nunca respondas la pregunta del usuario directamente, solo avisale que pasos vas a seguir.
    2. **USAR FUNCIÓN**: Debes usar la herramienta 'route_to_assistant' para delegar la tarea.
    3. **GENERAR XML**: El argumento 'instruction_xml' de la función debe contener la instrucción XML completa para el asistente de destino, extrayendo y formateando los detalles de la tarea del usuario.
    4. **ASISTENTE GENERAL**: Si la tarea es ambigua o no especializada, usa el asistente 'GENERAL'.
    5. **MANEJA RESPUESTA**: Al final manda a llamar siempre al Assistente GENERAL, el ayudara a formatear la información para que el usuario pueda verla, siempre quedara al final de las funciones a llamar
  </REGLAS_CLAVE>

  <ASISTENTES_Y_PLANTILLAS>
    <ASISTENTE nombre="CODE">
      <DESCRIPCION>Genera, revisa o refactoriza código (JavaScript, Python, etc.).</DESCRIPCION>
      <PLANTILLA>
        <INSTRUCCION_CODE>
          <TAREA_PRINCIPAL>[Instrucción clara de la tarea de codificación.]</TAREA_PRINCIPAL>
          <RESTRICCIONES>[Restricciones de formato o estilo.]</RESTRICCIONES>
        </INSTRUCCION_CODE>
      </PLANTILLA>
    </ASISTENTE>
    <ASISTENTE nombre="SEARCH_HOTEL">
      <DESCRIPCION>Busca los mejores hoteles para el usuario.</DESCRIPCION>
      <PLANTILLA>
        <INSTRUCCION_DATA>
          <TIPO_DE__BUSQUEDA>[Tipo de busqueda por ciudad, pais, estado, localidad.]</TIPO_DE__BUSQUEDA>
          <DATOS_ENTRADA>[Los datos relevantes del prompt para poder buscar.]</DATOS_ENTRADA>
        </INSTRUCCION_DATA>
      </PLANTILLA>
    </ASISTENTE>
    <ASISTENTE nombre="general">
      <DESCRIPCION>Maneja la conversación con el usuario, usar para definir platica, responder, preguntas o conversar.</DESCRIPCION>
      <PLANTILLA>
        <INSTRUCCION_GENERAL>
          <INFORMACION>[La información recopilada hasta el momento.]</INFORMACION>
          <TONO>[Tono de respuesta requerido.]</TONO>
        </INSTRUCCION_GENERAL>
      </PLANTILLA>
    </ASISTENTE>
  </ASISTENTES_Y_PLANTILLAS>
</INSTRUCCION_ORQUESTADOR_FUNCTION>`;

module.exports = { OrquestadorAssistant };
