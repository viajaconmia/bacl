const { Assistant } = require("./Assistant");

const SCHEMA = {
  type: "object",
  properties: {
    checkin: { type: "string" },
    checkout: { type: "string" },
    hoteles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          precio_por_noche: { type: "string" },
          moneda: { type: "string", enum: ["MXN", "USD"] },
          fuente: { type: "string" },
        },
        required: ["nombre", "precio_por_noche", "moneda", "fuente"],
      },
    },
  },
  required: ["checkin", "checkout", "hoteles"],
};

const PROMPT = `Eres un agente especializado en buscar precios de hoteles en internet.

Recibirás una lista de nombres de hoteles junto con fechas de check-in y check-out. Tu única tarea es usar Google Search para encontrar el precio por noche o por estancia de cada hotel en esas fechas, buscando en sitios como Expedia, Booking.com, Hotels.com o el sitio oficial del hotel.

REGLAS:
- Busca el precio real y actual de cada hotel para las fechas indicadas.
- Si no encuentras precio exacto, indica el rango aproximado encontrado.
- Si no encuentras ningún precio para un hotel, usa "no disponible" en precio_por_noche.
- Los precios deben ser numéricos o el texto "no disponible".
- La moneda puede ser MXN o USD según lo que encuentres.`;

class SearchHotelStructured extends Assistant {
  constructor() {
    super({
      instrucciones: PROMPT,
      dependencias: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
      },
      name: "search_hotel_structured",
    });
  }

  async execute(message, history) {
    const response = await this.message(message, history);
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    try {
      return JSON.parse(text);
    } catch {
      return { error: "No se pudo parsear la respuesta", raw: text };
    }
  }
}

module.exports = { SearchHotelStructured };
