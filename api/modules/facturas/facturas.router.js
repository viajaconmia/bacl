const router = require("express").Router();
const { filtrar, detalle } = require("./facturas.controller");
const itemsRouter = require("./items/facturasItems.router");
const reservasRouter = require("./reservas/facturasReservas.router");
const envioRouter = require("./envio/facturasEnvio.router");

router.post("/filtrar", filtrar);
router.get("/detalle", detalle);
router.use("/items", itemsRouter);
router.use("/reservas", reservasRouter);
router.use("/envio", envioRouter);

module.exports = router;
