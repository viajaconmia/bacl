const router = require("express").Router();
const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/saldos");

router.get("/types", controller.saldosAgrupadosPorMetodoPorIdClient);
router.get("/type", controller.saldosByType);
router.get("/stripe-info", controller.getStripeInfo);
router.post("/", controller.create);
router.get("/", controller.read);
router.post(
  "/new",
  middleware.validateParams([
    "id_cliente",
    "monto_pagado",
    "forma_pago",
    "fecha_pago",
  ]),
  controller.createNewSaldo
);
router.patch("/actualizar-saldo-a-favor", controller.update_saldo_by_id);
router.get("/:id", controller.readSaldoByAgente);

module.exports = router;
