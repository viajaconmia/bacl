const { handleChat } = require("./services/gemini/Core");
// src/index.js
const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const PORT = process.env.PORT || 3001;
const jwt = require("jsonwebtoken")
const {SECRET_KEY} = require("./lib/constant/index")
/**de aqui para abajo */
require("dotenv").config();
const { errorHandler } = require("./middleware/errorHandler");

// const Stripe = require("stripe");
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_TEST, {
//   apiVersion: "2024-04-10",
// });

// app.post("/disputa", express.raw({ type: "application/json" }), (req, res) => {
//   const sig = req.headers["stripe-signature"];
//   const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST;

//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
//   } catch (err) {
//     console.error("❌ Error verificando la firma del webhook:", err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   // ✅ Manejo del evento de disputa
//   if (event.type === "charge.dispute.created") {
//     const dispute = event.data.object;
//     console.log("\n\n\n\n\n🚨 Disputa recibida:", {
//       id: dispute.id,
//       amount: dispute.amount / 100,
//       currency: dispute.currency,
//       reason: dispute.reason,
//     });

//     // Aquí puedes guardar en base de datos, notificar a alguien, etc.
//   } else {
//     console.log(`📦 Evento recibido no manejado: ${event.type}`);
//   }

//   res.status(200).json({ received: true });
// });
// const { SECRET_KEY } = require("./lib/constant");
/** aqui*/

const { checkApiKey } = require("./middleware/auth");
const v1Router = require("./api/v1/router/general");
const cors = require("cors");
const morgan = require("morgan");

// Logger y trazabilidad
const logger = require("./api/v1/utils/logger");
const requestContext = require("./middleware/requestContext");

// Control de CORS
const corsOptions = {
  origin: [
    "https://viajaconmia.com",
    "https://miaadmin.vercel.app",
    "https://mia-prueba.vercel.app",
    "https://admin-mia.vercel.app",
    "https://mia-gray.vercel.app",
    "https://www.viajaconmia.com",
    "https://admin.viajaconmia.com",
    "https://mia-git-pruebasmia-mias-projects-f396ca8b.vercel.app",
    "https://admin-mia-git-pruebasadmin-mias-projects-f396ca8b.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-api-key",
    "cache-control",
    "pragma",
    "Expires",
    "x-amz-tagging",
  ],
  credentials: true,
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
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// 5. Evitar caché en todas las respuestas
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.use((req, res, next) => {
  const token = req.cookies["access-token"];
  req.session = { user: null };
  if (token) {
    try {
      const session = jwt.verify(token, SECRET_KEY);
      req.session.user = session;
    } catch (error) {
      console.log(error);
      if (error.message == "jwt expired")
        error.message = "sesion expirada, inicia sesión nuevamente";
      res
        .status(500)
        .clearCookie("access-token")
        .json({
          message: error.message || "Error al salir",
          error,
          data: null,
        });
      return;
    }
  }
  console.log(req.session);
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
  res.json({
    mensaje:
      "Bienvenido a la API. Por favor, autentícate para acceder a más datos.",
  })
);

app.post("/message", handleChat);

// 7. Manejador de errores global (solo formatea respuesta; no llama a logger.error)
app.use(errorHandler);

// 8. Inicio del servidor
app.listen(PORT, () => {
  logger.info({
    message: `Servidor escuchando en http://localhost:${PORT}`,
    port: PORT,
  });
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
