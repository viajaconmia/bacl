const router = require("express").Router();
const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/viajeros");
const { executeQuery } = require("../../../../config/db");

router.post(
  "/",
  middleware.validateParams([
    "id_empresas",
    "primer_nombre",
    "apellido_paterno",
  ]),
  controller.create
);
router.get("/", controller.read);
router.get("/get-all-viajeros", controller.readAllViajeros);
router.get(
  "/get-viajeros-by-agente/:id_agente",
  controller.get_viajeros_by_id_agente
);
router.get(
  "/get-primer-viajero-empresa/:id_agente",
  controller.primeros_empresa_viajero
);
router.get("/id", controller.readById);
router.put("/", controller.update);
router.delete("/", controller.deleteViajeroById);

/* ESTE ES EL NUEVO QUE FUNCIONA EN ADMIN EN EL SERVICE DE VIAJEROS*/
router.get("/by-agente", async (req, res) => {
  try {
    const { id } = req.query;
    const query = `
    SELECT av.id_agente, v.*, CONCAT_WS(' ', v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno) AS nombre_completo FROM agentes_viajeros av
      LEFT JOIN viajeros v on v.id_viajero = av.id_viajero
    WHERE av.id_agente = ?;
    `;
    const response = await executeQuery(query, [id]);

    res.status(200).json({ message: "obtenidos con exito", data: response });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al extraer los viajeros",
      error,
      data: null,
    });
  }
});

router.get("/agente", async (req, res) => {
  try {
    const query = `select * from viajeros_con_empresas_con_agentes WHERE id_agente = ?;`;
    const response = await executeQuery(query, [req.query.id]);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error server", details: error });
    console.log(error);
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al extraer los viajeros",
      error,
      data: null,
    });
  }
});

module.exports = router;
});
