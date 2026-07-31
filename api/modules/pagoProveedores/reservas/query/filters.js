const applyLike = (builder, column, value) => {
  if (value) builder.addWhere(`${column} LIKE ?`, `%${value}%`);
};

const applyExact = (builder, column, value) => {
  if (value) builder.addWhere(`${column} = ?`, value);
};

const applyDateRange = (builder, column, from, to) => {
  if (from) builder.addWhere(`DATE(${column}) >= ?`, from);
  if (to)   builder.addWhere(`DATE(${column}) <= ?`, to);
};

// Grupos predefinidos de estado — espejo exacto de los conteos del dashboard.
// Los valores son condiciones SQL literales (sin params) porque los estados son constantes del dominio.
const BUCKETS = {
  spei: `UPPER(TRIM(COALESCE(spp.estado_solicitud,''))) IN ('TRANSFERENCIA_SOLICITADA','DISPERSION')`,

  pago_tdc: `LOWER(TRIM(COALESCE(spp.forma_pago_solicitada,''))) = 'card'
    AND UPPER(TRIM(COALESCE(spp.estado_solicitud,''))) <> 'CANCELADA'`,

  pago_link: `LOWER(TRIM(COALESCE(spp.forma_pago_solicitada,''))) = 'link'
    AND UPPER(TRIM(COALESCE(spp.estado_solicitud,''))) <> 'CANCELADA'`,

  pagada: `UPPER(TRIM(COALESCE(spp.estado_solicitud,''))) IN ('PAGADO TARJETA','PAGADO TRANSFERENCIA','PAGADO LINK')`,

  notificados: `UPPER(TRIM(COALESCE(spp.estado_solicitud,''))) <> 'CANCELADA'
    AND COALESCE(spp.is_ajuste,0) = 1
    AND LOWER(TRIM(COALESCE(spp.forma_pago_solicitada,''))) IN ('transfer','card')`,

  canceladas: `UPPER(TRIM(COALESCE(spp.estado_solicitud,''))) = 'CANCELADA'`,

  ap_credito: `UPPER(TRIM(COALESCE(spp.estado_solicitud,''))) = 'SOLICITADA'`,

  pendiente_credito: `UPPER(TRIM(COALESCE(spp.estado_solicitud,''))) IN ('CUPON ENVIADO','CARTA_ENVIADA')`,

  // todos → sin condición adicional
};

// bucket = 'todos' o undefined → no agrega WHERE, devuelve todo.
// bucket desconocido → se ignora silenciosamente.
const applyBucket = (builder, bucket) => {
  if (!bucket || bucket === "todos") return;
  const condition = BUCKETS[bucket];
  if (condition) builder.addWhere(condition);
};

module.exports = { applyLike, applyExact, applyDateRange, applyBucket };
