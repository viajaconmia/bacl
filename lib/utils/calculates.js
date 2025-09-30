
  function calcularNoches(checkIn, checkOut) {
  // Convertir a objetos Date
  const fechaInicio = new Date(checkIn);
  const fechaFin = new Date(checkOut);

  // Validar que sean fechas válidas
  if (isNaN(fechaInicio) || isNaN(fechaFin)) {
    throw new Error("Fechas inválidas");
  }

  // Calcular diferencia en milisegundos
  const diferenciaMs = fechaFin - fechaInicio;

  // Convertir milisegundos a días (1 día = 1000ms * 60s * 60m * 24h)
  const noches = diferenciaMs / (1000 * 60 * 60 * 24);

  return noches;
}

 function calcularPrecios(basePrice) {
  const impuestos = (basePrice - basePrice / 1.16).toFixed(2);
  const subtotal = (basePrice / 1.16).toFixed(2);

  return {
    impuestos: impuestos,
    subtotal: subtotal,
    total: basePrice.toFixed(2),
  };
}

module.exports= { calcularNoches, calcularPrecios };

