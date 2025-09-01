const {
  executeSP,
  executeQuery,
  executeTransaction,
} = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
let model = require("../model/solicitud");

const create = async (req, res) => {
  try {
    let response = await model.createSolicitudes(req.body);
    res
      .status(201)
      .json({ message: "Solicitud created successfully", data: response });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const read = async (req, res) => {
  try {
    let filters = req.query;
    let solicitudes = await model.getSolicitudes(filters);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const readClient = async (req, res) => {
  const { user_id } = req.query;
  req.context.logStep(
    "Llegando al endpoint de readClient con user_id:",
    user_id
  );
  try {
    const result = await executeSP(
      "sp_get_solicitudes_con_pagos_con_facturas_by_id_agente",
      [user_id]
    );
    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No se encontraron solicitudes" });
    } else {
      res
        .status(200)
        .json({ message: "Solicitudes obtenidas correctamente", data: result });
    }
  } catch (error) {
    console.error(error);
    req.context.logStep("Error en la ejecucion del SP", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const readSolicitudById = async (req, res) => {
  req.context.logStep("Llegando al endpoint de readSolicitudById");
  const { id } = req.query;
  try {
    const result = await executeSP("sp_get_solicitud_by_id", [id]);
    if (!result || result.length === 0) {
      req.context.logStep("Result vacio");
      return res
        .status(404)
        .json({ message: "No se encontró un detalle para esta solicitud" });
    }
    res.status(200).json({
      message: "Detalle de solicitud obtenido correctamente",
      data: result,
    });
  } catch (error) {
    req.context.logStep("error en la ejecucion del SP", error);
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const readForClient = async (req, res) => {
  try {
    const { id } = req.query;
    console.log("PRUEBA PARA BACKEND HACIA PRUEBAS 😒✌️✌️");
    let solicitudes = await model.readForClient(id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const readSolicitudByIdWithViajero = async (req, res) => {
  try {
    const { id } = req.query;
    let solicitudes = await model.getSolicitudesClientWithViajero(id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};
const getViajeroFromSolicitud = async (req, res) => {
  try {
    const { id } = req.query;
    let solicitudes = await model.getViajeroSolicitud(id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const getViajeroAgenteFromSolicitud = async (req, res) => {
  try {
    const { id } = req.query;
    let solicitudes = await model.getViajeroAgenteSolicitud(id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const readConsultas = async (req, res) => {
  try {
    const { user_id } = req.query;
    let solicitudes = await model.getSolicitudesConsultas(user_id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const getItemsSolicitud = async (req, res) => {
  try {
    const { id_solicitud } = req.query;
    let solicitudes = await model.getItemsSolicitud(id_solicitud);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const filtro_solicitudes_y_reservas = async (req, res) => {
  req.context.logStep("Llegando al endpoint de filtro_solicitudes_y_reservas");
  const {
    codigo,
    start_date,
    end_date,
    hotel,
    id_cliente,
    cliente,
    nombre_viajero,
    etapa_reservacion,
    status_reservacion,
    tipo_reservante,
    metodo_pago,
    criterio_filtro,
  } = req.body;
  const { p_criterio } = req.query;
  console.log("recuperando criterio", p_criterio);
  try {
    const result = await executeSP("sp_filtrar_solicitudes_y_reservas", [
      codigo,
      start_date,
      end_date,
      hotel,
      id_cliente,
      cliente,
      nombre_viajero,
      etapa_reservacion,
      status_reservacion,
      tipo_reservante,
      metodo_pago,
      criterio_filtro,
      criterio,
    ]);
    req.context.logStep("parametros enviados al SP", {
      codigo,
      start_date,
      end_date,
      hotel,
      id_cliente,
      cliente,
      nombre_viajero,
      etapa_reservacion,
      status_reservacion,
      tipo_reservante,
      metodo_pago,
      criterio_filtro,
      criterio,
    });
    if (!result || result.length === 0) {
      req.context.logStep("Result vacio");
      return res.status(404).json({
        message: "No se encontraron resultados para los filtros proporcionados",
        data: [],
      });
    } else {
      res.status(200).json({
        message: "Resultados obtenidos correctamente",
        data: result,
      });
    }
  } catch (error) {
    req.context.logStep("Error en la ejecucion del SP", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const createFromCartWallet = async (req, res) => {
  try {
    const { items, id_agente, total } = req.body;

    // --- Validaciones de entrada ---
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "items requerido (array no vacío)" });
    }
    if (!id_agente) {
      return res
        .status(400)
        .json({ ok: false, message: "id_agente requerido" });
    }
    const totalNumerico = Number(total);
    if (!Number.isFinite(totalNumerico) || totalNumerico <= 0) {
      return res
        .status(400)
        .json({ ok: false, message: "total inválido (> 0)" });
    }

    // Solo actualizamos solicitudes de items seleccionados
    const itemsSeleccionados = items.filter(
      (i) => i?.selected && i?.details?.id_solicitud
    );
    if (itemsSeleccionados.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "No hay items seleccionados con id_solicitud",
      });
    }

    // --- Transacción ---
    const { resultsCallback } = await executeTransaction(
      "SELECT 1", // query "dummy" para usar tu helper sin modificarla
      [],
      async (_results, connection) => {
        // 1) Bloquear saldos del agente y traerlos ordenados por antigüedad
        const [rowsSaldos] = await connection.execute(
          `
          SELECT
            saf.id_saldos,
            saf.id_agente,
            saf.saldo,
            saf.fecha_pago,
            saf.metodo_pago,
            saf.concepto,
            saf.referencia,
            saf.currency,
            saf.tipo_tarjeta,
            saf.link_stripe,
            saf.ult_digits
          FROM saldos_a_favor saf
          WHERE saf.id_agente = ?
          ORDER BY saf.fecha_pago ASC, saf.id_saldos ASC
          FOR UPDATE
          `,
          [id_agente]
        );

        // 2) Verificar cobertura
        const disponible = rowsSaldos.reduce(
          (acc, r) => acc + Number(r.saldo || 0),
          0
        );
        if (disponible < totalNumerico) {
          // Lanzar error para que haga rollback
          const err = new Error(
            `Fondos insuficientes en wallet. Disponible: ${disponible}, requerido: ${totalNumerico}`
          );
          err.status = 409;
          throw err;
        }

        // 3) Crear id_servicio
        const id_servicio = `ser-${uuidv4()}`;
        const iva = total - total / 1.16;

        console.log("items total", total);

        const queryInsertServicio = ` insert into servicios (
          id_servicio,total,subtotal,impuestos,otros_impuestos,is_credito,
          fecha_limite_pago,created_at,updated_at,id_agente,id_empresa)
          values (?,?,?,?,?,?,?,?,?,?,?)`;
        await connection.execute(queryInsertServicio, [
          id_servicio,
          total,
          // ACA ME QUEDE
          total - iva,
          iva,
          0,
          0,
          null,
          new Date(),
          new Date(),
          id_agente,
          null, // perdirle a luis que lo agregue al body
        ]);

        // 4) Vincular servicio a solicitudes de los items seleccionados
        const queryUpdateSolicitud = `UPDATE solicitudes SET id_servicio = ? WHERE id_solicitud = ?`;
      const query_deactivate_cart = `update cart set active = 0 where  id = ?;`;
        const ids_solicitudes = [];
        for (const it of itemsSeleccionados) {
          await connection.execute(queryUpdateSolicitud, [id_servicio, it.details.id_solicitud]);
          await executeQuery(query_deactivate_cart,[it.id])
          ids_solicitudes.push(it.details.id_solicitud);
          
        }

        // 5) Ir aplicando saldos hasta cubrir el total
        const queryInsertPago = `
          INSERT INTO pagos (
            id_pago,
            id_servicio,
            id_saldo_a_favor,
            id_agente,
            metodo_de_pago,
            fecha_pago,
            concepto,
            referencia,
            currency,
            tipo_de_tarjeta,
            link_pago,
            last_digits,
            total
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;
        const queryUpdateSaldo = `
          UPDATE saldos_a_favor
          SET saldo = saldo - ?,
          activo = CASE WHEN (saldo - ?) <= 0 THEN 0 ELSE 1 END
          WHERE id_saldos = ?
        `;

        let restante = totalNumerico;
        const pagos = [];

        for (const s of rowsSaldos) {
          if (restante <= 0) break;

          const disponibleFila = Number(s.saldo || 0);
          if (disponibleFila <= 0) continue;

          const aplicado = Math.min(disponibleFila, restante);
          const id_pago = `pag-${uuidv4()}`;

          // Insertar pago por el monto aplicado en esta fila de saldo
          await connection.execute(queryInsertPago, [
            id_pago,
            id_servicio,
            s.id_saldos, // id_saldo_a_favor
            id_agente,
            s.metodo_pago || null, // columnas en pagos usan "metodo_de_pago"
            s.fecha_pago || new Date(),
            s.concepto || null,
            s.referencia || null,
            s.currency || "MXN",
            s.tipo_tarjeta || null,
            s.link_stripe || null,
            s.ult_digits || null, // map a last_digits
            total, // total aplicado en este pago
          ]);

          // Descontar saldo aplicado en la fila bloqueada
          console.log("SALDOS", aplicado, s);
          await connection.execute(queryUpdateSaldo, [
            aplicado,
            aplicado,
            s.id_saldos,
          ]);

          pagos.push({ id_pago, id_saldos: s.id_saldos, aplicado });
          restante -= aplicado;
        }

        if (restante > 0) {
          const err = new Error(
            `Fondos quedaron cortos tras aplicar. Restante: ${restante}`
          );
          err.status = 500;
          throw err;
        }

        // Puedes devolver más metadatos si lo necesitas
        return {
          id_servicio,
          pagos,
          ids_solicitudes,
        };
      }
    );

    return res.status(201).json({
      message: "Pagos creados y solicitudes vinculadas",
      data: resultsCallback,
    });
  } catch (error) {
    console.error(error);
    const status = error?.statusCode || error.status || 500;
    return res.status(status).json({
      error: error,
      data: null,
      message: error?.message || "Error interno al crear pagos desde wallet",
    });
  }
};
module.exports = {
  create,
  read,
  readClient,
  readSolicitudById,
  readSolicitudByIdWithViajero,
  getViajeroFromSolicitud,
  getViajeroAgenteFromSolicitud,
  readConsultas,
  getItemsSolicitud,
  readForClient,
  filtro_solicitudes_y_reservas,
  createFromCartWallet,
};
