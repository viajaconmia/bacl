const { executeQuery, executeTransaction } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const createPagos = async (datosPago) => {
  try {
    const id_pago = `pag-${uuidv4()}`;
    const query = `
      INSERT INTO pagos
      (
        id_pago, id_servicio, monto_a_credito, responsable_pago_empresa,
        responsable_pago_agente, fecha_creacion, pago_por_credito,
        pendiente_por_cobrar, total, subtotal, impuestos, created_at, updated_at,
        padre, concepto, referencia, fecha_pago, spei, monto, banco,
        autorizacion_stripe, last_digits, fecha_transaccion, currency,
        metodo_de_pago, tipo_de_tarjeta, tipo_de_pago
      ) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

    const params = [
      id_pago,
      datosPago.id_servicio,  // Requerido de la relación con servicios
      datosPago.monto_a_credito || 0.0,  // Campo NOT NULL
      datosPago.responsable_pago_empresa || null,
      datosPago.responsable_pago_agente || null,
      datosPago.fecha_creacion || new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
      datosPago.pago_por_credito || null,
      datosPago.pendiente_por_cobrar || false,
      datosPago.total || null,
      datosPago.subtotal || null,
      datosPago.impuestos || null,
      new Date().toISOString().slice(0, 19).replace('T', ' '), // created_at
      new Date().toISOString().slice(0, 19).replace('T', ' '), // updated_at
      datosPago.padre || null,
      datosPago.concepto || null,
      datosPago.referencia || null,
      datosPago.fecha_pago || null,
      datosPago.spei || null,
      datosPago.monto || null,
      datosPago.banco || null,
      datosPago.autorizacion_stripe || null,
      datosPago.last_digits || null,
      datosPago.fecha_transaccion || new Date().toISOString().split('T')[0],
      datosPago.currency || null,
      datosPago.metodo_de_pago || null,
      datosPago.tipo_de_tarjeta || null,
      datosPago.tipo_de_pago || 'contado'
    ];

    const response = await executeQuery(query, params);
    return ({ success: true });
  } catch (error) {
    throw error;
  }
};

const readPagos = async () => {
  try {
    const query = "SELECT * FROM pagos";
    const response = await executeQuery(query);
    return response;
  } catch (error) {
    throw error;
  }
};

const getPagos = async (id_agente) => {
  try {
    const query = "SELECT * FROM vista_pagos WHERE responsable_pago_agente = ?;";
    const response = await executeQuery(query, [id_agente]);
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
};

const getPendientes = async (id_agente) => {
  try {
    const query = "SELECT * FROM vista_creditos_completos WHERE responsable_pago_agente = ?;";
    const response = await executeQuery(query, [id_agente]);
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
};

const getAllPendientes = async () => {
  try {
    const query = "SELECT * FROM vista_creditos_completos;";
    const response = await executeQuery(query);
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
};

const getCreditoEmpresa = async (body) => {
  try {
    console.log(body)
    const { id_empresa } = body;
    const params = [id_empresa];
    const query = `
    SELECT empresas.id_empresa, empresas.tiene_credito, empresas.monto_credito as monto_credito_empresa, empresas.nombre_comercial, empresas.razon_social, empresas.tipo_persona, agentes.id_agente, agentes.tiene_credito_consolidado,  agentes.monto_credito as monto_credito_agente
    FROM empresas
    JOIN empresas_agentes ON empresas.id_empresa = empresas_agentes.id_empresa
    JOIN agentes ON agentes.id_agente = empresas_agentes.id_agente
    WHERE empresas.id_empresa = 1;`
    const response = await executeQuery(query, params);
    return response;
  } catch (error) {
    throw error;
  }
};

const getCreditoAgente = async (body) => {
  try {
    console.log(body)
    const { id_agente } = body;
    const query = `
      SELECT agentes.id_agente, agentes.nombre, agentes.tiene_credito_consolidado, agentes.monto_credito as monto_credito_agente, empresas.id_empresa, empresas.tiene_credito, empresas.monto_credito as monto_credito_empresa, empresas.nombre_comercial, empresas.razon_social, empresas.tipo_persona
      FROM agentes
      JOIN empresas_agentes ON agentes.id_agente = empresas_agentes.id_agente
      JOIN empresas ON empresas.id_empresa = empresas_agentes.id_empresa
      WHERE agentes.id_agente = ?; `;
    const params = [id_agente];
    const response = await executeQuery(query, params);
    return response;
  } catch (error) {
    throw error;
  }
};

const getCreditoTodos = async () => {
  try {
    const query = `
      SELECT agentes.id_agente, agentes.nombre, agentes.tiene_credito_consolidado, agentes.monto_credito AS monto_credito_agente, empresas.id_empresa, empresas.tiene_credito, empresas.monto_credito as monto_credito_empresa, empresas.nombre_comercial, empresas.razon_social, empresas.tipo_persona
      FROM agentes
      JOIN empresas_agentes ON agentes.id_agente = empresas_agentes.id_agente
      JOIN empresas ON empresas.id_empresa = empresas_agentes.id_empresa;`;
    const response = await executeQuery(query);
    return response;
  } catch (error) {
    throw error;
  }
};

const editCreditoEmpresa = async (body) => {
  try {
    const { id, credit } = body;
    const query = `UPDATE empresas SET monto_credito = ?, tiene_credito = ? WHERE id_empresa = ?`;
    const params = [credit, (credit > 0), id]
    const response = await executeQuery(query, params);
    return response;
  } catch (error) {
    throw error;
  }
}
const editCreditoAgente = async (body) => {
  try {
    const { id, credit } = body;
    const query = `UPDATE agentes SET monto_credito = ?, tiene_credito_consolidado = ? WHERE id_agente = ?`;
    const params = [credit, (credit > 0), id]
    const response = await executeQuery(query, params);
    return response;
  } catch (error) {
    throw error;
  }
}

const getAllPagos = async () => {
  try {
    const query = `SELECT * from vw_pagos_general`;
    const response = await executeQuery(query);
    //console.log(query);
    return response;
  } catch (error) {
    throw error;
  }
};

const pagoConCredito = async (body) => {
  try {
    const {
      id_servicio,
      monto_a_credito,
      responsable_pago_empresa,
      responsable_pago_agente,
      fecha_creacion,
      pago_por_credito,
      pendiente_por_cobrar,
      total,
      subtotal,
      impuestos,
      concepto,
      credito_restante,
      currency = "mxn",
      tipo_de_pago = "credito"
    } = body;

    const id_credito = `cre-${uuidv4()}`;

    const query = `
    INSERT INTO pagos_credito 
    (
      id_credito, id_servicio, monto_a_credito, responsable_pago_empresa,
      responsable_pago_agente, fecha_creacion, pago_por_credito,
      pendiente_por_cobrar, total, subtotal, impuestos, 
      concepto, currency, tipo_de_pago
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      id_credito,
      id_servicio,
      monto_a_credito,
      responsable_pago_empresa || null,
      responsable_pago_agente,
      fecha_creacion,
      pago_por_credito,
      pendiente_por_cobrar,
      total,
      subtotal,
      impuestos,
      concepto,
      currency,
      tipo_de_pago
    ];

    const response = await executeTransaction(query, params, async (result, connection) => {
      console.log("Pago a crédito registrado en pagos_credito");

      // Actualizar el crédito disponible del agente
      const query2 = "UPDATE agentes SET monto_credito = ? WHERE id_agente = ?;";
      const params2 = [credito_restante, responsable_pago_agente];

      try {
        await connection.execute(query2, params2);
        console.log("Crédito del agente actualizado");

        return { success: true, id_credito };
      } catch (error) {
        throw error;
      }
    });

    return { success: true, id_credito };
  } catch (error) {
    console.error("Error en pagoConCredito:", error);
    throw error;
  }
}

