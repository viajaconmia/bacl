const router = require("express").Router();
const controller = require("../../controller/reservas");
const middleware = require("../../middleware/validateParams");
const controller_v2 = require("../../../../v2/controller/reservas.controller");

const requiredParamsToCreate = [];
router.get("/detallesConexion", controller.getDetallesConexionReservas);
router.put("/nuevo-editar-reserva", controller_v2.editar_reserva_definitivo);
/*router.put(
  "/",
  //middleware.validateParams(requiredParamsToCreate),
  // controller.updateReserva //se vovio el original era updateReserva
  controller.updateReserva2
);*/
router.post(
  "/operaciones",
  middleware.validateParams(requiredParamsToCreate),
  controller.createFromOperaciones
);
router.post(
  "/",
  middleware.validateParams(requiredParamsToCreate),
  controller.create
);
router.get("/", controller.read);
router.get("/agente", controller.readById);
router.get("/all", controller.readAll);
router.get("/allFacturacion", controller.readAllFacturacion);
router.get("/id", controller.readOnlyById);
router.put("/items", controller.actualizarPrecioVenta);
router.get("/items", controller.getItemsFromBooking);
router.get("/reservasConItems", controller.getReservasWithIAtemsByidAgente);
router.get(
  "/reservasConItemsSinPagar",
  controller.getReservasWithItemsSinPagarByAgente
);

module.exports = router;
