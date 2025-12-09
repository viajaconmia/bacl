const router = require("express").Router();
const { executeQuery } = require("../../../../config/db");
const controller = require("../../controller/reservas");
const middleware = require("../../middleware/validateParams");

const requiredParamsToCreate = [];
router.get("/detallesConexion", controller.getDetallesConexionReservas);
router.put(
  "/",
  //middleware.validateParams(requiredParamsToCreate),
  // controller.updateReserva //se vovio el original era updateReserva
  controller.updateReserva2
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
router.get("/allFacturacion", controller.readAllFacturacion);
router.get("/id", controller.readOnlyById);
router.put("/items", controller.actualizarPrecioVenta);
router.get("/items", controller.getItemsFromBooking);
router.get("/reservasConItems", controller.getReservasWithIAtemsByidAgente);
router.get(
  "/reservasConItemsSinPagar",
  controller.getReservasWithItemsSinPagarByAgente
);
router.get("/cotizaciones", async (req, res) => {
  try {
    const response = await executeQuery(
      `SELECT * FROM vw_solicitud_cotizaciones;`
    );
    console.log(response);
    res.status(200).json({ message: "done", data: response });
  } catch (error) {
    console.log(error.message);
    return res.status(error.statusCode || 500).json({
      error: error.details,
      message: error.message,
      data: null,
    });
  }
});

module.exports = router;
