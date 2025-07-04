const { executeTransaction, executeQuery } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

// const createSolicitudYTicket = async (solicitud) => {
//   try {
//     let query = `INSERT INTO solicitudes (confirmation_code, id_viajero, hotel, check_in, check_out, room, total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
//     let params = [
//       solicitud.confirmation_code,
//       solicitud.id_viajero,
//       solicitud.hotel_name,
//       solicitud.check_in,
//       solicitud.check_out,
//       solicitud.room_type,
//       solicitud.total_price,
//       solicitud.status,
//     ];

//     let response = await executeTransaction(
//       query,
//       params,
//       async (results, connection) => {
//         console.log("Creamos el ticket");
//       }
//     );

//     return response;
//   } catch (error) {
//     throw error;
//   }
// };

const createSolicitudes = async (body) => {
  try {
    const { solicitudes } = body;
    console.log(solicitudes);
    const id_servicio = `ser-${uuidv4()}`;
    const query_servicio = `INSERT INTO servicios (id_servicio, total, subtotal, impuestos, is_credito, otros_impuestos, fecha_limite_pago, id_agente) VALUES (?,?,?,?,?,?,?,?);`;
    const total = solicitudes.reduce(
      (prev, current) => prev + current.total,
      0
    );
    const subtotal = parseFloat((total * 0.84).toFixed(2));
    const impuestos = parseFloat((total * 0.16).toFixed(2));
    const params_servicio = [
      id_servicio,
      total,
      subtotal,
      impuestos,
      null,
      null,
      null,
      solicitudes[0].id_agente,
    ];

    const response = await executeTransaction(
      query_servicio,
      params_servicio,
      async (results, connection) => {
        try {
          const query_solicitudes = `INSERT INTO solicitudes (id_solicitud, id_servicio, id_usuario_generador, confirmation_code, id_viajero, hotel, check_in, check_out, room, total, status, nombre_viajero,viajeros_adicionales) VALUES ${solicitudes
            .map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .join(",")};`;

          const params_solicitudes_map = solicitudes.map((solicitud) => {
            let id_solicitud = `sol-${uuidv4()}`;
            // Correct destructuring to match incoming data keys
            const {
              confirmation_code,
              id_agente,
              hotel,
              check_in,
              check_out,
              room,
              total,
              status,
              id_viajero,
              nombre_viajero,
              viajeros_adicionales,
            } = solicitud;
            return [
              id_solicitud,
              id_servicio,
              id_agente,
              confirmation_code,
              id_viajero,
              hotel,
              check_in,
              check_out,
              room,
              total,
              status,
              nombre_viajero,
              JSON.stringify(viajeros_adicionales) || [],
            ];
          });
          const params_solicitudes_flat = params_solicitudes_map.flat();

          const response_solicitudes = await connection.execute(
            query_solicitudes,
            params_solicitudes_flat
          );
          return params_solicitudes_map.map((list) => list[0]);
        } catch (error) {
          throw error;
        }
      }
    );

    return { id_servicio: id_servicio, response };
  } catch (error) {
    throw error;
  }
};

