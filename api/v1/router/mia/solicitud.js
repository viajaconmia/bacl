const controller = require("../../controller/solicitud")
const router = require("express").Router()
const middleware = require("../../middleware/validateParams")

const requiredParamsToCreate = ["solicitudes"]
router.post("/", middleware.validateParams(requiredParamsToCreate), controller.create)
router.get("/", controller.read)
router.get("/client", controller.readClient)
router.get("/id", controller.readSolicitudById)
router.get("/viajero", controller.getViajeroFromSolicitud)
router.get("/viajeroAgente", controller.getViajeroAgenteFromSolicitud)
router.get("/withviajero", controller.readSolicitudByIdWithViajero)
router.get("/consultas", controller.readConsultas)

module.exports = router