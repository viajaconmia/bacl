const { executeQuery, executeTransaction, runTransaction } = require("../../../config/db");
const { crearCfdi } = require("./facturamaModel")
const { v4: uuidv4 } = require("uuid");

const createFactura = async ({ cfdi, info_user }) => {
  try {
    const { id_solicitud, id_user } = info_user

    const reduce = cfdi.Items.reduce((acc, item) => {
      // Sumar el total
      acc.total += parseFloat(item.Total);

      // Sumar el subtotal (sin impuestos)
      acc.subtotal += parseFloat(item.Subtotal);

      // Sumar los impuestos de cada item
      item.Taxes.forEach(tax => {
        acc.impuestos += parseFloat(tax.Total);
      });

      return acc;
    }, { total: 0, subtotal: 0, impuestos: 0 });

    const response = await runTransaction(async (connection) => {
      try {
        console.log(cfdi);
        const response_factura = await crearCfdi(cfdi)

        const id_factura = `fac-${uuidv4()}`;

        const { total, subtotal, impuestos } = reduce

        const query = `
    INSERT INTO facturas ( id_factura, fecha_emision, estado, usuario_creador, total, subtotal, impuestos, id_facturama )
    VALUES (?,?,?,?,?,?,?,?);`;

        const params = [
          id_factura,
          new Date(),
          "Confirmada",
          id_user,
          total,
          subtotal,
          impuestos,
          response_factura.Id
        ];
        const result_creates = await connection.execute(query, params);

        const query2 = `
        UPDATE items i
          JOIN hospedajes h ON i.id_hospedaje = h.id_hospedaje
          JOIN bookings b ON h.id_booking = b.id_booking
        SET i.id_factura = ?
        WHERE b.id_solicitud = ?;`;
        const params2 = [id_factura, id_solicitud];

        const result = await connection.execute(query2, params2);

        const query3 = `
        INSERT INTO facturas_pagos (id_factura, monto_pago, id_pago)
          SELECT ?, ?, p.id_pago
            FROM solicitudes s
              JOIN servicios se ON s.id_servicio = se.id_servicio
              JOIN pagos p ON se.id_servicio = p.id_servicio
            WHERE s.id_solicitud = ?;`;
        const params3 = [id_factura, total, id_solicitud];
        const result2 = await connection.execute(query3, params3);

        return response_factura;
      } catch (error) {
        throw error;
      }
    });

    return {
      success: true,
      ...response
    };
  } catch (error) {
    throw error;
  }
};