const getSolicitudes = async (filters = { filterType: "Creacion" }) => {
  try {
    let conditions = [];
    let values = [];
    let type_filters = {
      "Check-in": "so.check_in",
      "Check-out": "so.check_out",
      Transaccion: "s.created_at",
      Actualizacion: "b.updated_at",
    };

    if (filters.client) {
      conditions.push(
        `	(CONCAT_WS(' ', vw.primer_nombre, vw.segundo_nombre, vw.apellido_paterno, vw.apellido_materno) LIKE ? OR vwae.rfc LIKE ? OR vwae.razon_social LIKE ?) `
      );
      values.push(`%${filters.client.split(" ").join("%")}%`);
      values.push(`%${filters.client.split(" ").join("%")}%`);
      values.push(`%${filters.client.split(" ").join("%")}%`);
    }

    if (filters.codigo_reservacion) {
      conditions.push(`h.codigo_reservacion_hotel LIKE ?`);
      values.push(`%${filters.codigo_reservacion}%`);
    }
    if (filters.traveler) {
      conditions.push(
        `(so.nombre_viajero LIKE ? OR CONCAT_WS(' ', vwa.primer_nombre, vwa.segundo_nombre, vwa.apellido_paterno, vwa.apellido_materno) LIKE ?)`
      );
      values.push(`%${filters.traveler}%`);
      values.push(`%${filters.traveler.split(" ").join("%")}%`);
    }

    if (filters.hotel) {
      conditions.push(`so.hotel LIKE ?`);
      values.push(`%${filters.hotel}%`);
    }
    if (filters.id_client) {
      conditions.push(`vw.id_agente LIKE ?`);
      values.push(`%${filters.id_client.split("").join("%")}%`);
    }

    if (filters.status) {
      const estadoMap = {
        Pendiente: "pending",
        Confirmada: "complete",
        Cancelada: "canceled",
      };
      conditions.push(`so.status = ?`);
      values.push(estadoMap[filters.status]);
    }
    if (filters.id_booking) {
      const isbooking = {
        Active: "not null",
        Inactive: "null",
      };
      conditions.push(`b.id_booking is ${isbooking[filters.id_booking]}`);
    }
    if (filters.reservationStage) {
      conditions.push(`
    (CASE
		  WHEN so.check_in > CURRENT_DATE THEN 'Reservado'
		  WHEN so.check_out < CURRENT_DATE THEN 'Check-out'
		  WHEN CURRENT_DATE BETWEEN so.check_in AND so.check_out THEN 'In house'
		  ELSE 'Sin estado'
    END) = ?`);
      values.push(filters.reservationStage);
    }

    if (filters.paymentMethod) {
      const paymentMethodMap = {
        Contado: `p.tipo_de_pago = "contado"`,
        Credito: "p_c.id_credito IS NOT NULL",
      };
      conditions.push(paymentMethodMap[filters.paymentMethod]);
    }
    if (filters.reservante) {
      const reservanteMap = {
        Operaciones: `so.id_usuario_generador IS NULL`,
        Cliente: "so.id_usuario_generador IS NOT NULL",
      };
      conditions.push(reservanteMap[filters.reservante]);
    }
    if (type_filters[filters.filterType]) {
      if (filters.startDate) {
        conditions.push(`${type_filters[filters.filterType]} >= ?`);
        values.push(`${filters.startDate} 00:00:00`);
      }
      if (filters.endDate) {
        conditions.push(`${type_filters[filters.filterType]} <= ?`);
        values.push(`${filters.endDate} 23:59:59`);
      }
    }

    let whereClause = `
      WHERE (p.id_pago IS NOT NULL OR p_c.id_credito IS NOT NULL)
      ${conditions.length ? "AND " + conditions.join(" AND ") : ""}
    `;

    let query = `
SELECT 
	s.id_servicio,
    CASE
		WHEN so.check_in > CURRENT_DATE THEN 'Reservado'
		WHEN so.check_out < CURRENT_DATE THEN 'Check-out'
		WHEN CURRENT_DATE BETWEEN so.check_in AND so.check_out THEN 'In house'
		ELSE 'Sin estado'
	END AS estado_reserva,
	s.created_at,
	s.is_credito,
	so.id_solicitud,
	so.id_viajero,
    so.hotel,
    so.check_in,
    so.check_out,
    so.room,
    so.total,
    so.status,
    so.id_usuario_generador,
    so.nombre_viajero,
    so.viajeros_adicionales,
	b.id_booking,
	b.updated_at,
  b.costo_total,
  h.id_hospedaje,
  h.comments,
	h.codigo_reservacion_hotel,  
	p.id_pago,
    p.metodo_de_pago,
    p.tipo_de_pago,
	p_c.id_credito, 
	p_c.pendiente_por_cobrar,
	p.monto_a_credito,
    vw.id_agente,
	CONCAT_WS(' ', vw.primer_nombre, vw.segundo_nombre, vw.apellido_paterno, vw.apellido_materno) AS nombre_viajero_completo,
	CONCAT_WS(' ', vwa.primer_nombre, vwa.segundo_nombre, vwa.apellido_paterno, vwa.apellido_materno) AS nombre_agente_completo,
    vwa.correo,
    vwa.telefono,
    vwae.razon_social,
    vwae.rfc,
    vwae.tipo_persona
FROM solicitudes as so
LEFT JOIN servicios as s ON so.id_servicio = s.id_servicio
LEFT JOIN bookings as b ON so.id_solicitud = b.id_solicitud
LEFT JOIN hospedajes as h ON b.id_booking = h.id_booking
LEFT JOIN pagos_credito as p_c ON s.id_servicio = p_c.id_servicio
LEFT JOIN pagos as p ON so.id_servicio = p.id_servicio
LEFT JOIN viajeros_con_empresas_con_agentes as vw ON vw.id_viajero = so.id_viajero
LEFT JOIN vw_details_agente as vwa ON vw.id_agente = vwa.id_agente 
LEFT JOIN vw_agente_primer_empresa as vwae ON vwae.id_agente = vw.id_agente
${whereClause}
${/*GROUP BY so.id_solicitud*/ ""}
ORDER BY s.created_at DESC;`;

    let response = await executeQuery(query, values);
    return response;
  } catch (error) {
    console.error("Error in getSolicitudes:", error);
    throw error;
  }
};

