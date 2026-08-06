const router = require("express").Router();
const reservasRouter = require("./reservas/pagoProveedoresReservas.router");
const solicitudesRouter = require("./solicitudes/pagoProveedoresSolicitudes.router");
const facturasRouter = require("./facturas/pagoProveedoresFacturas.router");

router.use("/reservas", reservasRouter);
router.use("/solicitudes", solicitudesRouter);
router.use("/facturas", facturasRouter);

module.exports = router;
