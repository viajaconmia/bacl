const { executeQuery, executeSP2 } = require("../../../config/db");

function extractFilters(body) {
  const {
    pag = 1,
    cant = 50,
    id_agente = null,
    nombre_agente = null,
    hotel = null,
    codigo_reservacion = null,
    traveler = null,
    tipo_hospedaje = null,
  } = body ?? {};

  return {
    pag: Number(pag) || 1,
    cant: Number(cant) || 50,
    id_agente: id_agente || null,
    nombre_agente: nombre_agente || null,
    hotel: hotel || null,
    codigo_reservacion: codigo_reservacion || null,
    traveler: traveler || null,
    tipo_hospedaje: tipo_hospedaje || null,
  };
}

const read = async (req, res) => {
  try {
    const { pag, cant, id_agente, nombre_agente, hotel, codigo_reservacion, traveler, tipo_hospedaje } = extractFilters(req.body);
    const response = await executeSP2("sp_vw_new_reservas_paginado_sin_enviar", [pag, cant, id_agente, nombre_agente, hotel, codigo_reservacion, traveler, tipo_hospedaje]);
    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener avisos de reservas", details: error.message });
  }
};

const enviadas = async (req, res) => {
  try {
    const { pag, cant, id_agente, nombre_agente, hotel, codigo_reservacion, traveler, tipo_hospedaje } = extractFilters(req.body);
    const response = await executeSP2("sp_vw_new_reservas_paginado", [pag, cant, id_agente, nombre_agente, hotel, codigo_reservacion, traveler, tipo_hospedaje]);
    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener avisos de reservas", details: error.message });
  }
};

const norificaciones = async (req, res) => {
  try {
    const {
      pag = 1,
      cant = 50,
      nombre_agente = null,
      hotel = null,            // → p_proveedor
      codigo_reservacion = null, // → p_codigo_confirmacion
      traveler = null,         // → p_viajero
      id_booking = null,
      atendida,
    } = req.body ?? {};

    const atendidaParam = (atendida === null || atendida === undefined || atendida === "")
      ? null
      : Number(atendida);

    // Orden exacto del SP: codigo_confirmacion, viajero, nombre_agente, id_booking, proveedor, atendida, pagina, limite
    const params = [
      codigo_reservacion || null,
      traveler           || null,
      nombre_agente      || null,
      id_booking         || null,
      hotel              || null,
      atendidaParam,
      Number(pag)  || 1,
      Number(cant) || 50,
    ];

    const response = await executeSP2("sp_get_notificadas_reservas", params);
    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener avisos de reservas", details: error.message });
  }
};

const facturacion = async (req, res) => {
  try {
    const { id_factura, id_relacion } = req.body;

    console.log(req.body, "✅✅✅");

    if (!id_factura || !id_relacion) {
      return res.status(400).json({
        error: "Faltan parámetros",
        details: "id_factura e id_relacion son obligatorios",
      });
    }

    const params = [id_factura, id_relacion];

    const response = await executeSP2("sp_get_factura_reserva", params);

    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al obtener factura de reserva",
      details: error.message,
    });
  }
};

// controllers/notificadas.controller.js


const normalizarValor = (valor) => {
  if (valor === undefined) return null;
  if (valor === "") return null;
  return valor;
};

const obtenerCambios = (body) => {
  const cambios = {};

  for (const [campo, valor] of Object.entries(body)) {
    if (
      valor &&
      typeof valor === "object" &&
      "before" in valor &&
      "current" in valor
    ) {
      const before = normalizarValor(valor.before);
      const current = normalizarValor(valor.current);

      if (JSON.stringify(before) !== JSON.stringify(current)) {
        cambios[campo] = {
          anterior: before,
          nuevo: current,
        };
      }
    }

    if (
      valor &&
      typeof valor === "object" &&
      valor.before &&
      valor.current &&
      typeof valor.before === "object" &&
      typeof valor.current === "object"
    ) {
      const subCambios = {};

      for (const key of Object.keys(valor.current)) {
        const before = normalizarValor(valor.before?.[key]);
        const current = normalizarValor(valor.current?.[key]);

        if (JSON.stringify(before) !== JSON.stringify(current)) {
          subCambios[key] = {
            anterior: before,
            nuevo: current,
          };
        }
      }

      if (Object.keys(subCambios).length > 0) {
        cambios[campo] = subCambios;
      }
    }
  }

  return cambios;
};

