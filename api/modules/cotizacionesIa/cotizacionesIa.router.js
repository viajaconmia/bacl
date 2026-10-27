const router = require("express").Router();
const { verificarPermiso } = require("../../../middleware/verifyPermission");
const {
  create,
  getAll,
  getById,
  getArchivoUrl,
} = require("./cotizacionesIa.controller");
const { createRateLimiter } = require("./cotizacionesIa.rateLimit");

// El POST es público (solo x-api-key, que viaja en el front): se limita por IP.
const limitCreate = createRateLimiter();

// MIA (cliente): crea la cotización. Solo requiere x-api-key, igual que el resto de /v2.
router.post("/", limitCreate, create);

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
