const controller = require("../../controller/proveedores");
const router = require("express").Router();

router.get("/", controller.getProveedores);
router.post("/", controller.createProveedor);

module.exports = router;