const notificado = async ({ connection, id_booking, body, id_user }) => {
  console.log("📢 [NOTIFICADO] Entró a la función notificado", {
    id_booking,
    id_user,
    body,
    tieneConnection: !!connection,
  });

  if (!id_booking) {
    throw new Error("Falta id_booking para crear notificación");
  }

  const query = async (sql, params = []) => {
    if (connection) {
      const [rows] = await connection.query(sql, params);
      return rows;
    }
    return await executeQuery(sql, params);
  };

  const rows = await query(
    `
    SELECT 
      id_relacion,
      id_booking,
      prefacturado,
      id_confirmacion
    FROM vw_details_booking
    WHERE id_booking = ?
    LIMIT 1
    `,
    [id_booking]
  );

  if (!rows || rows.length === 0) {
    console.log("⚠️ [NOTIFICADO] No se encontró la reserva en vw_details_booking", {
      id_booking,
      body,
    });

    return {
      creado: false,
      message: "No se encontró la reserva en vw_details_booking",
    };
  }

  const reserva = rows[0];
  const id_relacion = reserva.id_relacion;
  const prefacturado = reserva.prefacturado;
  const id_confirmacion = reserva.id_confirmacion;

  const esSinEnviar =
    prefacturado === "sin_enviar" || prefacturado === "sin enviar";

  const rowsFacturada = await query(
    `
    SELECT DISTINCT id_factura
    FROM items_facturas
    WHERE id_relacion IN (
      SELECT id_relacion
      FROM vw_details_booking
      WHERE id_booking = ?
    )
      AND id_factura IS NOT NULL
    `,
    [id_booking]
  );

  if (esSinEnviar && (!rowsFacturada || rowsFacturada.length === 0)) {
    console.log("⚠️ [NOTIFICADO] sin_enviar sin relación en items_facturas, no se inserta", {
      id_booking,
      id_relacion,
      prefacturado,
      body,
    });

    return {
      creado: false,
      message:
        "Reserva sin_enviar sin relación en items_facturas, no se genera notificación",
    };
  }

  // Toma cambios detectados por la función y también los que vengan directamente en body.cambios
  const cambiosDetectados = obtenerCambios(body) || {};
  const cambiosBody =
    body?.cambios && typeof body.cambios === "object" ? body.cambios : {};

  const cambios = {
    ...cambiosDetectados,
    ...cambiosBody,
  };

  const tieneCambios = Object.keys(cambios).length > 0;

  console.log("📝 [NOTIFICADO] Cambios detectados", {
    cambiosDetectados,
    cambiosBody,
    cambiosFinales: cambios,
    tieneCambios,
  });

  const idFacturas = rowsFacturada
    .map((row) => row.id_factura)
    .filter(Boolean);

  const detalle = {
    tipo: body?.tipo || (tieneCambios ? "reserva_editada" : "reserva_cancelada"),
    prefacturado,
    id_confirmacion,
  };

  if (idFacturas.length === 1) {
    detalle.id_factura = idFacturas[0];
  }

  if (idFacturas.length > 1) {
    detalle.id_facturas = idFacturas;
  }

  // Agrega siempre los cambios al detalle si sí llegaron
  if (tieneCambios) {
    detalle.cambios = cambios;
  }

  if (esSinEnviar) {
    if (rowsFacturada?.length > 0) {
      detalle.estatus = "facturada";
    } else if (!tieneCambios) {
      detalle.estatus = "cancelada";
    } else {
      detalle.estatus = "alterada";
    }
  } else {
    if (!tieneCambios) {
      detalle.estatus = "cancelada";
    } else {
      detalle.estatus = "alterada";
    }
  }

  if (!detalle.estatus) {
    console.log("⚠️ [NOTIFICADO] No se pudo determinar el estatus de la notificación", {
      body,
      detalle,
    });

    return {
      creado: false,
      message: "No se pudo determinar el estatus de la notificación",
    };
  }

  console.log("📦 [NOTIFICADO] Detalle final antes de insertar", {
    id_relacion,
    id_booking: reserva.id_booking,
    detalle,
    body,
  });

  await query(
    `
    INSERT INTO notificadas (
      id_relacion,
      id_booking,
      detalle,
      id_user_creat,
      created_at,
      update_at
    )
    VALUES (?, ?, CAST(? AS JSON), ?, NOW(), NOW())
    `,
    [
      id_relacion,
      reserva.id_booking,
      JSON.stringify(detalle),
      id_user,
    ]
  );

  console.log("✅ [NOTIFICADO] Notificación insertada correctamente", {
    id_relacion,
    id_booking: reserva.id_booking,
    estatus: detalle.estatus,
    id_confirmacion,
    idFacturas,
    cambios,
    body,
    detalle,
  });

  return {
    creado: true,
    id_relacion,
    id_booking: reserva.id_booking,
    detalle,
  };
};
// notificado se exporta junto con el resto al final del archivo

