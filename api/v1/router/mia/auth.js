const controller = require("../../controller/auth");
const router = require("express").Router();

router.post("/new-create-agent", controller.newCreateAgente);
router.get("/verificar-user", controller.verificarRegistroUsuario);

module.exports = router;
