const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/credito");
const router = require("express").Router();

router.post("/", controller.create);
router.get("/", controller.read);
router.put("/precio-venta-credito", controller.actualizarPrecioCredito);
router.put(
  "/precio-credito-regresar-saldo",
  controller.handlerPagoCreditoRegresarSaldo
);

module.exports = router;