const getSolicitudById = async (id) => {
  try {
    let query = `
SELECT 
  s.id_servicio,
  s.created_at,
  s.is_credito,
  so.id_solicitud,
  so.confirmation_code,
  so.hotel,
  so.check_in,
  so.check_out,
  so.room,
  so.total,
  so.viajeros_adicionales,
  CONCAT_WS(' ', vw.primer_nombre, vw.segundo_nombre, vw.apellido_paterno, vw.apellido_materno) AS nombre_viajero,
  GROUP_CONCAT(CONCAT_WS(' ', v.primer_nombre) SEPARATOR ', ') AS nombres_viajeros_adicionales,
  h.comments,
  h.id_hotel,
  so.id_usuario_generador,
  b.id_booking, 
  h.codigo_reservacion_hotel, 
  p.id_pago, 
  p.pendiente_por_cobrar,
  p.monto_a_credito,
  hot.direccion,
  hot.desayuno_sencilla,
  hot.desayuno_doble,
  fp.id_factura
FROM solicitudes as so
LEFT JOIN servicios as s ON so.id_servicio = s.id_servicio
LEFT JOIN bookings as b ON so.id_solicitud = b.id_solicitud
LEFT JOIN hospedajes as h ON b.id_booking = h.id_booking
LEFT JOIN pagos as p ON so.id_servicio = p.id_servicio
LEFT JOIN facturas_pagos as fp ON p.id_pago = fp.id_pago
LEFT JOIN viajeros_con_empresas_con_agentes as vw ON vw.id_viajero = so.id_viajero
LEFT JOIN vw_hoteles_tarifas_completa as hot ON hot.id_hotel = h.id_hotel
LEFT JOIN JSON_TABLE(
    so.viajeros_adicionales,
    '$[*]' COLUMNS (id_viajero VARCHAR(50) PATH '$')
) AS va ON 1
LEFT JOIN viajeros AS v ON v.id_viajero = va.id_viajero
WHERE so.id_solicitud = ?
GROUP BY so.id_solicitud
ORDER BY s.created_at DESC;`;
    let response = await executeQuery(query, [id]);
    console.log(response);

    return response;
  } catch (error) {
    throw error;
  }
};

