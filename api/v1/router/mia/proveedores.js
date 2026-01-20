const controller = require("../../controller/proveedores");
const router = require("express").Router();

router.get("/", controller.getProveedores); // obtiene una lista de proveedores
router.get("/detalles", controller.getDetalles); // obtiene los datos fiscales del proveedor
router.put("/", controller.putEditar); // Editar al proveedor
router.post("/datos_fiscales", controller.createDatosFiscales); // Crear datos fiscales
router.put("/datos_fiscales", controller.updateDatosFiscales);
router.post("/", controller.createProveedor);
router.post("/sucursal", controller.crearSucursal);
router.get("/sucursal", controller.getSucursales);

//Fiscal
router.get("/fiscal", controller.getDatosFiscales);

//Cuentas del proveedor
router.get("/cuentas", controller.getCuentas);
router.post("/cuentas", controller.createProveedorCuenta);
router.put("/cuentas", controller.updateProveedorCuenta);

//Proveedor
router.get("/proveedor", controller.getProveedorType);

//PROVEEDOR VUELO
router.put("/vuelo", controller.updateProveedorVuelo);
router.post("/vuelo", controller.createProveedorVuelo);

module.exports = router;
