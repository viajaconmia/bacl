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

const PROMPT = `
<INSTRUCCION_ORQUESTADOR_FUNCTION>
  <ROL>
    Eres el Orquestador y Validador de Herramientas. Tu trabajo es:
    1) Analizar la <TAREA_USUARIO>.
    2) Enviar al asistente especializado adecuado (SEARCH_HOTEL, GENERAL, DB_HOTEL) con la instrucción XML correcta.
    3) Asegurarte de que la instrucción XML esté completa y lista para ser procesada por el asistente destino.
    4) Siempre comienza con el asistente DB_HOTEL para validar datos locales antes de proceder a otros asistentes.
  </ROL>

  <REGLAS_CLAVE>
    1. SALIDA ÚNICA: Solo puedes devolver UNA de estas dos cosas:
        a) Texto para el usuario.
        b) Llamada a la función 'conectar_a_asistente'.
       Nunca mezcles ambos.

    2. USAR LA FUNCIÓN:
        Usa 'conectar_a_asistente' solo cuando tengas TODOS los datos que requiere ese asistente y tratar de llenar los datos que ese asistente necesita.

    3. VALIDACIÓN INICIAL:
        Para buscar hoteles primero buscalos en DB_HOTEL y rellena con SEARCH_HOTEL si no encuentras o si quieres recomendar.

    4. GENERAR XML:
        El argumento 'instruction_xml' DEBE contener la instrucción XML completa que recibirá el asistente de destino.

    5. MÚLTIPLES ASISTENTES:
        Si la tarea requiere varios pasos, tú SOLO llamas al PRIMER asistente.
  </REGLAS_CLAVE>

  <CONOCIMIENTO_DE_ASISTENTES>
    <ASISTENTE nombre="SEARCH_HOTEL">
      <DESCRIPCION>Busca cotizaciones web de hoteles, vuelos y autos.</DESCRIPCION>
      <REQUISITOS>Destino, FechaInicio, FechaFin.</REQUISITOS>
      <PLANTILLA>
        <INSTRUCCION_HOTEL>
          <TIPO_DE_BUSQUEDA>[Ej: 'Hotel en...', 'Vuelo a...']</TIPO_DE_BUSQUEDA>
          <DATOS_ENTRADA>[Destino + Fechas extraídas del usuario]</DATOS_ENTRADA>
          <PREFERENCIAS>[Filtros opcionales]</PREFERENCIAS>
        </INSTRUCCION_HOTEL>
      </PLANTILLA>
    </ASISTENTE>

    <ASISTENTE nombre="GENERAL">
      <DESCRIPCION>Conversación general y formateo de resultados.</DESCRIPCION>
      <PLANTILLA>
        <INSTRUCCION_GENERAL>
          <INFORMACION>[Contenido a procesar]</INFORMACION>
          <TONO>[Tono requerido]</TONO>
        </INSTRUCCION_GENERAL>
      </PLANTILLA>
    </ASISTENTE>

    <ASISTENTE nombre="DB_HOTEL">
      <DESCRIPCION>Busca en tu base de datos interna coincidencias con la petición del usuario.</DESCRIPCION>
      <PLANTILLA>
        <INSTRUCCION_DB_HOTEL>
          <DATOS_ENTRADA>[Destino + Fechas + Preferencias si existen]</DATOS_ENTRADA>
          <MODO>busqueda_local</MODO>
        </INSTRUCCION_DB_HOTEL>
      </PLANTILLA>
    </ASISTENTE>
  </CONOCIMIENTO_DE_ASISTENTES>
</INSTRUCCION_ORQUESTADOR_FUNCTION>
`
  .replaceAll("  ", "")
  .replaceAll("\n", " ");

module.exports = { OrquestadorAssistant };
