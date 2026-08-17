const pagoProveedoresReservasService = require("./pagoProveedoresReservas.service");

const getReservas = async (req, res) => {
  const {
    notas_internas,
    codigo_confirmacion,
    fecha_inicio_creacion,
    fecha_fin_creacion,
    estado_solicitud,
    estado_facturacion,
    estatus_pagos,
    cliente,
    proveedor,
    forma_pago,
    tipo_negociacion,
    fecha_solicitud_inicio,
    fecha_solicitud_fin,
    comentarios_ops,
    comentarios_cxp,
    servicio,
    checkin_inicio,
    checkin_fin,
    includeFacturas,
    rfc,
    uuid,
    includePagos,
    con_dispersion,
    bucket,
    order_by,
    order_dir,
    page,
    length,
  } = req.query;

  try {
    const { rows, total, hasPagination } =
      await pagoProveedoresReservasService.getAll({
        notas_internas,
        codigo_confirmacion,
        fecha_inicio_creacion,
        fecha_fin_creacion,
        estado_solicitud,
        estado_facturacion,
        estatus_pagos,
        cliente,
        proveedor,
        forma_pago,
        tipo_negociacion,
        fecha_solicitud_inicio,
        fecha_solicitud_fin,
        comentarios_ops,
        comentarios_cxp,
        servicio,
        checkin_inicio,
        checkin_fin,
        includeFacturas,
        rfc,
        bucket,
        uuid,
        includePagos,
        con_dispersion,
        order_by,
        order_dir,
        page,
        length,
      });

    return res.status(200).json({
      message: "Reservas de pago a proveedor obtenidas correctamente",
      data: rows,
      metadata: hasPagination ? { total } : null,
    });
  } catch (error) {
    console.error("Error en getReservas:", error);
    return res.status(error.statusCode ?? 500).json({
      error: "Error al obtener reservas de pago a proveedor",
      details: error.message || error,
    });
  }
};

module.exports = { getReservas };
