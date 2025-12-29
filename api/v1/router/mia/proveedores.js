const controller = require("../../controller/proveedores");
const router = require("express").Router();

router.get("/", controller.getProveedores); // obtiene una lista de proveedores
router.get("/detalles", controller.getDetalles); // obtiene los datos fiscales del proveedor
router.post("/", controller.createProveedor);
router.post("/sucursal", controller.crearSucursal);
router.get("/sucursal", controller.getSucursales);
router.put("/editar_proveedor", controller.putEditar);
router.put("/editar_cuenta", controller.putEditarCuenta);
router.post("/crear_cuenta",controller.postCrearCuenta);

module.exports = router;
