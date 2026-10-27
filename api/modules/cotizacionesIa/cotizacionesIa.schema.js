const { z } = require("zod");

const TIPOS = ["flight", "car_rental", "hotel", "bus"];
const ESTADOS = ["nueva", "en_proceso", "cotizada", "cerrada", "cancelada"];
const ORIGENES_ENTRADA = ["texto", "pdf", "imagen", "csv", "excel", "mixto"];

// Las cotizaciones NO llevan precios: los pone Operaciones. Se rechaza cualquier
// clave de monto, en cualquier nivel del body, aunque el modelo la haya inventado.
const PRICE_KEY = /^(price|prices|precio|precios|total|subtotal|amount|monto|costo|cost|tarifa|importe)$/i;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidDate = (value) => {
  if (!DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

// Mismo saneo con el que mia_ai arma la ruta del original
// (mia_ai/src/repositories/quote-storage.repository.ts): `<userId>/<sessionId>/<uuid>-<archivo>`.
// Si cambia allá, debe cambiar aquí.
const safeSegment = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/\.{2,}/g, ".")
    .slice(-80) || "x";

const storagePrefixFor = (idUsuario) => `${safeSegment(idUsuario)}/`;

// Zod devuelve sus mensajes por defecto en inglés. El front los muestra tal cual,
// así que se traducen aquí. Los mensajes propios (ya en español) pasan sin tocar.
const ZOD_DEFAULT_MESSAGE = /^(Invalid|Too (big|small)|Unrecognized|Expected)/;
const EXPECTED_LABEL = {
  string: "texto",
  number: "número",
  int: "número entero",
  boolean: "verdadero o falso",
  array: "lista",
  object: "objeto",
};

const translateIssue = (issue) => {
  if (!ZOD_DEFAULT_MESSAGE.test(issue.message)) return issue.message;
  switch (issue.code) {
    case "invalid_type":
      return /received undefined/.test(issue.message)
        ? "Es requerido"
        : `Tipo de dato inválido, se esperaba ${EXPECTED_LABEL[issue.expected] ?? issue.expected}`;
    case "too_small":
      if (issue.origin === "string") {
        return issue.minimum <= 1
          ? "No puede estar vacío"
          : `Debe tener al menos ${issue.minimum} caracteres`;
      }
      if (issue.origin === "array") {
        return `Debe tener al menos ${issue.minimum} elemento${issue.minimum === 1 ? "" : "s"}`;
      }
      return `Debe ser mayor o igual a ${issue.minimum}`;
    case "too_big":
      if (issue.origin === "string") return `Máximo ${issue.maximum} caracteres`;
      if (issue.origin === "array") {
        return `Máximo ${issue.maximum} elemento${issue.maximum === 1 ? "" : "s"}`;
      }
      return `Debe ser menor o igual a ${issue.maximum}`;
    case "invalid_value":
      return `Valor no permitido. Opciones: ${(issue.values ?? []).join(", ")}`;
    case "invalid_union":
      return `Tipo de servicio no permitido. Opciones: ${TIPOS.join(", ")}`;
    default:
      return "Valor inválido";
  }
};

const str = (max) => z.string().trim().max(max).optional();
const dateStr = z
  .string()
  .refine(isValidDate, { message: "Fecha inválida, usa YYYY-MM-DD" })
  .optional();
const timeStr = z
  .string()
  .regex(TIME, { message: "Hora inválida, usa HH:mm" })
  .optional();
const intRange = (min, max) => z.number().int().min(min).max(max).optional();

const base = {
  id: z.string().trim().min(1).max(64),
  travelers: intRange(1, 100),
  travelerNames: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
  notes: str(1000),
};

const FlightItem = z.object({
  ...base,
  type: z.literal("flight"),
  tripType: z.enum(["oneway", "roundtrip", "multicity"]).optional(),
  origin: str(120),
  destination: str(120),
  departureDate: dateStr,
  returnDate: dateStr,
  airline: str(80),
  cabin: str(40),
  flightNumber: str(20),
});

const CarRentalItem = z.object({
  ...base,
  type: z.literal("car_rental"),
  pickupLocation: str(160),
  dropoffLocation: str(160),
  pickupDate: dateStr,
  dropoffDate: dateStr,
  pickupTime: timeStr,
  dropoffTime: timeStr,
  carCategory: str(80),
  withDriver: z.boolean().optional(),
});

const HotelItem = z.object({
  ...base,
  type: z.literal("hotel"),
  city: str(120),
  hotelName: str(160),
  checkIn: dateStr,
  checkOut: dateStr,
  rooms: intRange(1, 50),
  roomType: str(80),
  guests: intRange(1, 200),
});

const BusItem = z.object({
  ...base,
  type: z.literal("bus"),
  origin: str(120),
  destination: str(120),
  departureDate: dateStr,
  returnDate: dateStr,
  busLine: str(80),
  serviceClass: str(60),
});

const ItemSchema = z.discriminatedUnion("type", [
  FlightItem,
  CarRentalItem,
  HotelItem,
  BusItem,
]);

const ArchivoSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(100),
  size: z.number().int().min(0).max(50 * 1024 * 1024),
  storage_path: z
    .string()
    .trim()
    .max(500)
    .refine((p) => !p.includes("..") && !p.startsWith("/"), {
      message: "storage_path inválido",
    })
    .nullable()
    .optional(),
});

