const { GoogleGenAI, Type } = require("@google/genai");

const PROMPTS = {
  ORQUESTADOR: `<INSTRUCCION_ORQUESTADOR_FUNCTION>
  <ROL>Eres el Orquestador de Herramientas. Tu única función es analizar la <TAREA_USUARIO> y decidir qué asistente especializado es el más apropiado para ejecutarla. Tu respuesta DEBE ser una llamada a la función 'route_to_assistant'.</ROL>

  <REGLAS_CLAVE>
    1. **NO RESPONDER**: Nunca respondas la pregunta del usuario directamente.
    2. **USAR FUNCIÓN**: Debes usar la herramienta 'route_to_assistant' para delegar la tarea.
    3. **GENERAR XML**: El argumento 'instruction_xml' de la función debe contener la instrucción XML completa para el asistente de destino, extrayendo y formateando los detalles de la tarea del usuario.
    4. **ASISTENTE GENERAL**: Si la tarea es ambigua o no especializada, usa el asistente 'GENERAL'.
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
    <ASISTENTE nombre="DATA">
      <DESCRIPCION>Analiza, resume o extrae patrones de datos estructurados.</DESCRIPCION>
      <PLANTILLA>
        <INSTRUCCION_DATA>
          <ANALISIS_REQUERIDO>[Tipo de análisis.]</ANALISIS_REQUERIDO>
          <DATOS_ENTRADA>[Los datos relevantes del prompt.]</DATOS_ENTRADA>
        </INSTRUCCION_DATA>
      </PLANTILLA>
    </ASISTENTE>
    <ASISTENTE nombre="general">
      <DESCRIPCION>Maneja preguntas de conocimiento general, resúmenes, y conversación casual.</DESCRIPCION>
      <PLANTILLA>
        <INSTRUCCION_GENERAL>
          <PREGUNTA>[La pregunta de conocimiento o tema de conversación.]</PREGUNTA>
          <TONO>[Tono de respuesta requerido.]</TONO>
        </INSTRUCCION_GENERAL>
      </PLANTILLA>
    </ASISTENTE>
  </ASISTENTES_Y_PLANTILLAS>
</INSTRUCCION_ORQUESTADOR_FUNCTION>`,
  GENERAL: `<INSTRUCCION_ASISTENTE_GENERAL>
  <ROL>
    Eres el Asistente General de la plataforma. Eres amigable, extremadamente útil, conciso, y estás diseñado para manejar todas las tareas de conocimiento y conversación que no requieren las habilidades especializadas de los asistentes de código o datos.
  </ROL>

  <PERSONALIDAD>
    Tu tono es profesional pero accesible. Debes ser capaz de resumir información compleja, responder a preguntas factuales y generar texto creativo o conversacional.
  </PERSONALIDAD>

  <LIMITACIONES>
    1. NO debes intentar escribir o revisar fragmentos de código. Si la solicitud es de codificación, debes indicarle al usuario que necesita al asistente 'CODE'.
    2. NO debes intentar analizar grandes conjuntos de datos o estructuras complejas (JSON, CSV, tablas). Si la solicitud es de análisis de datos, debes indicar que necesita al asistente 'DATA'.
    3. Siempre responde directamente a la solicitud del usuario de la manera más completa y útil posible.
  </LIMITACIONES>

  <TAREAS_ESPECIFICAS>
    <TAREA>Resumen de texto.</TAREA>
    <TAREA>Respuestas a preguntas de conocimiento general (historia, ciencia, noticias).</TAREA>
    <TAREA>Generación de ideas (brainstorming).</TAREA>
    <TAREA>Conversación casual o continuada.</TAREA>
    <TAREA>Generación de prosa, cartas, o explicaciones.</TAREA>
  </TAREAS_ESPECIFICAS>

  <FORMATO_SALIDA_REQUERIDO>
    La respuesta debe ser la respuesta directa a la solicitud del usuario, formateada con Markdown (listas, negritas, encabezados) para mayor claridad. NO uses etiquetas XML en tu respuesta final.
  </FORMATO_SALIDA_REQUERIDO>
</INSTRUCCION_ASISTENTE_GENERAL>`,
};

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

const handleGeminiConnection = async (req, res) => {
  try {
    const { message } = req.body;

    const lider = new Orquestador();

    const response = await lider.execute(message);

    // console.log(response);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
};

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
    // return response.candidates[0].content.parts[0].text;
  }
}

class GeneralAssistant extends Assistant {
  constructor() {
    super("gemini-2.5-flash", PROMPTS.GENERAL);
  }

  async execute(message) {
    const response = await this.message(message);
    console.log("Cargando respuesta from this bro");
    return response.candidates[0].content.parts[0].text;
  }
}

class OrquestadorAssistant extends Assistant {
  constructor() {
    super("gemini-2.5-flash", PROMPTS.ORQUESTADOR, [
      routeToAssistantFunctionDeclaration,
    ]);
  }

  async execute(message) {
    const response = await this.message(message);
    console.log("Cargando respuesta from this bro orques");
    console.log("entre?\n\n\n\n\n");
    //Aqui debo sacar lo de functionCalls por includes
    return response;
  }
}

const assistant = {
  general: new GeneralAssistant(),
};

class Orquestador {
  orquestador;
  assistant;
  constructor() {
    this.orquestador = new OrquestadorAssistant();
  }

  async execute(message) {
    let response = await this.orquestador.execute(message);
    console.log(response.candidates);
    console.log(response.candidates[0].content.parts);
    if (
      response.candidates[0].content.parts.some((obj) => "functionCall" in obj)
    ) {
      let message;
      response.candidates[0].content.parts
        .filter((obj) => "functionCall" in obj)
        .map((obj) => {
          const callFunction = obj.functionCall;
          console.log(callFunction);
          this.assistant =
            assistant[callFunction.args.assistant_name.toLowerCase()];
          message = callFunction.args.instruction_xml;
        });
      response = await this.assistant.execute(message);
    }

    return response;
  }
}

module.exports = { handleGeminiConnection };
