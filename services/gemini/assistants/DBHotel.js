const { Type } = require("@google/genai");
const { Assistant } = require("./Assistant");
const { executeSP } = require("../../../config/db");

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
      return { "Hoteles Encontrados": result };
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

const PROMPT = `<INSTRUCCION_ASISTENTE_DB_HOTELES>`;

module.exports = { DBHotel };