const CotizacionSchema = z.object({
  id_usuario: z.string().trim().min(1).max(64),
  id_agente: z.string().trim().max(64).nullable().optional(),
  solicitante_nombre: z.string().trim().max(255).nullable().optional(),
  solicitante_correo: z
    .string()
    .trim()
    .max(255)
    .regex(EMAIL, { message: "Correo inválido" })
    .nullable()
    .optional(),
  origen_entrada: z.enum(ORIGENES_ENTRADA),
  resumen: z.string().trim().min(1).max(2000),
  notas: z.string().trim().max(2000).nullable().optional(),
  items: z.array(ItemSchema).min(1).max(20),
  archivos: z.array(ArchivoSchema).max(10).default([]),
}).superRefine((body, ctx) => {
  // Cada original debe estar bajo la carpeta del propio usuario: evita registrar rutas
  // de otro usuario (la x-api-key viaja en el front, id_usuario es declarativo).
  const prefix = storagePrefixFor(body.id_usuario);
  body.archivos.forEach((archivo, index) => {
    if (archivo.storage_path && !archivo.storage_path.startsWith(prefix)) {
      ctx.addIssue({
        code: "custom",
        path: ["archivos", index, "storage_path"],
        message: "storage_path inválido: el archivo no pertenece a este usuario",
      });
    }
  });
});

// Campos mínimos para que Operaciones pueda cotizar (mismos que bloquea el front).
const REQUIRED_BY_TYPE = {
  flight: [
    ["origin", "Origen"],
    ["destination", "Destino"],
    ["departureDate", "Fecha de salida"],
  ],
  car_rental: [
    ["pickupLocation", "Lugar de recogida"],
    ["pickupDate", "Fecha de recogida"],
    ["dropoffDate", "Fecha de devolución"],
  ],
  hotel: [
    ["checkIn", "Check-in"],
    ["checkOut", "Check-out"],
  ],
  bus: [
    ["origin", "Origen"],
    ["destination", "Destino"],
    ["departureDate", "Fecha de salida"],
  ],
};

// Pares [inicio, fin] que deben respetar fin >= inicio.
const DATE_ORDER = {
  flight: [["departureDate", "returnDate"]],
  car_rental: [["pickupDate", "dropoffDate"]],
  hotel: [["checkIn", "checkOut"]],
  bus: [["departureDate", "returnDate"]],
};

/**
 * Busca claves de precio en cualquier nivel.
 * @returns {string[]} rutas (ej. "items.0.price") de las claves prohibidas encontradas
 */
const findPriceKeys = (value, path = []) => {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findPriceKeys(item, [...path, i]));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, val]) => {
      const here = [...path, key];
      return PRICE_KEY.test(key)
        ? [here.join("."), ...findPriceKeys(val, here)]
        : findPriceKeys(val, here);
    });
  }
  return [];
};

// El front/LLM manda null o "" para lo que no sabe: equivale a campo ausente.
const dropEmpty = (value) => {
  if (Array.isArray(value)) return value.map(dropEmpty);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null && v !== "")
        .map(([k, v]) => [k, dropEmpty(v)]),
    );
  }
  return value;
};

/**
 * Valida el body de creación.
 * @returns {{ ok: true, data: object } | { ok: false, issues: Array<{ path: string, message: string }> }}
 */
const validateCotizacion = (body) => {
  const priceKeys = findPriceKeys(body);
  if (priceKeys.length > 0) {
    return {
      ok: false,
      issues: priceKeys.map((path) => ({
        path,
        message: "Las cotizaciones no llevan precios: Operaciones los agrega",
      })),
    };
  }

  const parsed = CotizacionSchema.safeParse(dropEmpty(body));
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: translateIssue(issue),
      })),
    };
  }

  const issues = [];
  parsed.data.items.forEach((item, index) => {
    const at = (field) => `items.${index}.${field}`;
    (REQUIRED_BY_TYPE[item.type] || []).forEach(([field, label]) => {
      if (!item[field]) issues.push({ path: at(field), message: `${label} es requerido` });
    });
    if (item.type === "hotel" && !item.city && !item.hotelName) {
      issues.push({ path: at("city"), message: "Indica la ciudad o el nombre del hotel" });
    }
    (DATE_ORDER[item.type] || []).forEach(([from, to]) => {
      if (item[from] && item[to] && item[to] < item[from]) {
        issues.push({ path: at(to), message: "No puede ser anterior a la fecha de inicio" });
      }
    });
  });

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, data: parsed.data };
};

module.exports = {
  TIPOS,
  ESTADOS,
  ORIGENES_ENTRADA,
  PRICE_KEY,
  findPriceKeys,
  storagePrefixFor,
  validateCotizacion,
};