const createFacturaCombinada = async ({ cfdi, info_user }) => {
  let connection;
  try {
    const { id_solicitud, id_user, id_items } = info_user;
    const solicitudesArray = Array.isArray(id_solicitud) ? id_solicitud : [id_solicitud];
    const itemsArray = Array.isArray(id_items) ? id_items : [id_items];
    // Calcular totales
    const reduce = cfdi.Items.reduce((acc, item) => {
      acc.total += parseFloat(item.Total);
      acc.subtotal += parseFloat(item.Subtotal);
      item.Taxes.forEach(tax => {
        acc.impuestos += parseFloat(tax.Total);
      });
      return acc;
    }, { total: 0, subtotal: 0, impuestos: 0 });

    const response = await runTransaction(async (conn) => {
      connection = conn;

      // 1. Crear factura en Facturama
      const response_factura = await crearCfdi(cfdi);

      // 2. Generar ID de factura
      const id_factura = `fac-${uuidv4()}`;
      const { total, subtotal, impuestos } = reduce;

      // 3. Insertar factura principal
      const insertFacturaQuery = `
        INSERT INTO facturas (
          id_factura, 
          fecha_emision, 
          estado, 
          usuario_creador, 
          total, 
          subtotal, 
          impuestos, 
          id_facturama
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

      await connection.execute(insertFacturaQuery, [
        id_factura,
        new Date(),
        "Confirmada",
        id_user,
        total,
        subtotal,
        impuestos,
        response_factura.Id
      ]);

      // 4. Actualizar SOLO los items seleccionados
      await connection.execute(
        `UPDATE items SET id_factura = ? WHERE id_item IN (${itemsArray.map(() => '?').join(',')})`,
        [id_factura, ...itemsArray]
      );

      // 5. Insertar registros en facturas_pagos
      await connection.execute(
        `
    INSERT INTO facturas_pagos (
      id_factura, 
      monto_pago, 
      id_pago
    )
    SELECT 
      ? AS id_factura,
      ? AS monto_pago,
      p.id_pago
    FROM 
      solicitudes s
      JOIN servicios se ON s.id_servicio = se.id_servicio
      JOIN pagos p ON se.id_servicio = p.id_servicio
    WHERE 
      s.id_solicitud IN (${solicitudesArray.map(() => '?').join(',')})
      AND p.id_pago IS NOT NULL
  `,
        [id_factura, total, ...solicitudesArray]
      );

      return {
        id_factura,
        ...response_factura
      };
    });

    return {
      success: true,
      data: response
    };
  } catch (error) {
    console.error('Error en createFacturaCombinada:', error);

    // Rollback manual si es necesario
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
    }

    throw {
      error: 'Error al crear factura combinada',
      message: error.message,
      sqlMessage: error.sqlMessage,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
};

const getFacturasConsultas = async (user_id) => {
  try {
    let query = `
SELECT
  facturas.id_factura,
  facturas.fecha_emision,
  facturas.estado,
  facturas.usuario_creador,
  facturas.total AS total_factura,
  facturas.subtotal AS subtotal_factura,
  facturas.impuestos AS impuestos_factura,
  facturas.saldo,
  facturas.created_at AS fecha_creacion_factura,
  facturas.updated_at,
  facturas.id_facturama,
  facturas.rfc,
  facturas.id_empresa,
  empresas.razon_social,
  
  -- JSON con los pagos relacionados a esta factura
  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id_pago', p.id_pago,
        'id_servicio', p.id_servicio,
        'monto', p.monto,
        'monto_a_credito', p.monto_a_credito,
        'responsable_pago_empresa', p.responsable_pago_empresa,
        'responsable_pago_agente', p.responsable_pago_agente,
        'fecha_creacion', p.created_at,
        'pago_por_credito', p.pago_por_credito,
        'pendiente_por_cobrar', p.pendiente_por_cobrar,
        'total', p.total,
        'subtotal', p.subtotal,
        'impuestos', p.impuestos,
        'concepto', p.concepto,
        'referencia', p.referencia,
        'fecha_pago', p.fecha_pago,
        'metodo_de_pago', p.metodo_de_pago,
        'currency', p.currency,
        'tipo_de_pago', p.tipo_de_pago,
        'banco', p.banco,
        'last_digits', p.last_digits
      )
    )
    FROM facturas_pagos fp
    JOIN pagos p ON fp.id_pago = p.id_pago
    WHERE fp.id_factura = facturas.id_factura
  ) AS pagos,
  
  -- JSON con las solicitudes relacionadas a través de los pagos
  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id_solicitud', s.id_solicitud,
        'id_servicio', s.id_servicio,
        'confirmation_code', s.confirmation_code,
        'id_viajero', s.id_viajero,
        'hotel', s.hotel,
        'check_in', s.check_in,
        'check_out', s.check_out,
        'room', s.room,
        'total', s.total,
        'status', s.status,
        'id_usuario_generador', s.id_usuario_generador,
        'nombre_viajero', s.nombre_viajero,
        'solicitud_total', ROUND(s.total, 2),
        'created_at', srv.created_at,
        'nombre_hotel', h.nombre_hotel,
        'codigo_reservacion_hotel', h.codigo_reservacion_hotel,
        'viajero', JSON_OBJECT(
          'id_viajero', v.id_viajero,
          'nombre', v.primer_nombre,
          'apellido_paterno', v.apellido_paterno,
          'apellido_materno', v.apellido_materno,
          'email', v.correo,
          'telefono', v.telefono
        ),
        'is_booking', IF(b.id_solicitud IS NOT NULL, TRUE, FALSE)
      )
    )
    FROM facturas_pagos fp
    JOIN pagos p ON fp.id_pago = p.id_pago
    JOIN servicios srv ON p.id_servicio = srv.id_servicio
    LEFT JOIN solicitudes s ON srv.id_servicio = s.id_servicio
    LEFT JOIN bookings b ON s.id_solicitud = b.id_solicitud
    LEFT JOIN hospedajes h ON b.id_booking = h.id_booking
    LEFT JOIN viajeros v ON s.id_viajero = v.id_viajero
    WHERE fp.id_factura = facturas.id_factura
  ) AS solicitudes

FROM facturas
LEFT JOIN empresas ON facturas.id_empresa = empresas.id_empresa
WHERE facturas.id_factura IN (
  SELECT fp.id_factura
  FROM facturas_pagos fp
  JOIN pagos p ON fp.id_pago = p.id_pago
  JOIN servicios srv ON p.id_servicio = srv.id_servicio
  JOIN solicitudes s ON srv.id_servicio = s.id_servicio
  WHERE facturas.usuario_creador = ?
)
ORDER BY facturas.created_at DESC;`;
    let response = await executeQuery(query, [user_id]);

    return response;
  } catch (error) {
    throw error;
  }
}

const getAllFacturas = async () => {
  try {
    const query = `SELECT 
  id_factura,
  id_facturama,
  fecha_emision,
  estado_factura,
  usuario_creador,
  total_factura,
  subtotal_factura,
  impuestos_factura,
  saldo,
  factura_created_at,
  factura_updated_at,
  factura_rfc,
  metodo_de_pago,
  nombre_agente,
  razon_social,
  GROUP_CONCAT(DISTINCT hotel ORDER BY hotel SEPARATOR ', ') AS hoteles
FROM 
  vista_facturas_pagos
GROUP BY 
  id_factura;`;
    const response = await executeQuery(query);
    console.log(response);
    return response;
  } catch (error) {
    throw error
  }
}

module.exports = {
  createFactura,
  getAllFacturas,
  createFacturaCombinada,
  getFacturasConsultas,
}