const prefacturar = async (req, res) => {
  try {
    const { user } = req.session;
    const id_user = user.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: "El payload debe traer un arreglo 'ids' con al menos un registro",
      });
    }

    const resultados = [];

    for (const item of ids) {
      const { id_relacion, id_booking } = item;

      if (!id_relacion || !id_booking) {
        resultados.push({
          id_relacion,
          id_booking,
          error: "Faltan id_relacion o id_booking",
        });
        continue;
      }

      const response = await executeSP2("sp_prefacturar", [
        id_relacion,
        id_booking,
        id_user,
      ]);

      resultados.push({
        id_relacion,
        id_booking,
        response,
      });
    }

    return res.status(200).json({
      message: "Proceso ejecutado correctamente",
      resultados,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al marcar como prefacturada",
      details: error.message,
    });
  }
};

const marcarAtendida = async (id_notificacion, id_user) => {
  if (!id_notificacion) return;

  return executeQuery(
    `
    UPDATE notificadas
    SET 
      atendida = 1,
      id_user_update = ?,
      atendida_at = NOW()
    WHERE id_notificacion = ?
    `,
    [id_user, id_notificacion]
  );
};

const getIdUser = (req) => {
  return req.session?.user?.id;
};

const getPrimeraNotificacion = (req) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return null;
  }

  return ids[0];
};

const atendida = async (req, res) => {
  try {
    const id_user = getIdUser(req);
    const item = getPrimeraNotificacion(req);

    if (!item) {
      return res.status(400).json({
        error: "El payload debe traer un arreglo 'ids'",
      });
    }

    const { id_notificacion } = item;

    if (!id_notificacion) {
      return res.status(400).json({
        error: "Falta id_notificacion",
      });
    }

    const result = await marcarAtendida(id_notificacion, id_user);

    return res.status(200).json({
      message: "Notificación marcada como atendida",
      id_notificacion,
      affectedRows: result.affectedRows,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al marcar como atendida",
      details: error.message,
    });
  }
};

const aprobar = async (req, res) => {
  try {
    const id_user = getIdUser(req);
    const item = getPrimeraNotificacion(req);

    if (!item) {
      return res.status(400).json({
        error: "El payload debe traer un arreglo 'ids'",
      });
    }

    const { id_notificacion } = item;

    if (!id_notificacion) {
      return res.status(400).json({
        error: "Falta id_notificacion",
      });
    }

    await marcarAtendida(id_notificacion, id_user);

    return res.status(200).json({
      message: "Aprobado correctamente",
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al aprobar",
      details: error.message,
    });
  }
};

const desligar = async (req, res) => {
  try {
    const id_user = getIdUser(req);
    const item = getPrimeraNotificacion(req);

    if (!item) {
      return res.status(400).json({
        error: "El payload debe traer un arreglo 'ids'",
      });
    }

    const { id_relacion, id_factura, id_notificacion } = item;

    if (!id_relacion || !id_factura) {
      return res.status(400).json({
        error: "id_relacion e id_factura son requeridos",
      });
    }

    if (!id_notificacion) {
      return res.status(400).json({
        error: "Falta id_notificacion",
      });
    }

    await executeQuery(
      `
      DELETE FROM items_facturas 
      WHERE id_relacion = ? 
        AND id_factura = ?
      `,
      [id_relacion, id_factura]
    );

    await executeQuery(
      `
      UPDATE facturas
      SET saldo_x_aplicar_items = (
        SELECT IFNULL(SUM(monto), 0.00)
        FROM items_facturas
        WHERE id_factura = ?
      )
      WHERE id_factura = ?
      `,
      [id_factura, id_factura]
    );

    await marcarAtendida(id_notificacion, id_user);

    return res.status(200).json({
      message: "Desligado correctamente",
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al desligar",
      details: error.message,
    });
  }
};

