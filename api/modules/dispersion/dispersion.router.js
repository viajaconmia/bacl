const router = require("express").Router();
const { create, getAll, eliminar } = require("./dispersion.controller");
const pagosRouter = require("./pagos/dispersionPagos.router");

router.post("/", create);
router.get("/", getAll);
router.use("/pagos", pagosRouter);
router.delete("/:codigo_dispersion", eliminar);

module.exports = router;
