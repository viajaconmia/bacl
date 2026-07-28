const router = require("express").Router();
const { getDispersion } = require("./pagoProveedoresSolicitudes.controller");

router.post("/", getDispersion);

module.exports = router;