const generar_layaut = async (req, res) => {
  try {
    const { id_relaciones, id_agente } = req.body;

    if (!id_relaciones || !id_agente) {
      return res.status(400).json({ error: "id_relaciones y id_agente son requeridos" });
    }

    const idsArray = Array.isArray(id_relaciones) ? id_relaciones : [id_relaciones];

    if (idsArray.length === 0) {
      return res.status(400).json({ error: "id_relaciones no puede estar vacío" });
    }

    const placeholders = idsArray.map(() => "?").join(",");

    const reservas = await executeQuery(
      `SELECT
        proveedor AS HOTEL,
        nombre_viajero as viajero,
        \`CHECK_IN\`,
        \`CHECK_OUT\`,
        tipo_cuarto_vuelo AS HABITACION,
        TOTAL,
        metodo_pago AS \`METODO DE PAGO\`
      FROM vw_details_booking
      WHERE id_relacion IN (${placeholders})`,
      idsArray
    );

    const agenteRows = await executeQuery(
      `SELECT nombre_comercial AS nombre FROM agente_details WHERE id_agente = ? LIMIT 1`,
      [id_agente]
    );

    const facturasRows = await executeQuery(
      `SELECT itf.id_factura, f.url_pdf, f.url_xml, f.id_facturama
       FROM items_facturas itf
       LEFT JOIN facturas f ON f.id_factura = itf.id_factura
       WHERE itf.id_relacion IN (${placeholders})
         AND itf.id_factura IS NOT NULL`,
      idsArray
    );

    return res.status(200).json({
      reservas: reservas ?? [],
      agente: agenteRows?.[0] ?? null,
      facturas: facturasRows ?? [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al generar layout", details: error.message });
  }
};


const validar_items = async (req, res) => {
  try {
    const id_relacion =
      req.id_relacion ||
      req.body?.id_relacion ||
      req.params?.id_relacion ||
      req.query?.id_relacion;

    if (!id_relacion) {
      return res.status(400).json({
        error: "Falta id_relacion",
      });
    }

    const query = `
      SELECT
        i.id_item,
        i.id_relacion,
        i.total,
        i.estado,

        COALESCE(si.total_facturado, 0) AS total_facturado,
        COALESCE(si.total_pagado, 0) AS total_pagado,
        COALESCE(si.saldo_restante, i.total) AS saldo_restante,

        CASE
          WHEN ROUND(COALESCE(si.total, i.total), 2) = ROUND(COALESCE(si.total_pagado, 0), 2)
            THEN 'DIFERENCIA_YA_PAGADA'

          WHEN ROUND(COALESCE(si.total, i.total), 2) = ROUND(COALESCE(si.total_facturado, 0), 2)
            THEN 'DIFERENCIA_YA_FACTURADA'

          ELSE 'DISPONIBLE'
        END AS validacion

      FROM items i

      LEFT JOIN saldo_items si
        ON si.id_item = i.id_item
       AND si.id_relacion = i.id_relacion

      WHERE i.id_relacion = ?
        AND i.estado != 0;
    `;

    const rows = await executeQuery(query, [id_relacion]);

    const items = Array.isArray(rows) ? rows : rows?.[0] || [];

    const itemsYaPagados = items.filter(
      (item) => item.validacion === "DIFERENCIA_YA_PAGADA"
    );

    if (itemsYaPagados.length > 0) {
      return res.status(200).json({
        puede_continuar: false,
        tipo: "DIFERENCIA_YA_PAGADA",
        message: "Diferencia ya pagada",
        id_relacion,
        items: itemsYaPagados,
      });
    }

    const itemsDisponibles = items.filter(
      (item) => item.validacion === "DISPONIBLE"
    );

    return res.status(200).json({
      puede_continuar: itemsDisponibles.length > 0,
      tipo: itemsDisponibles.length > 0 ? "DISPONIBLE" : "SIN_ITEMS_DISPONIBLES",
      message:
        itemsDisponibles.length > 0
          ? "Items disponibles"
          : "No hay items disponibles",
      id_relacion,
      items: itemsDisponibles,
      total_items: itemsDisponibles.length,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al traer items",
      details: error.message,
    });
  }
};

module.exports = { read, enviadas, norificaciones, prefacturar, notificado, facturacion, atendida, aprobar, desligar, generar_layaut,validar_items };
