const router = require("express").Router();
const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/pagos");
const { get_agente_facturas } = require("../../controller/facturas");
const { isSignToken } = require("../../../../middleware/auth");

router.post("/carrito/credito", isSignToken, controller.pagarCarritoConCredito);
router.post("/crearItemdeAjuste", controller.crearItemdeAjuste);
// router.post("/crearItemdeAjuste", controller.aplicarCambioNochesOAjuste);
router.post("/aplicarpagoPorSaldoAFavor", controller.pagoPorSaldoAFavor);
router.get("/getAllPagosPrepago", controller.getAllPagosPrepago);
router.post("/", controller.create);
router.get("/", controller.read);
router.get(
  "/empresa",
  middleware.validateParamsQuery(["id_empresa"]),
  controller.getEmpresaCredito
);
router.get(
  "/agente",
  middleware.validateParamsQuery(["id_agente"]),
  controller.getAgenteCredito
);

router.get(
  "/get_pagos_prepago_by_ID",
  middleware.validateParamsQuery(["id_agente"]),
  controller.get_pagos_prepago_by_ID
);

router.get("/todos", controller.getAgenteAgentesYEmpresas);
router.post("/agente", controller.updateCreditAgent);
router.post("/empresa", controller.updateCreditEmpresa);
router.get("/pagosAgente", controller.getPagosAgente);
router.put(
  "/precio-contado-regresar-saldo",
  controller.handlerPagoContadoRegresarSaldo
);

router.get("/pendientesAgente", controller.getPendientesAgente);
router.get("/allPendientes", controller.getAllPendientes);
router.get("/getAllPagos", controller.getAllPagos);
router.get("/consultas", controller.readConsultas);
router.get("/metodos_pago", controller.getMetodosPago);
router.post(
  "/credito",
  middleware.validateParams([
    "id_servicio",
    "monto_a_credito",
    "credito_restante",
    "responsable_pago_agente",
    "fecha_creacion",
    "pago_por_credito",
    "pendiente_por_cobrar",
    "total",
    "subtotal",
    "impuestos",
    "tipo_de_pago",
    "concepto",
  ]),
  controller.pagoPorCredito
);
router.get("/getDetallesConexion", controller.getDetallesConexionesPagos);
module.exports = router;
