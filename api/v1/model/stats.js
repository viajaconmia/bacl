const { executeQuery } = require("../../../config/db");

const getStats = async (month, year, id_user) => {
  try {
    let query = `SELECT
  s.id_solicitud,
  s.id_servicio,
  s.confirmation_code,
  s.id_viajero,
  s.hotel,
  s.check_in,
  s.check_out,
  s.room,
  s.total,
  s.status,
  s.id_usuario_generador,

  -- Campos adicionales para UI
  s.nombre_viajero,
  h.nombre_hotel,
  h.codigo_reservacion_hotel,
  CONCAT(DATE_FORMAT(s.check_in, '%d %b %Y'), ' - ', DATE_FORMAT(s.check_out, '%d %b %Y')) AS fechas,
  ROUND(s.total, 2) AS precio,
  s.status AS estado,

  -- Datos del viajero (puedes agregar más si quieres)
  v.primer_nombre,
  v.apellido_paterno,
  v.correo,
  v.telefono,

  -- Datos Pagos
  p.id_pago,
  pc.id_credito

FROM solicitudes s
LEFT JOIN bookings b ON s.id_solicitud = b.id_solicitud
LEFT JOIN hospedajes h ON b.id_booking = h.id_booking
LEFT JOIN viajeros v ON s.id_viajero = v.id_viajero
LEFT JOIN pagos p ON s.id_servicio = p.id_servicio
LEFT JOIN pagos_credito pc ON s.id_servicio = pc.id_servicio

WHERE s.id_usuario_generador = ?
  AND YEAR(s.check_in) = ?
  AND MONTH(s.check_in) = ?
  AND s.status <> 'canceled'

ORDER BY s.check_in DESC;
`;
    let params = [id_user, year, month];
    let response = await executeQuery(query, params);
    return response;
  } catch (error) {
    throw error;
  }
};
const getStatsPerMonth = async (year, id_user, mes) => {
  try {
    let query = `SELECT 
    DATE_FORMAT(b.check_in, '%Y-%m') AS mes,
    COUNT(*) AS visitas,
    ROUND(SUM(b.total),2) AS total_gastado,
    h.nombre_hotel as hotel
FROM solicitudes as so
INNER JOIN bookings as b ON b.id_solicitud = so.id_solicitud
INNER JOIN hospedajes as h ON h.id_booking = b.id_booking
INNER JOIN viajeros_hospedajes as vh ON vh.id_hospedaje = h.id_hospedaje
INNER JOIN agentes_viajeros as av ON av.id_viajero = vh.id_viajero
WHERE 
   av.id_agente = ?
  AND YEAR(b.check_in) = ?
    AND MONTH(b.check_in) = ?
  AND b.estado = "Confirmada"
GROUP BY 
    mes, hotel
ORDER BY 
    mes DESC, b.total DESC;
;
`;
    let params = [id_user, year, mes];
    let response = await executeQuery(query, params);
    return response;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getStats,
  getStatsPerMonth,
};
