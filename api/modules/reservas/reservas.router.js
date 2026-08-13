const router = require("express").Router();
const solicitudesRouter = require("./solicitudes/reservasSolicitudes.router");
const comisionablesRouter = require("./comisionables/reservasComisionables.router");

router.use("/solicitudes", solicitudesRouter);
router.use("/comisionables", comisionablesRouter);

module.exports = router;
