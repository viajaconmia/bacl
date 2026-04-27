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
    } = req.body ?? {};

    // Orden exacto del SP: codigo_confirmacion, viajero, nombre_agente, id_booking, proveedor, pagina, limite
    const params = [
      codigo_reservacion || null,
      traveler           || null,
      nombre_agente      || null,
      id_booking         || null,
      hotel              || null,
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
    tipo: body?.tipo,
  });

  if (!connection) {
    throw new Error("Falta la conexión de la transacción en notificado");
  }

  if (!id_booking) {
    throw new Error("Falta id_booking para crear notificación");
  }

  const query = async (sql, params = []) => {
    const [rows] = await connection.query(sql, params);
    return rows;
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
    console.log("⚠️ [NOTIFICADO] No se encontró la reserva en vw_details_booking");
    return {
      creado: false,
      message: "No se encontró la reserva en vw_details_booking",
    };
  }

  const reserva = rows[0];
  const id_relacion = reserva.id_relacion;
  const prefacturado = reserva.prefacturado;
  const id_confirmacion = reserva.id_confirmacion;

  const cambios = obtenerCambios(body) || {};
  const tieneCambios = Object.keys(cambios).length > 0;

  const rowsFacturas = await query(
    `
    SELECT DISTINCT ifa.id_factura
    FROM items_facturas ifa
    INNER JOIN items i
      ON i.id_item = ifa.id_item
    WHERE i.id_relacion = ?
      AND ifa.id_factura IS NOT NULL
    `,
    [id_relacion]
  );

  const idFacturas = rowsFacturas.map((row) => row.id_factura).filter(Boolean);

  let detalle = {
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

  if (prefacturado !== "sin_enviar") {
    detalle.estatus = tieneCambios ? "alterada" : "cancelada";

    // aquí mandas todos los cambios cuando NO es sin_enviar
    detalle.cambios = cambios;
  }

  if (prefacturado === "sin_enviar") {
    const rowsFacturada = await query(
      `
      SELECT 1 AS existe
      FROM items i
      WHERE i.id_relacion = ?
        AND (
          EXISTS (
            SELECT 1
            FROM items_pagos ip
            WHERE ip.id_item = i.id_item
          )
          OR EXISTS (
            SELECT 1
            FROM items_facturas ifa
            WHERE ifa.id_item = i.id_item
          )
        )
      LIMIT 1
      `,
      [id_relacion]
    );

    if (rowsFacturada?.length > 0) {
      detalle.estatus = "facturada";
    } else if (!tieneCambios) {
      detalle.estatus = "cancelada";
    } else {
      detalle.estatus = "alterada";
      detalle.cambios = cambios;
    }
  }

  if (!detalle.estatus) {
    console.log("⚠️ [NOTIFICADO] No se pudo determinar el estatus de la notificación");
    return {
      creado: false,
      message: "No se pudo determinar el estatus de la notificación",
    };
  }

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

module.exports = { read, enviadas, norificaciones, prefacturar, notificado };
