const model = require("../model/pagos");
const { v4: uuidv4 } = require("uuid");
const { executeSP, runTransaction } = require("../../../config/db");
const create = async (req, res) => {
  try {
    const response = await model.createPagos(req.body);
    res
      .status(201)
      .json({ message: "Pago creados correctamente", data: response });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const read = async (req, res) => {
  try {
    const datosFiscales = await model.readPagos();
    res.status(200).json(datosFiscales);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getPagosAgente = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const pagos = await model.getPagos(id_agente);
    res.status(200).json(pagos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getAllPagos = async (req, res) => {
  try {
    const pagos = await model.getAllPagos();
    res.status(200).json(pagos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const readConsultas = async (req, res) => {
  try {
    const { user_id } = req.query;
    let solicitudes = await model.getPagosConsultas(user_id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const getPendientesAgente = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const pagos = await model.getPendientes(id_agente);
    res.status(200).json(pagos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getAllPendientes = async (req, res) => {
  try {
    const pagos = await model.getAllPendientes();
    res.status(200).json(pagos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const getEmpresaCredito = async (req, res) => {
  try {
    const response = await model.getCreditoEmpresa(req.query);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const getAgenteCredito = async (req, res) => {
  try {
    const response = await model.getCreditoAgente(req.query);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const getAgenteAgentesYEmpresas = async (req, res) => {
  try {
    const response = await model.getCreditoTodos();
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const updateCreditAgent = async (req, res) => {
  try {
    const response = await model.editCreditoAgente(req.body);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const updateCreditEmpresa = async (req, res) => {
  try {
    const response = await model.editCreditoEmpresa(req.body);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const pagoPorCredito = async (req, res) => {
  try {
    const response = await model.pagoConCredito(req.body);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const pagoPorSaldoAFavor = async (req, res) => {
  try {
    const { SaldoAFavor, items_seleccionados } = req.body;
    if (!SaldoAFavor || !Array.isArray(items_seleccionados)) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    // 1️⃣ Un pago por servicio
    const pagosPorServicio = {};
    items_seleccionados.forEach((item) => {
      if (!pagosPorServicio[item.id_servicio]) {
        pagosPorServicio[item.id_servicio] = `pag-${uuidv4()}`;
      }
    });

    // 2️⃣ Inyectar id_pago en cada item
    const itemsConPago = items_seleccionados.map((item) => ({
      ...item,
      id_pago: pagosPorServicio[item.id_servicio],
    }));

    // 3️⃣ Montos para la respuesta
    const montoAplicado = itemsConPago.reduce(
      (sum, it) => sum + (it.saldo - it.saldonuevo),
      0
    );
    const nuevoSaldo = SaldoAFavor.saldo;

    // 4️⃣ Llamada al SP (12 parámetros)
    await executeSP("sp_asignar_saldosAF_a_pagos", [
      SaldoAFavor.id_saldos, // 1
      SaldoAFavor.id_agente, // 2
      SaldoAFavor.metodo_pago, // 3
      SaldoAFavor.fecha_pago, // 4
      SaldoAFavor.concepto, // 5
      SaldoAFavor.referencia, // 6
      SaldoAFavor.currency, // 7
      SaldoAFavor.tipo_tarjeta, // 8
      SaldoAFavor.link_stripe, // 9
      SaldoAFavor.ult_digits ?? null, // 10
      JSON.stringify(itemsConPago), // 11 p_items_json
      nuevoSaldo, // 12 p_nuevo_saldo
    ]);

    res.json({
      success: true,
      ids_pagos: Object.values(pagosPorServicio),
      monto_aplicado: montoAplicado,
      nuevo_saldo: nuevoSaldo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error al aplicar pagos",
      error: err.message,
    });
  }
};

const crearItemdeAjuste = async (req, res) => {
  try {
    const response = await runTransaction(async (connection) => {
      try {
        await connection.beginTransaction();

        // 0) Preparar datos
        const id_item_ajuste = "ite-" + uuidv4();
        const {
          updatedItem,
          updatedSaldos,
          diferencia,
          precioActualizado,
          id_booking,
          id_servicio,
        } = req.body;

        updatedItem.id_item = id_item_ajuste;

        // 1) Insertar el item de ajuste
        await connection.query(
          `INSERT INTO items (
         id_item, id_catalogo_item, id_factura,
         total, subtotal, impuestos, is_facturado,
         fecha_uso, id_hospedaje,
         created_at, updated_at,
         costo_total, costo_subtotal, costo_impuestos,
         saldo, costo_iva, is_ajuste
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            updatedItem.id_item,
            updatedItem.id_catalogo_item,
            updatedItem.id_factura,
            updatedItem.total,
            updatedItem.subtotal,
            updatedItem.impuestos,
            updatedItem.is_facturado,
            updatedItem.fecha_uso,
            updatedItem.id_hospedaje,
            updatedItem.created_at,
            updatedItem.updated_at,
            updatedItem.costo_total,
            updatedItem.costo_subtotal,
            updatedItem.costo_impuestos,
            updatedItem.saldo,
            updatedItem.costo_iva,
            updatedItem.is_ajuste,
          ]
        );

        // 2) Actualizar servicios
        await connection.query(
          `UPDATE servicios
         SET total     = total + ?,
             impuestos = (total + ?) * 0.16,
             subtotal  = (total + ?) - ((total + ?) * 0.16)
       WHERE id_servicio = ?`,
          [diferencia, diferencia, diferencia, diferencia, id_servicio]
        );

        // 3) Actualizar bookings
        await connection.query(
          `UPDATE bookings
         SET total     = ?,
             impuestos = ? * 0.16,
             subtotal  = ? - (? * 0.16)
       WHERE id_booking = ?`,
          [
            precioActualizado,
            precioActualizado,
            precioActualizado,
            precioActualizado,
            id_booking,
          ]
        );

        // 4) Actualizar saldos a favor
        for (const saldoObj of updatedSaldos) {
          // parseo de fecha (ISO o YYYY-MM-DD)
          const fechaCreacion =
            saldoObj.fecha_creacion.length === 10
              ? `${saldoObj.fecha_creacion} 00:00:00`
              : new Date(saldoObj.fecha_creacion)
                  .toISOString()
                  .slice(0, 19)
                  .replace("T", " ");

          const activo = saldoObj.saldo <= 0 ? 0 : 1;

          await connection.query(
            `UPDATE saldos_a_favor
           SET fecha_creacion = ?,
               saldo          = ?,
               activo         = ?
         WHERE id_saldos = ?`,
            [fechaCreacion, saldoObj.saldo, activo, saldoObj.id_saldos]
          );
        }

        // 5) Registrar pagos e items_pagos
        const idsPagos = [];
        for (const saldoObj of updatedSaldos) {
          const id_pago = "pag-" + uuidv4();
          idsPagos.push(id_pago);

          // parseo de fecha de pago
          const fechaPago =
            saldoObj.fecha_pago.length === 10
              ? `${saldoObj.fecha_pago} 00:00:00`
              : new Date(saldoObj.fecha_pago)
                  .toISOString()
                  .slice(0, 19)
                  .replace("T", " ");

          // insertar en pagos
          await connection.query(
            `INSERT INTO pagos (
           id_pago, id_servicio, id_saldo_a_favor, id_agente,
           metodo_de_pago, fecha_pago, concepto, referencia,
           currency, tipo_de_tarjeta, link_pago, last_digits, total
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id_pago,
              id_servicio,
              saldoObj.id_saldos,
              saldoObj.id_agente,
              saldoObj.metodo_pago,
              fechaPago,
              saldoObj.concepto,
              saldoObj.referencia,
              saldoObj.currency,
              saldoObj.tipo_tarjeta,
              saldoObj.link_stripe,
              saldoObj.ult_digits,
              saldoObj.monto_cargado_al_item,
            ]
          );

          // insertar en items_pagos
          await connection.query(
            `INSERT INTO items_pagos (id_pago, id_item, monto)
         VALUES (?, ?, ?)`,
            [id_pago, id_item_ajuste, saldoObj.monto_cargado_al_item]
          );
        }

        await connection.commit();

        // 6) Devolver IDs de pagos creados
        return {
          message: "Item de ajuste creado correctamente",
          item_creado: id_item_ajuste,
          ids_pagos_creados: idsPagos,
        };
      } catch (error) {
        console.error(error);
        throw error; // Lanzar error para que se maneje en el bloque catch
      }
    });
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false, message: "Error al crear el item de ajuste",
      error: error.message || "Error desconocido",
  })
};
}
module.exports = {
  create,
  read,
  getAgenteCredito,
  getEmpresaCredito,
  getAgenteAgentesYEmpresas,
  updateCreditAgent,
  updateCreditEmpresa,
  pagoPorCredito,
  getPagosAgente,
  getPendientesAgente,
  getAllPendientes,
  getAllPagos,
  readConsultas,
  pagoPorSaldoAFavor,
  crearItemdeAjuste,
};
