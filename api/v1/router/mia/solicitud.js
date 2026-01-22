const controller = require("../../controller/solicitud");
const router = require("express").Router();
const middleware = require("../../middleware/validateParams");

router.post("/createFromCart", controller.createFromCartWallet);
router.post("/", controller.create);
router.get("/", controller.read);
router.get("/client", controller.readClient);
router.get("/id", controller.readSolicitudById);
router.get("/viajero", controller.getViajeroFromSolicitud);
router.get("/viajeroAgente", controller.getViajeroAgenteFromSolicitud);
router.get("/withviajero", controller.readSolicitudByIdWithViajero);
router.get("/consultas", controller.readConsultas);
router.get("/items", controller.getItemsSolicitud);
router.get("/forclient", controller.readForClient);
router.get("/ubicacion", controller.getUbicacionHotel);
router.post(
  "/filtro_solicitudes_y_reservas",
  controller.filtro_solicitudes_y_reservas
);

module.exports = router;
