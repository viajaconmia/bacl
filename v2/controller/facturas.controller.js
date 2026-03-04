const { cancelarCfdi, getCfdi } = require("../../api/v1/model/facturamaModel");
const { executeQuery, runTransaction } = require("../../config/db");
const { isSameMonth } = require("../../lib/utils/calculates");


const obtenerFacturaById = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req.session;
    const [factura] = await executeQuery(
      `SELECT * 
  FROM facturas 
  WHERE id_factura = ?`,
      [id],
    );
    const cfdi = await getCfdi(factura.id_facturama, "issued");

    return res.status(200).json({ message: "Factura obtenida correctamente", data: cfdi });
  } catch (error) {
    console.log(error);
    return res
      .status(error.status || error.statusCode || 500)
      .json({ message: error.message || "Error al obtener la factura" });
  }
};
const cancelarFacturaById = async (req, res) => {
  try {
    const { motive, type, comentarios, force = false } = req.query;
    const { id } = req.params;
    const { permisos, user } = req.session;
    const hasPermiso =
      permisos["facturacion.cancelacion.facturas_meses_pasados"];

    const [factura] = await executeQuery(
      "SELECT * FROM facturas where id_factura = ? and id_facturama is not null",
      [id],
    );
    if (!factura) {
      throw new Error(
        "Esa factura no fue creada en MIA, no se puede cancelar de esa manera",
      );
    }
    if (!isSameMonth(factura.fecha_emision) && !hasPermiso) {
      throw new Error("No se pueden cancelar reservas de otros meses");
    }
    if (!isSameMonth(factura.fecha_emision) && hasPermiso && force == false) {
      return res.status(203).json({
        message: "Requiere validación",
        data: { estado: "required_validation" },
      });
    }

    let acuse = null;
    let message = "Cancelado correctamente";
    await runTransaction(async (conn) => {
      try {
        const response = await cancelarCfdi(factura.id_facturama, motive, type);
        acuse = response?.AcuseXmlBase64;
        message = response.Message;

        await conn.execute(
          `UPDATE facturas set
          canceled_by = ?,
          canceled_time = ?,
          estado = ?,
          canceled_notes = ?
          WHERE id_factura = ?`,
          [
            user.id,
            response.CancelationDate || null,
            "pending",
            // response.Status || null,
            comentarios || null,
            id,
          ],
        );

        await conn.execute(
          `UPDATE facturas set
          request_canceled_time = ?
          WHERE id_factura = ? and request_canceled_time is null`,
          [response.RequestDate || null, id],
        );

        if (response.Status == "canceled") {
          await conn.query(deleteItemsFacturasSQL, [id]);
          await conn.query(deleteSaldos, [id]);
          await conn.query(updateItemsSQL, [id]);
        }
      } catch (error) {
        throw error;
      }
    });

    return res.status(200).json({ message, data: acuse });
  } catch (error) {
    console.log(error);
    return res
      .status(error.status || error.statusCode || 500)
      .json({ message: error.message || "Error al cancelar la factura" });
  }
};

const deleteItemsFacturasSQL = `
DELETE FROM items_facturas
WHERE id_factura = ?`;

const updateItemsSQL = `
UPDATE items
SET id_factura = ""
WHERE id_factura = ?`;

const deleteSaldos = ` DELETE FROM facturas_pagos_y_saldos
WHERE id_factura = ?`;

module.exports = { cancelarFacturaById, obtenerFacturaById };
