const createRentaAutos = async (req, res) => {
  try {
    const {
      auto_descripcion,
      check_in,
      check_out,
      codigo,
      comentarios,
      conductores,
      costo,
      devuelta_lugar,
      edad,
      max_pasajeros,
      precio,
      proveedor,
      recogida_lugar,
      saldos,
      seguro,
      status,
      tipo_vehiculo,
    } = req.body;

    //TODO: VALIDAR LOS CAMPOS Y QUE EXISTAN ALGUNOS Y QUE NO SEAN NULL

    res.status(201).json({ message: "Creado con exito", data: null });
  } catch (error) {
    console.error(error);
    res.status(res.statusCode || res.status || 500).json({
      error,
      data: null,
      message:
        error.message || "Error al crear la reserva de la renta de autos",
    });
  }
};

module.exports = {
  createRentaAutos,
};
