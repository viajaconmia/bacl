const controller = require("../../controller/facturamaController");
const router = require("express").Router();

// Obtener todos los clientes
router.get("/clients", controller.obtenerClientes);

// Obtener un cliente por RFC
router.get("/clients/rfc", controller.obtenerClientePorRfc);

// Obtener un cliente por ID
router.get("/clients/id", controller.obtenerClientePorId);

// Obtener facturas de un cliente
router.get("/invoices", controller.obtenerFacturasCliente);

// Crear un nuevo cliente
router.post("/clients", controller.crearCliente);

// Crear un CFDI
router.post(
  "/cfdi",
  async (req, res, next) => {
    console.log(req.body);
    next();
  },
  controller.crearCfdi
);

// Descargar facturas por CFDI ID
router.post("/download", controller.descargarFacturas);
router.post("/descarga", controller.newDescargarFacturas);

router.post("/downloadXML", controller.descargarFacturasXML);

// Enviar un correo con un CFDI
router.post("/send-email", controller.mandarCorreo);

//Cancelar un cfdi
router.delete("/cfdi", controller.cancelarCfdi);

router.get("/cfdi", controller.getCdfi);

module.exports = router;
