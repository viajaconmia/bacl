const router = require("express").Router();
const solicitudesRouter = require("./solicitudes/reservasSolicitudes.router");

router.use("/solicitudes", solicitudesRouter);

module.exports = router;
