const router = require("express").Router();
const {
  listar,
  cobrar,
  editarComisionables,
} = require("./reservasComisionables.controller");

router.get("/", listar);
router.patch("/:id_booking/cobrar", cobrar);
router.patch("/:id_booking", editarComisionables);

module.exports = router;
