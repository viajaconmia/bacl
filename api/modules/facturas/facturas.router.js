const router = require("express").Router();
const { filtrar, detalle } = require("./facturas.controller");
const itemsRouter = require("./items/facturasItems.router");
const reservasRouter = require("./reservas/facturasReservas.router");

router.post("/filtrar", filtrar);
router.get("/detalle", detalle);
router.use("/items", itemsRouter);
router.use("/reservas", reservasRouter);

module.exports = router;