const getPagosConsultas = async (user_id) => {
  try {
    let query = `
SELECT
  pagos.id_pago,
  pagos.id_servicio,
  pagos.monto,
  pagos.monto_a_credito,
  pagos.responsable_pago_empresa,
  pagos.responsable_pago_agente,
  pagos.created_at AS fecha_creacion,
  pagos.pago_por_credito,
  pagos.pendiente_por_cobrar,
  pagos.total,
  pagos.subtotal,
  pagos.impuestos,
  pagos.updated_at,
  pagos.padre,
  pagos.concepto,
  pagos.referencia,
  pagos.fecha_pago,
  pagos.spei,
  pagos.banco,
  pagos.autorizacion_stripe,
  pagos.last_digits,
  pagos.fecha_transaccion,
  pagos.currency,
  pagos.metodo_de_pago,
  pagos.tipo_de_tarjeta,
  pagos.tipo_de_pago,

  -- JSON con los datos de la solicitud correspondiente
  (
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
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
    ))
    FROM solicitudes s
    LEFT JOIN servicios srv ON s.id_servicio = srv.id_servicio
    LEFT JOIN bookings b ON s.id_solicitud = b.id_solicitud
    LEFT JOIN hospedajes h ON b.id_booking = h.id_booking
    LEFT JOIN viajeros v ON s.id_viajero = v.id_viajero
    WHERE s.id_servicio = pagos.id_servicio
    LIMIT 1
  ) AS solicitud,

  -- JSON con las facturas ligadas a este pago
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
    FROM facturas_pagos fp
    JOIN facturas f ON fp.id_factura = f.id_factura
    JOIN empresas e ON f.id_empresa = e.id_empresa
    WHERE fp.id_pago = pagos.id_pago
  ) AS facturas

FROM pagos
JOIN servicios ON pagos.id_servicio = servicios.id_servicio
WHERE pagos.id_servicio IN (
  SELECT id_servicio
  FROM solicitudes
  WHERE id_usuario_generador = ?
)
ORDER BY pagos.created_at DESC;`;
    let response = await executeQuery(query, [user_id]);

    return response;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  createPagos,
  readPagos,
  getCreditoAgente,
  getCreditoEmpresa,
  getCreditoTodos,
  editCreditoAgente,
  editCreditoEmpresa,
  pagoConCredito,
  getPagos,
  getPendientes,
  getAllPendientes,
  getAllPagos,
  getPagosConsultas,
};
