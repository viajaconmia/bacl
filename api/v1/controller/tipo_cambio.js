const memoryCache = new Map();

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

const SERIES_MAP = {
  USD: "SF43718",
  EUR: "SF46410",
  JPY: "SF46406",
  GBP: "SF46407",
  CAD: "SF60632",
};

const normalizeCurrency = (value) =>
  String(value ?? "").trim().toUpperCase();

const isMXNCurrency = (value) => {
  const c = normalizeCurrency(value);
  return ["MXN", "MN", "MXP", "PESO", "PESOS"].includes(c);
};

const toBanxicoDate = (value) => {
  const d = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (value, days) => {
  const d = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d;
};

const parseRate = (value) => {
  const str = String(value ?? "").replace(/,/g, "").trim();
  const n = Number(str);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const extractLastValidRate = (json) => {
  const datos = json?.bmx?.series?.[0]?.datos;
  if (!Array.isArray(datos)) return null;

  const valid = datos
    .map((x) => ({
      fecha: x?.fecha ?? null,
      rate: parseRate(x?.dato),
    }))
    .filter((x) => x.rate !== null);

  if (!valid.length) return null;
  return valid[valid.length - 1];
};

const fetchBanxico = async (url, token) => {
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "Bmx-Token": token,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(text || `Banxico respondió ${resp.status}`);
  }

  return resp.json();
};

const TipoCambio = async (req, res) => {
  try {
    const currency = normalizeCurrency(req.query.currency);
    const date = req.query.date ? String(req.query.date).trim() : "";

    console.log("[tipo-cambio] currency:", currency);
    console.log("[tipo-cambio] date:", date || "latest");

    if (!currency) {
      return res.status(400).json({
        ok: false,
        error: "Falta currency",
      });
    }

    if (isMXNCurrency(currency)) {
      return res.status(200).json({
        ok: true,
        currency: "MXN",
        rate: 1,
        source: "identity",
      });
    }

    const seriesId = SERIES_MAP[currency];
    if (!seriesId) {
      return res.status(400).json({
        ok: false,
        error: `Moneda no soportada por Banxico: ${currency}`,
      });
    }

    const token = process.env.BANXICO_TOKEN;
    if (!token) {
      return res.status(500).json({
        ok: false,
        error: "Falta configurar BANXICO_TOKEN en el servidor",
      });
    }

    const cacheKey = `${currency}:${date || "latest"}`;
    const now = Date.now();

    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      console.log("[tipo-cambio] usando cache:", cached.payload);
      return res.status(200).json(cached.payload);
    }

    let payload;

    if (date) {
      const end = toBanxicoDate(date);
      const start = toBanxicoDate(addDays(date, -7));

      if (!start || !end) {
        return res.status(400).json({
          ok: false,
          error: "Fecha inválida",
        });
      }

      const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${seriesId}/datos/${start}/${end}?mediaType=json`;
      console.log("[tipo-cambio] url:", url);

      const json = await fetchBanxico(url, token);
      const lastValid = extractLastValidRate(json);

      if (!lastValid) {
        return res.status(404).json({
          ok: false,
          error: `No hubo tipo de cambio disponible para ${currency}`,
        });
      }

      payload = {
        ok: true,
        currency,
        rate: Number(lastValid.rate),
        source: "banxico",
        requestedDate: date,
        appliedDate: lastValid.fecha,
      };
    } else {
      const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${seriesId}/datos/oportuno?mediaType=json`;
      console.log("[tipo-cambio] url:", url);

      const json = await fetchBanxico(url, token);
      const lastValid = extractLastValidRate(json);

      if (!lastValid) {
        return res.status(404).json({
          ok: false,
          error: `No hubo tipo de cambio oportuno para ${currency}`,
        });
      }

      payload = {
        ok: true,
        currency,
        rate: Number(lastValid.rate),
        source: "banxico",
        appliedDate: lastValid.fecha,
      };
    }

    console.log("[tipo-cambio] payload:", payload);

    memoryCache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      payload,
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Error en TipoCambio:", error);
    return res.status(500).json({
      ok: false,
      error: "Error en el servidor",
      details: error?.message ?? error,
    });
  }
};

module.exports = {
  TipoCambio,
};