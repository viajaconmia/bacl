const router = require("express").Router();
const reservasRouter = require("./reservas/pagoProveedoresReservas.router");
const solicitudesRouter = require("./solicitudes/pagoProveedoresSolicitudes.router");

router.use("/reservas", reservasRouter);
router.use("/solicitudes", solicitudesRouter);

module.exports = router;
