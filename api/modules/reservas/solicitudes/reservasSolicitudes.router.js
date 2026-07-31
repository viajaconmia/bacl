const router = require("express").Router();
const { getPendientes } = require("./reservasSolicitudes.controller");

router.get("/pendientes", getPendientes);

module.exports = router;
