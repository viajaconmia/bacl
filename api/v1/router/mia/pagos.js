const router = require("express").Router()
const middleware = require("../../middleware/validateParams")
const controller = require("../../controller/pagos")

router.post("/", controller.create)
router.get("/", controller.read)
router.get("/empresa", middleware.validateParamsQuery(["id_empresa"]), controller.getEmpresaCredito)
router.get("/agente", middleware.validateParamsQuery(["id_agente"]), controller.getAgenteCredito)
router.get("/todos", controller.getAgenteAgentesYEmpresas)
router.post("/agente", controller.updateCreditAgent)
router.post("/empresa", controller.updateCreditEmpresa)
router.get("/pagosAgente", controller.getPagosAgente)
router.get("/pendientesAgente", controller.getPendientesAgente)
router.get("/allPendientes", controller.getAllPendientes)
router.get("/getAllPagos", controller.getAllPagos)
router.get("/consultas", controller.readConsultas)
router.post("/credito", middleware.validateParams(["id_servicio", "monto_a_credito", "credito_restante","responsable_pago_agente", "fecha_creacion", "pago_por_credito", "pendiente_por_cobrar", "total", "subtotal", "impuestos", "tipo_de_pago","concepto"]), controller.pagoPorCredito)

module.exports = router