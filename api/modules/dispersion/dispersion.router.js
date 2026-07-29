const router = require("express").Router();
const { create } = require("./dispersion.controller");

router.post("/", create);

module.exports = router;
