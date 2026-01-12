const controller = require("../../controller/proveedores");
const router = require("express").Router();

router.get("/", controller.getProveedores); // obtiene una lista de proveedores
router.get("/detalles", controller.getDetalles); // obtiene los datos fiscales del proveedor
router.put("/", controller.putEditar); // Editar al proveedor
router.post("/datos_fiscales", controller.createDatosFiscales); // Crear datos fiscales
router.put("/datos_fiscales", controller.updateDatosFiscales);
router.get("/datos_fiscales_proveedores",controller.getDatosFiscales)
router.post("/", controller.createProveedor);
router.post("/sucursal", controller.crearSucursal);
router.get("/sucursal", controller.getSucursales);

module.exports = router;
