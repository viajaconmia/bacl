const router = require("express").Router();
const comisionablesRouter = require("./comisionables/notificacionesComisionables.router");

router.use("/comisionables", comisionablesRouter);

module.exports = router;
