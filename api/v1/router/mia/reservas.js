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

    const split_services = response.reduce((acc, curr) => {
      acc = {
        ...acc,
        [curr.id_servicio]: acc[curr.id_servicio]
          ? [...acc[curr.id_servicio], curr]
          : [curr],
      };
      return acc;
    }, {});

    const agrupado = Object.values(split_services).map((arr) => ({
      data: arr,
      types: arr.reduce((acc, curr) => {
        if (!curr?.objeto_gemini?.type) {
          curr.objeto_gemini = { type: "hotel" };
        }
        acc = {
          ...acc,
          [curr.objeto_gemini.type]: acc[curr.objeto_gemini.type]
            ? acc[curr.objeto_gemini.type] + 1
            : 1,
        };
        return acc;
      }, {}),
    }));
    res.status(200).json({ message: "done", data: agrupado });
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
