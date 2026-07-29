const router = require("express").Router();
const { getDispersion } = require("./pagoProveedoresSolicitudes.controller");

router.post("/dispersion", getDispersion);

module.exports = router;
