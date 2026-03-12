const { cancelarCfdi, getCfdi } = require("../../api/v1/model/facturamaModel");
const { executeQuery, runTransaction } = require("../../config/db");
const { isSameMonth } = require("../../lib/utils/calculates");

const getFacturas = async (req, res) => {
  try {
    const { estado } = req.query;

    let estados = estado;
    if (!Array.isArray(estado)) {
      estados = [estado];
    }

    const facturas = await executeQuery(
      `SELECT f.*, ad.id_agente, ad.nombre_comercial FROM facturas f
      LEFT JOIN agente_details ad ON ad.id_agente = f.usuario_creador
      WHERE f.estado IN (${estados.map((_) => `?`).join(",")})`,
      estados,
    );

    return res.status(200).json({ message: "Factura obtenida correctamente", data: facturas });
  } catch (error) {
    console.log(error);
    return res
      .status(error.status || error.statusCode || 500)
      .json({ message: error.message || "Error al obtener la factura" });
  }
}


const obtenerFacturaById = async (req, res) => {
  try {
    const { id } = req.params;
    const [factura] = await executeQuery(`SELECT * FROM facturas WHERE id_factura = ?`, [id]);
    if (!factura.id_facturama) {
      throw new Error("La factura no se genero en MIA, no se puede obtener el cfdi");
    }
    const cfdi = await getCfdi(factura.id_facturama, "issued");
    if (factura.estado == cfdi.Status) throw new Error("No hay cambios en el estado de la factura");

    await executeQuery(`UPDATE facturas  SET estado = ? WHERE id_factura = ?`, [cfdi.Status, id]);

    const [facturaActualizada] = await executeQuery(`SELECT * FROM facturas WHERE id_factura = ?`, [id]);

    return res.status(200).json({ message: "Factura obtenida correctamente", data: facturaActualizada, metadata: { message: "¿Deseas soltar la factura de las reservas y pagos asignados?" } });
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
            // "pending",
            response.Status || null,
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

module.exports = { cancelarFacturaById, obtenerFacturaById, getFacturas };