const getSolicitudesClientWithViajero = async (id) => {
  try {
    const query = `SELECT 
  p_c.id_credito,
  p.id_pago,
  b.id_booking, 
  p_c.pendiente_por_cobrar,
  s.id_servicio,
  s.created_at,
  s.is_credito,
  so.id_solicitud,
  so.confirmation_code,
  so.hotel,
  so.check_in,
  so.check_out,
  so.room,
  so.total,
  so.status,
  so.nombre_viajero,
  so.id_usuario_generador,
  h.codigo_reservacion_hotel, 
  p.monto_a_credito,
  fp.id_factura,
  UPPER(IFNULL(v.primer_nombre, '')) AS primer_nombre,
  UPPER(IFNULL(v.apellido_paterno, '')) AS apellido_paterno,
  f.id_facturama
FROM agentes a
inner join empresas_agentes 	as ea  
		On a.id_agente  = ea.id_agente 	    									
				and  a.id_agente = ?
inner join empresas 			as e 	On e.id_empresa = ea.id_empresa 
inner join viajero_empresa 		as ve 	On e.id_empresa = ve.id_empresa 
inner join viajeros 			as v 	On v.id_viajero = ve.id_viajero 
inner join solicitudes 			as so   On so.id_viajero = ve.id_viajero 
INNER JOIN servicios 			as s 	ON so.id_servicio = s.id_servicio
left join bookings 			as b	On b.id_solicitud = so.id_solicitud 
left JOIN hospedajes 			as h 	ON b.id_booking = h.id_booking
LEFT JOIN pagos 		   		as p 	ON so.id_servicio = p.id_servicio
LEFT JOIN facturas_pagos   		as fp 	ON p.id_pago = fp.id_pago
LEFT JOIN facturas         		as f 	ON fp.id_factura = f.id_factura
LEFT JOIN pagos_credito    		as p_c 	ON s.id_servicio = p_c.id_servicio
WHERE so.status <> 'canceled'
group by so.id_solicitud
ORDER BY a.id_agente, a.created_at`;

    // Ejecutar el procedimiento almacenado
    const response = await executeQuery(query, [id]);

    return response;
  } catch (error) {
    throw error;
  }
};
const readForClient = async (id) => {
  try {
    const query = `
SELECT
	  so.id_solicitud,
    h.codigo_reservacion_hotel,
    ho.nombre,
    so.hotel,
    so.check_in,
    so.check_out,
    so.room,
    so.total,
    so.status,
    CONCAT_WS(' ', v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno) AS nombre_viajero_completo,
    so.nombre_viajero,
    se.created_at,
    ho.URLImagenHotel,
    !isnull(b.id_booking) as is_booking,
    p.id_pago,
    f.id_facturama,
    pc.id_credito,
    pc.pendiente_por_cobrar
FROM solicitudes as so
LEFT JOIN bookings as b ON b.id_solicitud = so.id_solicitud
INNER JOIN servicios as se ON se.id_servicio = so.id_servicio
LEFT JOIN hospedajes as h ON h.id_booking = b.id_booking
LEFT JOIN hoteles as ho ON h.id_hotel = ho.id_hotel
LEFT JOIN viajeros_hospedajes as vh ON vh.id_hospedaje = h.id_hospedaje AND vh.is_principal = 1
LEFT JOIN viajeros as v ON v.id_viajero = vh.id_viajero OR so.id_viajero = v.id_viajero
LEFT JOIN pagos as p ON p.id_servicio = se.id_servicio
LEFT JOIN pagos_credito as pc ON pc.id_servicio = se.id_servicio
LEFT JOIN facturas_pagos as fp ON fp.id_pago = p.id_pago
LEFT JOIN facturas as f ON f.id_factura = fp.id_factura
LEFT JOIN agentes_viajeros as av ON av.id_viajero = so.id_viajero
WHERE (p.id_pago IS NOT NULL OR pc.id_credito IS NOT NULL) AND so.status <> "canceled" AND av.id_agente = ?
order by se.created_at desc;`;

    // Ejecutar el procedimiento almacenado
    const response = await executeQuery(query, [id]);

    return response.map((item) => ({
      ...item,
      viajero: item.nombre_viajero_completo
        ? item.nombre_viajero_completo
        : item.nombre_viajero,
      hotel: item.nombre ? item.nombre : item.hotel,
    }));
  } catch (error) {
    throw error;
  }
};

