const { z } = require("zod");

/**
 * Payload para crear pagos a partir de dispersiones ya existentes
 * (dispersion_pagos_proveedor). Un pago por cada id_dispersion_pagos_proveedor.
 */
const crearPagosDesdeDispersionSchema = z.object({
  ids_dispersion: z
    .array(z.coerce.number().int().positive())
    .min(1, "Debe haber al menos un id_dispersion_pagos_proveedor"),
  url_pdf: z.string().trim().min(1, "El comprobante (url_pdf) es obligatorio"),
  concepto: z.string().trim().nullish(),
});

module.exports = { crearPagosDesdeDispersionSchema };
