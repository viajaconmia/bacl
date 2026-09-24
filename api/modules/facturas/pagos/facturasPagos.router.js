const router = require("express").Router();
const { prepagoFacturables, balance } = require("./facturasPagos.controller");

router.get("/prepago-facturables", prepagoFacturables);
router.get("/balance", balance);

module.exports = router;
