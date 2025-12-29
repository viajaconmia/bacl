const controller = require("../../controller/proveedores");
const router = require("express").Router();

router.get("/", controller.getProveedores);
router.post("/", controller.createProveedor);
router.post("/sucursal", controller.crearSucursal);
router.get("/sucursal", controller.getSucursales);
router.get("/detalles",controller.getDetalles);
router.put("editar_proveedor",controller.putEditar);
router.put("editar_cuenta",controller.putEditarCuenta);

module.exports = router;
