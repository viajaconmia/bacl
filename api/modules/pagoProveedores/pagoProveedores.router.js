const router = require("express").Router();
const reservasRouter = require("./reservas/pagoProveedoresReservas.router");

router.use("/reservas", reservasRouter);

module.exports = router;
