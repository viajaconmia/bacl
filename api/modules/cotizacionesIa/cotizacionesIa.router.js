const router = require("express").Router();
const { verificarPermiso } = require("../../../middleware/verifyPermission");
const {
  create,
  getAll,
  getById,
  getArchivoUrl,
  getArchivoUrlPorStoragePath,
} = require("./cotizacionesIa.controller");
const { createRateLimiter } = require("./cotizacionesIa.rateLimit");

// El POST es público (solo x-api-key, que viaja en el front): se limita por IP.
const limitCreate = createRateLimiter();
// Abrir un archivo ya subido (antes de confirmar la cotización) es más frecuente
// que crear una cotización (el cliente puede verlo varias veces); límite más holgado.
const limitArchivoUrl = createRateLimiter({ max: 60 });

// MIA (cliente): crea la cotización. Solo requiere x-api-key, igual que el resto de /v2.
router.post("/", limitCreate, create);

// MIA (cliente): URL firmada de un archivo que ya subió en el chat, antes de confirmar
// (ownership por prefijo de storage_path, igual que al crear). Nunca choca con /:id
// porque tiene 2 segmentos fijos.
router.get("/archivos/url", limitArchivoUrl, getArchivoUrlPorStoragePath);

// Admin (PATY / Operaciones): solo lectura, con sesión admin y permiso `view.cotizaciones_ia`.
router.get("/", verificarPermiso("view.cotizaciones_ia"), getAll);
router.get("/:id", verificarPermiso("view.cotizaciones_ia"), getById);
router.get(
  "/:id/archivos/:idArchivo",
  verificarPermiso("view.cotizaciones_ia"),
  getArchivoUrl,
);

// Expuesto para poder reiniciar el contador en pruebas.
router.limitCreate = limitCreate;

module.exports = router;
