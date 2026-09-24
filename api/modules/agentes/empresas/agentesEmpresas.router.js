const router = require("express").Router();
const { fiscales } = require("./agentesEmpresas.controller");

router.get("/fiscales", fiscales);

module.exports = router;
