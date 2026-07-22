const router = require("express").Router();
const { getItemsPendientes, asignarItems } = require("./facturasItems.controller");

router.get("/pendientes", getItemsPendientes);
router.post("/asignar", asignarItems);

module.exports = router;
