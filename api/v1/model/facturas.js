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

const getAllFacturas = async () => {
  try {
    const query = "SELECT * FROM vista_facturas_pagos";
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
}