const controller = require("../../controller/proveedores");
const router = require("express").Router();

router.get("/", controller.getProveedores);
router.post("/", controller.createProveedor);
router.post("/sucursal", controller.crearSucursal);
router.get("/sucursal", controller.getSucursales);

module.exports = router;
