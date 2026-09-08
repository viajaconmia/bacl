const router = require("express").Router();
const { editar } = require("./reservas.controller");
const solicitudesRouter = require("./solicitudes/reservasSolicitudes.router");
const comisionablesRouter = require("./comisionables/reservasComisionables.router");

router.use("/solicitudes", solicitudesRouter);
router.use("/comisionables", comisionablesRouter);
router.patch("/:id_booking", editar);

module.exports = router;
