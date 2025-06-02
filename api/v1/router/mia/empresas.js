const router = require("express").Router()
const controller = require("../../controller/empresas")
const middleware = require("../../middleware/validateParams")
const { executeQuery } = require("../../../../config/db")

router.post("/", middleware.validateParams(["agente_id", "razon_social", "nombre_comercial", "tipo_persona"]), controller.create)

router.get("/id", controller.readbyId)
router.get("/", controller.read)
router.get("/getAll", controller.readAll)
router.put("/", controller.update);
router.delete("/", controller.deleteEmpresaById);

router.get("/agente", async (req, res) => {
  try {
    const query = `select * from vw_datos_fiscales_detalle where id_agente = ?;`;
    const response = await executeQuery(query, [req.query.id])
    res.status(200).json(response)
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: "Error server", details: error })
  }
})

module.exports = router