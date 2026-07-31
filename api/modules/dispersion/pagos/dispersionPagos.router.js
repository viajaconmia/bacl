const router = require("express").Router();
const { create } = require("./dispersionPagos.controller");

router.post("/", create);

module.exports = router;
