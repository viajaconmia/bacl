const router = require("express").Router();
const {
  getDispersion,
  editar,
} = require("./pagoProveedoresSolicitudes.controller");

router.post("/dispersion", getDispersion);
router.patch("/", editar);

module.exports = router;
