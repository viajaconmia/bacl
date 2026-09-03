const service = require("./facturasEnvio.service");

const enviar = async (req, res) => {
  const { id_factura, correo_destino } = req.body;
  const { user } = req.session;
  try {
    const data = await service.enviarCorreo({ id_factura, correo_destino }, user);
    return res.status(200).json({
      message: "Correo de factura enviado correctamente",
      data,
    });
  } catch (error) {
    console.error("Error en enviar (facturasEnvio):", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message || "Error al enviar el correo de la factura",
    });
  }
};

const historial = async (req, res) => {
  const { id_factura, page, length } = req.query;

  try {
    const { rows, total, hasPagination } = await service.getHistorialByFactura(
      id_factura,
      { page, length },
    );

    return res.status(200).json({
      message: "Historial de envíos obtenido correctamente",
      data: rows,
      metadata: hasPagination ? { total } : null,
    });
  } catch (error) {
    console.error("Error en historial (facturasEnvio):", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message || "Error al obtener el historial de envíos",
    });
  }
};

module.exports = { enviar, historial };
