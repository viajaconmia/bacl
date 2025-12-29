const controller = require("../../controller/proveedores");
const router = require("express").Router();

router.get("/", controller.getProveedores);
router.post("/", controller.createProveedor);
router.post("/sucursal", controller.crearSucursal);
router.get("/sucursal", controller.getSucursales);
router.get

module.exports = router;
