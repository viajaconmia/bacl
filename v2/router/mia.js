const router = require("express").Router();
const pagoProveedor = require("../../api/modules/pagoProveedores/pagoProveedores.router");
const factura = require("../../api/modules/facturas/facturas.router");

router.use("/pago_proveedor", pagoProveedor);
router.use("/factura", factura);

module.exports = router;
