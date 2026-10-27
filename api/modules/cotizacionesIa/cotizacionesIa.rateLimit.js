// Limitador de peticiones en memoria, por IP, para el POST público de cotizaciones.
// bacl no trae express-rate-limit y no se instalan dependencias nuevas.
//
// Limitación conocida: el contador vive en la memoria de cada instancia. En Vercel
// (serverless) cada instancia cuenta por separado, así que es un freno de abuso
// "mejor esfuerzo", no un límite exacto.

const DEFAULTS = {
  windowMs: 10 * 60 * 1000,
  max: 20,
  maxKeys: 10000,
  cleanupIntervalMs: 60 * 1000,
};

const MESSAGE = "Demasiadas solicitudes de cotización. Intenta de nuevo en unos minutos";

// Detrás de un proxy (Vercel) la IP real viene en x-forwarded-for.
const clientIp = (req) => {
  const forwarded = req.headers?.["x-forwarded-for"];
  const first = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return first || req.ip || req.socket?.remoteAddress || "unknown";
};

/**
 * @param {{ windowMs?: number, max?: number, maxKeys?: number, cleanupIntervalMs?: number,
 *           now?: () => number, keyGenerator?: (req: object) => string }} [options]
 */
const createRateLimiter = (options = {}) => {
  const { windowMs, max, maxKeys, cleanupIntervalMs } = { ...DEFAULTS, ...options };
  const now = options.now ?? Date.now;
  const keyGenerator = options.keyGenerator ?? clientIp;
  const hits = new Map(); // ip -> { count, resetAt }

  const purgeExpired = () => {
    const current = now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= current) hits.delete(key);
    }
  };

  // unref: el temporizador no mantiene vivo el proceso.
  const timer = setInterval(purgeExpired, cleanupIntervalMs);
  if (typeof timer.unref === "function") timer.unref();

  const middleware = (req, res, next) => {
    const key = keyGenerator(req);
    const current = now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= current) {
      // Tope de claves: ante una avalancha de IPs distintas la tabla no crece sin límite.
      if (!entry && hits.size >= maxKeys) {
        purgeExpired();
        if (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
      }
      entry = { count: 0, resetAt: current + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    res.set("X-RateLimit-Limit", String(max));
    res.set("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - current) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message: MESSAGE,
        data: null,
        error: { code: "RATE_LIMITED", message: MESSAGE, details: { retryAfterSeconds } },
      });
    }
    return next();
  };

  middleware.reset = () => hits.clear();
  middleware.stop = () => clearInterval(timer);
  return middleware;
};

module.exports = { createRateLimiter, clientIp, DEFAULTS };
