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
    const query = `
      SELECT 
          DATE_FORMAT(check_in, '%Y-%m') AS mes,
          COUNT(*) AS visitas,
          ROUND(SUM(total), 2) AS total_gastado,
          nombre_hotel AS hotel
      FROM mia3.vw_reservas_client
      WHERE 
          id_agente = ?
          AND YEAR(check_in) = ?
          AND MONTH(check_in) = ?
      GROUP BY 
          mes, hotel
      ORDER BY 
          mes DESC, total DESC;
    `;

    const params = [id_user, year, mes];
    const response = await executeQuery(query, params);
    console.log(response,"enviado de response")
    return response;
  } catch (error) {
    console.error("Error en getStatsPerMonth:", error);
    throw error;
  }
};

module.exports = {
  getStats,
  getStatsPerMonth,
};