const getSolicitudesClient = async (user_id) => {
  try {
    let query = `
SELECT
    solicitudes.*,
    ROUND(solicitudes.total, 2) AS solicitud_total,
    servicios.created_at,
    hospedajes.nombre_hotel,
    pagos.*,
    CASE
        WHEN bookings.id_solicitud IS NOT NULL THEN TRUE
        ELSE FALSE
    END AS is_booking,
    facturas.id_facturama
FROM servicios
LEFT JOIN solicitudes ON servicios.id_servicio = solicitudes.id_servicio
LEFT JOIN bookings ON solicitudes.id_solicitud = bookings.id_solicitud
LEFT JOIN hospedajes ON bookings.id_booking = hospedajes.id_booking
LEFT JOIN pagos ON solicitudes.id_servicio = pagos.id_servicio
LEFT JOIN facturas_pagos ON pagos.id_pago = facturas_pagos.id_pago
LEFT JOIN facturas ON facturas_pagos.id_factura = facturas.id_factura
WHERE solicitudes.id_usuario_generador = ?
ORDER BY servicios.created_at DESC;`;
    let response = await executeQuery(query, [user_id]);

    const formatResponse = response.map((item) => {
      return {
        ...item,
        hotel: item.hotel ? item.hotel : item.nombre_hotel,
      };
    });

    return formatResponse;
  } catch (error) {
    throw error;
  }
};

const getViajeroSolicitud = async (id_agente) => {
  try {
    let query = `select * from viajeros_con_empresas_con_agentes where id_viajero = ?; `;
    let params = [id_agente];
    let response = await executeQuery(query, params);
    return response;
  } catch (error) {
    throw error;
  }
};

const getViajeroAgenteSolicitud = async (id_agente) => {
  try {
    let query = `select * from viajeros_con_empresas_con_agentes where id_agente = ?; `;
    let params = [id_agente];
    let response = await executeQuery(query, params);
    return response;
  } catch (error) {
    throw error;
  }
};

const getSolicitudesConsultas = async (user_id) => {
  try {
    let query = `
SELECT
  solicitudes.id_solicitud,
  solicitudes.id_servicio,
  solicitudes.confirmation_code,
  solicitudes.id_viajero,
  solicitudes.hotel,
  solicitudes.check_in,
  solicitudes.check_out,
  solicitudes.room,
  solicitudes.total,
  solicitudes.status,
  solicitudes.id_usuario_generador,
  solicitudes.nombre_viajero,
  ROUND(solicitudes.total, 2) AS solicitud_total,
  servicios.created_at,
  hospedajes.nombre_hotel,
  hospedajes.codigo_reservacion_hotel,
  viajeros.*,
  IF(bookings.id_solicitud IS NOT NULL, TRUE, FALSE) AS is_booking,

  -- JSON con todos los pagos relacionados a esta solicitud
  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id_pago', p.id_pago,
        'monto', p.monto,
        'monto_a_credito', p.monto_a_credito,
        'responsable_pago_empresa', p.responsable_pago_empresa,
        'responsable_pago_agente', p.responsable_pago_agente,
        'fecha_creacion', p.created_at,
        'pago_por_credito', p.pago_por_credito,
        'pendiente_por_cobrar', p.pendiente_por_cobrar,
        'subtotal', p.subtotal,
        'impuestos', p.impuestos,
        'updated_at', p.updated_at,
        'padre', p.padre,
        'concepto', p.concepto,
        'referencia', p.referencia,
        'fecha_pago', p.fecha_pago,
        'spei', p.spei,
        'banco', p.banco,
        'autorizacion_stripe', p.autorizacion_stripe,
        'last_digits', p.last_digits,
        'fecha_transaccion', p.fecha_transaccion,
        'currency', p.currency,
        'metodo_de_pago', p.metodo_de_pago,
        'tipo_de_tarjeta', p.tipo_de_tarjeta,
        'tipo_de_pago', p.tipo_de_pago
      )
    )
    FROM pagos p
    WHERE p.id_servicio = solicitudes.id_servicio
  ) AS pagos,

  -- JSON con todas las facturas relacionadas a los pagos de esta solicitud
  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id_factura', f.id_factura,
        'id_facturama', f.id_facturama,
        'fecha_emision', f.created_at,
        'RFC', f.rfc,
        'id_empresa', f.id_empresa,
        'folio', f.id_facturama,
        'monto_factura', f.total,
        'razon_social', e.razon_social
      )
    )
    FROM pagos p
    JOIN facturas_pagos fp ON p.id_pago = fp.id_pago
    JOIN facturas f ON fp.id_factura = f.id_factura
    LEFT JOIN empresas e ON f.id_empresa = e.id_empresa
    WHERE p.id_servicio = solicitudes.id_servicio
  ) AS facturas

FROM servicios
LEFT JOIN solicitudes ON servicios.id_servicio = solicitudes.id_servicio
LEFT JOIN bookings ON solicitudes.id_solicitud = bookings.id_solicitud
LEFT JOIN hospedajes ON bookings.id_booking = hospedajes.id_booking
LEFT JOIN viajeros ON solicitudes.id_viajero = viajeros.id_viajero
WHERE solicitudes.id_solicitud IS NOT NULL
  AND solicitudes.id_usuario_generador = ?
ORDER BY servicios.created_at DESC;`;
    let response = await executeQuery(query, [user_id]);

    return response;
  } catch (error) {
    throw error;
  }
};

