// Construidas con fromCharCode (no como literales de regex) para evitar
// incrustar caracteres invisibles/de combinación directo en el código fuente.
const ZERO_WIDTH_RE = new RegExp(
  "[" + String.fromCharCode(0x200b, 0x200c, 0x200d, 0xfeff) + "]",
  "g",
);
const ACCENTS_RE = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g",
);

// Normaliza: minúsculas, sin acentos, sin dobles espacios, etc.
function normalizeEstado(s) {
  return String(s ?? "")
    .replace(ZERO_WIDTH_RE, "") // quita zero-width
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(ACCENTS_RE, "") // quita acentos
    .replace(/\s+/g, " ");
}

const CLAVE_ESTADOS = {
  aguascalientes: "AGS",
  "distrito federal": "CDMX",
  df: "CDMX",

  "baja california": "BC",
  "baja california norte": "BC",
  "baja california sur": "BCS",
  campeche: "CAMP",
  chiapas: "CHIS",
  chihuahua: "CHIH",
  "ciudad de mexico": "CDMX",
  cdmx: "CDMX",
  coahuila: "COAH",
  colima: "COL",
  durango: "DGO",
  guanajuato: "GTO",
  guerrero: "GRO",
  hidalgo: "HGO",
  jalisco: "JAL",
  mexico: "EDO MEXD",
  "estado de mexico": "EDO MEXD",
  michoacan: "MICH",
  morelos: "MOR",
  nayarit: "NAY",
  "nuevo leon": "NL",
  oaxaca: "OAX",
  puebla: "PUE",
  queretaro: "QRO",
  "quintana roo": "Q ROOF",
  "san luis potosi": "SLP",
  sinaloa: "SIN",
  sonora: "SON",
  tabasco: "TAB",
  tamaulipas: "TAMPS",
  tlaxcala: "TLAX",
  veracruz: "VER",
  yucatan: "YUC",
  zacatecas: "ZAC",
};

// Si ya viene como clave, la deja; si viene como nombre, la convierte
const VALID_KEYS = new Set([
  "AGS",
  "BC",
  "BCS",
  "CAMP",
  "CHIS",
  "CHIH",
  "CDMX",
  "COAH",
  "COL",
  "DGO",
  "GTO",
  "GRO",
  "HGO",
  "JAL",
  "EDO MEXD",
  "MICH",
  "MOR",
  "NAY",
  "NL",
  "OAX",
  "PUE",
  "QRO",
  "Q ROOF",
  "SLP",
  "SIN",
  "SON",
  "TAB",
  "TAMPS",
  "TLAX",
  "VER",
  "YUC",
  "ZAC",
]);

function mapEstadoToClave(estado_reserva) {
  const raw = String(estado_reserva ?? "")
    .replace(ZERO_WIDTH_RE, "")
    .trim();
  if (!raw) return raw;

  if (VALID_KEYS.has(raw)) return raw; // ya es clave exacta
  const norm = normalizeEstado(raw);
  return CLAVE_ESTADOS[norm] ?? raw; // si no encuentra, deja lo original
}

function getEstadoClaveFromLocation(locationStr) {
  const raw = String(locationStr ?? "")
    .replace(ZERO_WIDTH_RE, "")
    .trim();

  if (!raw) return raw;

  // Quita paréntesis para parsear comas sin ruido
  const noParen = raw.replace(/\s*\([^)]*\)\s*/g, "").trim();

  // Split por comas: "Ciudad, Estado, País"
  const parts = noParen
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // 1) Caso normal: "Ciudad, Estado, Mexico ..."
  if (parts.length >= 2) {
    return mapEstadoToClave(parts[1]); // <- Estado (2º segmento)
  }

  // 2) Si no hay comas (ej. solo nombre aeropuerto), intenta inferir por IATA
  // Formato típico: "(MEX/MMMX ...)" o "(NLU/MMSM)"
  const iata = (raw.match(/\(([A-Z]{3})\//) || [])[1];

  // Mapea IATA -> CLAVE_ESTADO (pon aquí los que uses más)
  const AIRPORT_STATE_BY_IATA = {
    MEX: "CDMX",
    NLU: "EDO MEXD",
    MTY: "NL",
    QRO: "QRO",
    GDL: "JAL",
    CUN: "Q ROOF",
    TIJ: "BC",
    SJD: "BCS",
    PVR: "JAL",
  };

  if (iata && AIRPORT_STATE_BY_IATA[iata]) return AIRPORT_STATE_BY_IATA[iata];

  // 3) Último fallback: intenta mapear usando TODO el texto (si trae algo tipo "Nuevo Leon")
  // (Evita agarrar "Mexico" país: mapEstadoToClave solo convierte si coincide con un estado)
  return mapEstadoToClave(noParen);
}

function getCodigoConfirmacionBase(codigo_confirmacion) {
  const raw = String(codigo_confirmacion ?? "")
    .replace(ZERO_WIDTH_RE, "")
    .trim();

  if (!raw) return raw;

  // Solo aplica si empieza con HJK (case-insensitive). Si no, lo deja igual.
  if (/^HJK/i.test(raw)) {
    // "HJK11497-YH58PG" -> "HJK11497"
    return raw.split("-")[0].trim();
  }

  return raw;
}

function toYMD(value) {
  if (value === undefined || value === null) return value;

  // Si MySQL/driver lo da como Date
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const mo = String(value.getUTCMonth() + 1).padStart(2, "0");
    const da = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }

  const raw = String(value).trim();
  if (!raw) return raw;

  // "2026-02-27T06:00:00.000Z" -> "2026-02-27"
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

module.exports = {
  mapEstadoToClave,
  getEstadoClaveFromLocation,
  getCodigoConfirmacionBase,
  toYMD,
};
