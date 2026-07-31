const { getExecutor } = require("../../../../config/db");

class ReservasSolicitudesRepository {
  /**
   * Solicitudes pendientes de procesar (sin booking asociado, con pago o crédito, no canceladas).
   * Siempre retorna pocos registros — sin paginación ni filtros.
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object[]>}
   */
  async findPendientes(conn = null) {
    const run = getExecutor(conn);

    const whereSql = `WHERE b.id_booking IS NULL
      AND s.id_servicio IS NOT NULL
      AND (p.id_pago IS NOT NULL OR pc.id_credito IS NOT NULL)
      AND s.status <> 'canceled'`;

    return run(
      `SELECT
        s.id_solicitud,
        s.id_servicio,
        s.id_agente,
        NULL                                        AS id_hospedaje,
        s.id_hotel                                  AS id_hotel_solicitud,
        NULL                                        AS id_hotel_reserva,
        s.id_viajero                                AS id_viajero_solicitud,
        NULL                                        AS id_viajero_reserva,
        NULL                                        AS id_booking,
        p.id_pago,
        pc.id_credito,
        NULL                                        AS id_factura,
        NULL                                        AS id_facturama,
        s.status                                    AS status_solicitud,
        NULL                                        AS status_reserva,
        CASE
          WHEN s.check_in  > CURRENT_DATE                          THEN 'Reservado'
          WHEN s.check_out < CURRENT_DATE                          THEN 'Check-out'
          WHEN CURRENT_DATE BETWEEN s.check_in AND s.check_out     THEN 'In house'
          ELSE 'Sin estado'
        END                                         AS etapa_reservacion,
        s.created_at                                AS created_at_solicitud,
        NULL                                        AS created_at_reserva,
        NULL                                        AS updated_at,
        s.check_in,
        s.check_out,
        s.check_in                                  AS check_in_solicitud,
        s.check_out                                 AS check_out_solicitud,
        s.hotel                                     AS hotel_solicitud,
        NULL                                        AS hotel_reserva,
        s.room,
        s.room                                      AS tipo_cuarto,
        NULL                                        AS codigo_reservacion_hotel,
        NULL                                        AS confirmation_code,
        NULL                                        AS nuevo_incluye_desayuno,
        s.total                                     AS total_solicitud,
        s.total                                     AS total,
        NULL                                        AS costo_total,
        a.nombre                                    AS nombre_cliente,
        NULL                                        AS correo,
        NULL                                        AS telefono,
        NULL                                        AS rfc,
        s.is_con_desayuno,
        s.is_con_desayuno                           AS nuevo_incluye_desayuno,
        'fisica'                                    AS tipo_persona,
        TRIM(CONCAT_WS(' ',
          NULLIF(v.primer_nombre,     ''),
          NULLIF(v.segundo_nombre,    ''),
          NULLIF(v.apellido_paterno,  ''),
          NULLIF(v.apellido_materno,  '')
        ))                                          AS nombre_viajero_solicitud,
        NULL                                        AS nombre_viajero_reservacion,
        s.origen                                    AS quien_reservó,
        CASE
          WHEN pc.id_servicio IS NOT NULL THEN 'Credito'
          WHEN p.id_pago      IS NOT NULL THEN 'Contado'
          ELSE NULL
        END                                         AS metodo_pago_dinamico,
        NULL                                        AS comments
      FROM solicitudes s
      LEFT JOIN servicios        ser ON ser.id_servicio = s.id_servicio
      LEFT JOIN agentes          a   ON a.id_agente     = s.id_agente
      LEFT JOIN viajeros         v   ON v.id_viajero    = s.id_viajero
      LEFT JOIN bookings         b   ON b.id_solicitud  = s.id_solicitud
      LEFT JOIN pagos            p   ON p.id_servicio   = s.id_servicio
      LEFT JOIN pagos_credito    pc  ON pc.id_servicio  = s.id_servicio
      ${whereSql}`,
    );
  }
}

module.exports = new ReservasSolicitudesRepository();
