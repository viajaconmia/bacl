const router = require("express").Router();
const empresasRouter = require("./empresas/agentesEmpresas.router");

router.use("/empresas", empresasRouter);

module.exports = router;
