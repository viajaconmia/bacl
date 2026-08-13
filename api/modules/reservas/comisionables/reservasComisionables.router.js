const router = require("express").Router();
const { listar, cobrar } = require("./reservasComisionables.controller");

router.get("/", listar);
router.patch("/:id_booking/cobrar", cobrar);

module.exports = router;
