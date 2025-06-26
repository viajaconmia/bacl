// src/middleware/requestContext.js
const { v4: uuidv4 } = require("uuid");

/**
 * Middleware de trazabilidad simple: genera un requestId y captura errores en consola.
 * Uso:
 *   app.use(requestContext);
 * Luego en controllers: req.context.logStep('mensaje');
 */
const requestContext = (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  req.context = {
    requestId,
    trace: [`[${requestId}] START ${req.method} ${req.originalUrl}`],
    logStep: (...stepName) => {
      const timestamp = new Date().toISOString();
      req.context.trace.push(
        `[${requestId}] ${timestamp} -> ${stepName
          .map((item) => JSON.stringify(item))
          .join(" ")}`
      );
    },
  };

  // Al finalizar la respuesta, si fue un error, mostramos la traza y el resumen
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      console.error(
        `🔴 TRACE DE ERROR - ${req.method} ${req.originalUrl} (${res.statusCode})`
      );
      // Trazas detalladas
      req.context.trace.forEach((line) => console.error(line));
      // Resumen al estilo Morgan 'dev'
      const duration = (Date.now() - startTime).toFixed(3);
      const length = res.getHeader("Content-Length") || "-";
      console.error(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration} ms - ${length}`
      );
    }
  });

  next();
};

module.exports = requestContext;
