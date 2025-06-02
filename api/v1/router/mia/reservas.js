const router = require("express").Router();
const controller = require("../../controller/reservas");
const middleware = require("../../middleware/validateParams");

const requiredParamsToCreate = [];

router.put(
  "/",
  middleware.validateParams(requiredParamsToCreate),
  controller.updateReserva
);
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
router.get("/id", controller.readOnlyById);

module.exports = router;
