const router = require("express").Router();
const pagoProveedor = require("../../api/modules/pagoProveedores/pagoProveedores.router");
const factura = require("../../api/modules/facturas/facturas.router");
const reservas = require("../../api/modules/reservas/reservas.router");
const dispersion = require("../../api/modules/dispersion/dispersion.router");

router.use("/pago_proveedor", pagoProveedor);
router.use("/factura", factura);
router.use("/reservas", reservas);
router.use("/dispersion", dispersion);

module.exports = router;
