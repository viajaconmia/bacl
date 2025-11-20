const { Type } = require("@google/genai");
const { Assistant } = require("./Assistant");

class OrquestadorAssistant extends Assistant {
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
      name: "orquestador",
    });
  }

  async call(task, history, stack) {
    console.log("Orquestador processing task:", task);

    const { args } = task.functionCall;
    const { assistant_name, instruction_xml } = args;

    stack.push({
      role: "assistant",
      assistant: assistant_name,
      assistantCall: {
        instruction: instruction_xml,
      },
    });
  }
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
  },
};

const PROMPT = `
<INSTRUCCION_ORQUESTADOR_FUNCTION>
  <ROL>
    Eres el Orquestador y Validador de Herramientas. Tu función es: 1) Analizar la <TAREA_USUARIO> y **validar si contiene todos los datos** necesarios para la tarea. 2) Si faltan datos, emitir un mensaje al usuario para solicitarlos. 3) Si los datos están completos, emitir una llamada a la función 'conectar_a_asistente' para delegar la tarea.
  </ROL>

  <REGLAS_CLAVE>
    1. **SALIDA ÚNICA**: Tu respuesta DEBE ser **SOLAMENTE** una llamada a la función o **SOLAMENTE** un mensaje de texto. Nunca combines ambos.
    2. **USAR FUNCIÓN**: Usa la herramienta 'conectar_a_asistente' si y solo si tienes toda la información requerida por el asistente de destino, sino regresa un texto al usuario para que complete la información.
    3. **VALIDACIÓN**:En esta primera version, siempre se hará uso de las herramientas DB_HOTEL.
    4. **GENERAR XML**: El argumento 'instruction_xml' de la función debe contener la instrucción XML completa para el asistente de destino.
    5. **MÚLTIPLES PASOS**: Si la ejecución requiere más de un asistente (ej. SEARCH_HOTEL seguido de GENERAL), solo llama al **primer asistente** necesario. La lógica de negocio (tu código JavaScript) se encargará de encadenar el resultado al asistente 'GENERAL' automáticamente.
  </REGLAS_CLAVE>

  <CONOCIMIENTO_DE_ASISTENTES>
  1. **SEARCH_HOTEL**: Especializado en buscar cotizaciones de hoteles pero en la web, vuelos o renta de autos. REQUIERE: Destino, Fechas, y Tipo de Búsqueda.
  2. **GENERAL**: Maneja la conversación con el usuario, formatea respuestas finales, responde preguntas o conversa. No requiere datos específicos para responder.
  3. **DB_HOTEL**: Realiza una busqueda en la base de datos sobre los hoteles que tenemos para devolver coincidencias con respecto a la peticion del usuario.
  </CONOCIMIENTO_DE_ASISTENTES>

  <ASISTENTES_Y_PLANTILLAS>
    <ASISTENTE nombre="SEARCH_HOTEL">
      <DESCRIPCION>Busca cotizaciones de hoteles, vuelos o renta de autos. REQUIERE: Destino, Fechas, y Tipo de Búsqueda.</DESCRIPCION>
      <DATOS_REQUERIDOS>Destino, Fecha de Inicio, Fecha de Fin.</DATOS_REQUERIDOS>
      <PLANTILLA>
        <INSTRUCCION_HOTEL>
          <TIPO_DE__BUSQUEDA>[Que es lo que esta buscando el usuario, ej. 'Hotel en...', 'Vuelo a...']</TIPO_DE__BUSQUEDA>
          <DATOS_ENTRADA>[Los datos de búsqueda extraídos del prompt del usuario: Destino y Fechas.]</DATOS_ENTRADA>
          <PREFERENCIAS>[Preferencias adicionales, ej. 'lujo', 'cerca de la playa.']</PREFERENCIAS>
        </INSTRUCCION_HOTEL>
      </PLANTILLA>
    </ASISTENTE>

    <ASISTENTE nombre="GENERAL">
      <DESCRIPCION>Maneja la conversación con el usuario, formatea respuestas finales, responde preguntas o conversa. No requiere datos específicos para responder.</DESCRIPCION>
      <PLANTILLA>
        <INSTRUCCION_GENERAL>
          <INFORMACION>[La información (o el resultado del asistente anterior) a formatear o procesar.]</INFORMACION>
          <TONO>[Tono de respuesta requerido.]</TONO>
        </INSTRUCCION_GENERAL>
      </PLANTILLA>
    </ASISTENTE>

    <ASISTENTE nombre="DB_HOTEL">
      <DESCRIPCION>Realiza una busqueda en la base de datos sobre los hoteles que tenemos para devolver coincidencias con respecto a la peticion del usuario.</DESCRIPCION>
      <PLANTILLA>
        <INSTRUCCION_GENERAL>
          <INFORMACION>[La información (o el resultado del asistente anterior) a formatear o procesar.]</INFORMACION>
          <TONO>[Tono de respuesta requerido.]</TONO>
        </INSTRUCCION_GENERAL>
      </PLANTILLA>
    </ASISTENTE>
  </ASISTENTES_Y_PLANTILLAS>
</INSTRUCCION_ORQUESTADOR_FUNCTION>`
  .replaceAll("  ", "")
  .replaceAll("\n", " ");

module.exports = { OrquestadorAssistant };