const getItemsSolicitud = async (id_solicitud) => {
  try {
    //     let query = `
    // SELECT
    //   s.id_solicitud,
    //   s.id_servicio,
    //   s.confirmation_code,
    //   s.id_viajero,
    //   s.hotel,
    //   s.check_in,
    //   s.check_out,
    //   s.room,
    //   s.total,
    //   s.status,
    //   s.id_usuario_generador,
    //   s.nombre_viajero,

    //   -- Items agrupados por noche en formato JSON
    //   (
    //     SELECT JSON_ARRAYAGG(
    //       JSON_OBJECT(
    //         'id_item', i.id_item,
    //         'fecha_uso', i.fecha_uso,
    //         'total', i.total,
    //         'subtotal', i.subtotal,
    //         'impuestos', i.impuestos,
    //         'costo_total', i.costo_total,
    //         'costo_subtotal', i.costo_subtotal,
    //         'costo_impuestos', i.costo_impuestos,
    //         'saldo', i.saldo,
    //         'is_facturado', i.is_facturado,
    //         'id_factura', i.id_factura
    //       )
    //     )
    //     FROM items i
    //     WHERE i.id_hospedaje = h.id_hospedaje
    //     ORDER BY i.fecha_uso
    //   ) AS items,

    //   -- Información de booking
    //   IF(b.id_solicitud IS NOT NULL, TRUE, FALSE) AS is_booking,
    //   b.id_booking

    // FROM solicitudes s
    // LEFT JOIN bookings b ON s.id_solicitud = b.id_solicitud
    // LEFT JOIN hospedajes h ON b.id_booking = h.id_booking
    // WHERE s.id_solicitud = ?;`;
    let query = `
    select i.* from items i
            JOIN hospedajes h ON i.id_hospedaje = h.id_hospedaje
            JOIN bookings b ON h.id_booking = b.id_booking
          WHERE b.id_solicitud = ?;
      `;
    let response = await executeQuery(query, [id_solicitud]);
    console.log("xd");
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  // createSolicitudYTicket,
  getViajeroSolicitud,
  getSolicitudes,
  createSolicitudes,
  getSolicitudesClient,
  getSolicitudesClientWithViajero,
  getSolicitudById,
  getViajeroAgenteSolicitud,
  getSolicitudesConsultas,
  getItemsSolicitud,
  readForClient,
};
