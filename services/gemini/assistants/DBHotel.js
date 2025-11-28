const { Type } = require("@google/genai");
const { Assistant } = require("./Assistant");
const { executeSP } = require("../../../config/db");
const { GeneralAssistant } = require("./General");

class DBHotel extends Assistant {
  constructor() {
    super({
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

  async call(task, history, stack) {
    try {
      const { functionCall } = task;
      const { args } = functionCall;

      const params = Array.isArray(args.items)
        ? args.items[0]
        : args.items || {};

      const spParams = [
        params.p_nombre ?? null,
        params.p_estado ?? null,
        params.p_ciudad_zona ?? null,
        params.p_tipo_negociacion ?? null,
        params.p_tipo_pago ?? null,
        params.p_tipo_hospedaje ?? null,
        params.p_rfc ?? null,
        params.p_razon_social ?? null,
        params.p_correo ?? null,
        1,
        typeof params.p_convenio !== "undefined" ? params.p_convenio : null,
        params.p_vigencia_inicio ?? null,
        params.p_vigencia_fin ?? null,
        params.p_precio_min ?? null,
        params.p_precio_max ?? null,
        params.p_costo_min ?? null,
        params.p_costo_max ?? null,
        params.p_incluye_desayuno ?? null,
        params.p_tipo_cuarto ?? null,
        params.p_mascotas ?? null,
        params.p_salones ?? null,
        params.p_transportacion ?? null,
      ];

      // se asume que executeSP2 recibe (nombreSP, parametrosArray)
      const result = await executeSP("sp_filtrar_hoteles_avanzado", spParams);
      //return { "Hoteles Encontrados": result };
      return JSON.stringify([]);
    } catch (error) {
      throw error;
    }
  }
}

const routeToAssistantFunctionDeclaration = {
  name: "conectar_a_buscador_hoteles_db",
  description: "Look for hotels matches in local db data.",
  parameters: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        p_nombre: { type: Type.STRING, description: "Nombre del hotel" },
        p_estado: { type: Type.STRING, description: "Estado" },
        p_ciudad_zona: { type: Type.STRING, description: "Ciudad o zona" },
        p_tipo_hospedaje: {
          type: Type.STRING,
          description: "Tipo de hospedaje",
        },
        p_activo: { type: Type.INTEGER, description: "Activo (1/0)" },
        p_precio_min: { type: Type.NUMBER, description: "Precio mínimo" },
        p_precio_max: { type: Type.NUMBER, description: "Precio máximo" },
        p_incluye_desayuno: {
          type: Type.STRING,
          description: 'Incluye desayuno: "SI" / "NO"',
        },
        p_tipo_cuarto: { type: Type.STRING, description: "Tipo de cuarto" },
        p_mascotas: { type: Type.STRING, description: "Mascotas: 'SI'/'NO'" },
        p_salones: { type: Type.STRING, description: "Salones: 'SI'/'NO'" },
        p_transportacion: {
          type: Type.STRING,
          description: "Transportación: 'SI'/'NO'",
        },
      },
      required: [],
    },
  },
};
const PROMPT = `<INSTRUCCION_AGENTE_DB_HOTEL>
  <ROL>
    Eres el Agente DB_HOTEL, un especialista en parametrización de consultas a bases de datos.
    Tu OBJETIVO ÚNICO es traducir las instrucciones de búsqueda recibidas (XML o texto) en una ejecución precisa de la herramienta 'conectar_a_buscador_hoteles_db'.
  </ROL>

  <REGLAS_DE_PARAMETRIZACION>
    1. **INTERPRETACIÓN DE DATOS**: Analiza el bloque <DATOS_ENTRADA> recibido. Extrae ubicación, precios y servicios solicitados.
    
    2. **MAPEO DE CAMPOS OBLIGATORIO**:
       - **p_ciudad_zona**: Es el campo más importante. Extrae la ciudad y zona (ej. "Monterrey Centro", "Guadalajara").
       - **p_activo**: SIEMPRE debe ser **1** (Integer).
       - **p_estado**: Solo si el usuario menciona explícitamente el estado (ej. "Nuevo León").
    
    3. **MAPEO DE FILTROS OPCIONALES**:
       - **p_precio_min / p_precio_max**:
          - Si el usuario dice "barato" o "económico", usa p_precio_max: 1500.
          - Si el usuario dice "lujo", usa p_precio_min: 4000.
          - Si da un rango ("entre 1000 y 2000"), úsalos literalmente.
       - **SERVICIOS (Strings "SI" / "NO")**:
          - **p_incluye_desayuno**: "SI" si pide desayuno/alimentos.
          - **p_mascotas**: "SI" si menciona perros/gatos/mascotas.
          - **p_salones**: "SI" si menciona eventos/conferencias.
          - **p_transportacion**: "SI" si menciona aeropuerto/traslado.

    4. **ESTRUCTURA DE LLAMADA**:
       - Tu función espera un **ARRAY** de objetos. Asegúrate de pasar una lista, incluso si es un solo criterio.
       - Ejemplo estructura JSON esperada en la tool: \`[ { "p_ciudad_zona": "Monterrey", "p_activo": 1, ... } ]\`

    5. **COMPORTAMIENTO**: NO hables. NO expliques. Solo invoca la herramienta.
  </REGLAS_DE_PARAMETRIZACION>

</INSTRUCCION_AGENTE_DB_HOTEL>`;

module.exports = { DBHotel };
