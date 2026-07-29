const router = require("express").Router();
const { create, getAll } = require("./dispersion.controller");
const pagosRouter = require("./pagos/dispersionPagos.router");

router.post("/", create);
router.get("/", getAll);
router.use("/pagos", pagosRouter);

module.exports = router;
