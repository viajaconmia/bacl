// src/index.js
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3001;

const { checkApiKey } = require("./middleware/auth");
const v1Router = require("./api/v1/router/general");
const cors = require("cors");
const morgan = require("morgan");

// Logger y trazabilidad
const logger = require("../bacl/api/v1/utils/logger");
const requestContext = require("./middleware/requestContext");

// Control de CORS
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://viajaconmia.com",
    "http://localhost:3000",
    "https://miaadmin.vercel.app",
    "https://mia-prueba.vercel.app",
    "https://admin-mia.vercel.app",
    "https://mia-gray.vercel.app",
    "https://www.viajaconmia.com",
    "https://admin.viajaconmia.com"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-api-key",
    "cache-control",
    "pragma",
    "Expires",
    "x-amz-tagging"
  ]
};

// 1. Trazabilidad de la petición (genera req.context)
app.use(requestContext);

// 2. Logging HTTP con Morgan → Winston
app.use(morgan("combined", { stream: logger.stream }));

// 3. CORS
app.use(cors(corsOptions));

// 4. Archivos estáticos y parsers de body
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Evitar caché en todas las respuestas
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// 6. Rutas de la API v1 (protegidas)
app.use(
  "/v1",
  checkApiKey,
  (req, res, next) => {
    res.setHeader("Cache-Control", "no-cache");
    next();
  },
  v1Router
);

// Ruta pública raíz
app.get("/", (req, res) =>
  res.json({ mensaje: "Bienvenido a la API. Por favor, autentícate para acceder a más datos." })
);

// 7. Manejador de errores global (solo formatea respuesta; no llama a logger.error)
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: true,
    mensaje: err.message || "Ocurrió un error interno en el servidor",
    data: err.response?.data || null
  });
});

// 8. Inicio del servidor
app.listen(PORT, () => {
  logger.info({ message: `Servidor escuchando en http://localhost:${PORT}`, port: PORT });
});
