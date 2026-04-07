const { handleChat } = require("./services/gemini/Core");
// src/index.js
const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const PORT = process.env.PORT || 3001;
const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("./lib/constant/index");
/**de aqui para abajo */
require("dotenv").config();
// const jwt = require("jsonwebtoken");
// const { SECRET_KEY } = require("./lib/constant");
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

const { checkApiKey } = require("./middleware/auth");
const v1Router = require("./api/v1/router/general");
const cors = require("cors");
const morgan = require("morgan");

const logger = require("./api/v1/utils/logger");
const requestContext = require("./middleware/requestContext");
// const {
//   createContact,
//   getContacts,
//   getByEmail,
// } = require("./services/zoho/contacts");
// const { DEPARTMENTS } = require("./lib/constant");
// const { subirTicketSolicitudZoho } = require("./services/zoho");
// const {
//   generarYSubirImagenHotel,
//   generarImagenHotel,
// } = require("./api/v1/utils/generarImagenCotizacion");
const { executeQuery } = require("./config/db");
const { generarPDFHotel } = require("./api/v1/utils/generarImagenCotizacion");
const { check } = require("zod");
const { getLatLngFromCP } = require("./lib/utils/geo");

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
  // console.log(req.session);
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
  v1Router,
);

app.get("/probando", async (req, res) => {
  try {
    const {
      ciudad,
      hotel,
      cp,
      lat,
      lng,
      iteracion = 0,
      checkin,
      checkout,
    } = req.query;
    console.log(req.query);

    const where = [];
    const params = [];

    let orderBy = "vw.precio_sencilla ASC";

    // =========================
    // 🏨 BUSQUEDA POR NOMBRE
    // =========================
    if (hotel) {
      where.push(`
        (
          vw.nombre LIKE CONCAT('%', ?, '%')
          OR chp.zona = (
            SELECT zona
            FROM client_hotel_priority chp2
            INNER JOIN hoteles h2 ON h2.id_hotel = chp2.id_hotel
            WHERE h2.nombre LIKE CONCAT('%', ?, '%')
            LIMIT 1
          )
        )
      `);
      params.push(hotel, hotel);

      orderBy = `
        CASE 
          WHEN vw.nombre LIKE CONCAT('%', ?, '%') THEN 0
          ELSE 1 
        END,
        vw.precio_sencilla ASC
      `;
      params.push(hotel);
    }

    // =========================
    // 📍 CP → LAT/LNG
    // =========================
    let latFinal = lat;
    let lngFinal = lng;

    if (cp && (!lat || !lng)) {
      const coords = await getLatLngFromCP(cp);
      if (coords) {
        latFinal = coords.lat;
        lngFinal = coords.lng;
      }
    }

    // =========================
    // 📏 ORDEN POR DISTANCIA
    // =========================
    if (latFinal && lngFinal) {
      orderBy = `
        ST_Distance_Sphere(
          h.ubicacion,
          ST_SRID(POINT(${Number(lngFinal)}, ${Number(latFinal)}), 4326)
        ) ASC
      `;
    }

    // =========================
    // 🗺 FILTRO POR ZONA (chp)
    // =========================
    if (ciudad) {
      where.push(`chp.zona LIKE ?`);
      params.push(`%${ciudad.toUpperCase().split(" ").join("%")}%`);

      if (!latFinal && !lngFinal && !hotel) {
        orderBy = `chp.priority ASC`;
      }
    }

    const whereSQL = where.length ? `WHERE ${where.join(" OR ")}` : "";

    // =========================
    // 🔥 QUERY FINAL
    // =========================
    const query = `
      SELECT
        vw.id_hotel as id,
        vw.nombre AS hotel,
        vw.precio_sencilla AS total,
        ROUND(vw.precio_sencilla /1.16,2) AS subtotal,
        IF(vw.desayuno_sencilla = 1, 1, 0) AS desayuno,
        vw.direccion,
        chp.zona,
        chp.priority,
        ${
          latFinal && lngFinal
            ? `ST_Distance_Sphere(
                h.ubicacion,
                ST_SRID(POINT(?, ?), 4326)
              ) AS distancia`
            : `NULL AS distancia`
        }
      FROM vw_hoteles_tarifas_completa vw
      INNER JOIN client_hotel_priority chp 
        ON chp.id_hotel = vw.id_hotel
      INNER JOIN hoteles h 
        ON h.id_hotel = vw.id_hotel
      ${whereSQL}
      ORDER BY ${orderBy}
      LIMIT 20
    `;

    const finalParams = [
      ...(latFinal && lngFinal ? [Number(lngFinal), Number(latFinal)] : []),
      ...params,
    ];

    const response = await executeQuery(query, finalParams);
    console.log(query, finalParams);

    if (!response[iteracion]) {
      return res.status(404).json({
        message: "no encontramos esta iteracion",
        error: null,
      });
    }

    const buffer = await generarPDFHotel({
      ...response[iteracion],
      checkin,
      checkout,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=hotel${iteracion}.pdf`,
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Error creando PDF:", error);
    return res.status(500).json({
      message: "Error creando PDF",
      error,
    });
  }
});

// Ruta pública raíz
app.get("/", (req, res) =>
  res.json({
    mensaje:
      "Bienvenido a la API. Por favor, autentícate para acceder a más datos.",
  }),
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
