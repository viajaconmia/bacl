const { z } = require("zod");

/**
 * Una solicitud dentro de la dispersión a crear.
 * id_solicitud, id_proveedor, clave_proveedor, cuenta_de_deposito, tipo_cuenta,
 * costo_proveedor y codigo_hotel no se usan en ninguna query — se aceptan solo
 * para devolverlos tal cual en la respuesta (conveniencia del frontend).
 */
const solicitudSchema = z.object({
  id_solicitud_proveedor: z.coerce.number().int().positive(),
  id_proveedor_cuenta: z.coerce.number().int().positive({
    message: "Cada solicitud debe traer una cuenta seleccionada (id_proveedor_cuenta)",
  }),
  monto_dispersar: z.coerce.number().positive({
    message: "monto_dispersar debe ser mayor a 0",
  }),
  fecha_pago: z.string().trim().min(1).nullish(),

  id_solicitud: z.union([z.string(), z.number()]).nullish(),
  id_proveedor: z.coerce.number().int().positive().nullish(),
  clave_proveedor: z.string().trim().nullish(),
  cuenta_de_deposito: z.string().trim().nullish(),
  tipo_cuenta: z.string().trim().nullish(),
  costo_proveedor: z.coerce.number().nullish(),
  codigo_hotel: z.string().trim().nullish(),
});

const createDispersionSchema = z.object({
  referencia_numerica: z.string().trim().nullish(),
  motivo_pago: z.string().trim().nullish(),
  layoutUrl: z.string().trim().nullish(),
  solicitudes: z
    .array(solicitudSchema)
    .min(1, "Debe haber al menos una solicitud en la dispersión"),
});

module.exports = { createDispersionSchema, solicitudSchema };
