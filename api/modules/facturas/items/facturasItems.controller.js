const { runTransaction } = require("../../../../config/db");
const facturasService = require("../facturas.service");
const facturasItemsService = require("./facturasItems.service");

const getItemsPendientes = async (req, res) => {
  const { id_relacion } = req.query;

  try {
    const data = await facturasItemsService.getPendientesByRelaciones(id_relacion);
    return res.status(200).json({
      message: "Items pendientes de facturar obtenidos correctamente",
      data,
    });
  } catch (error) {
    console.error("Error en getItemsPendientes:", error);
    return res.status(error.statusCode ?? 500).json({
      error: "Error al obtener items pendientes de facturar",
      details: error.message || error,
    });
  }
};

const asignarItems = async (req, res) => {
  const { id_factura, seleccion } = req.body;

  if (!id_factura) {
    return res.status(400).json({ message: "id_factura es requerido" });
  }
  if (!Array.isArray(seleccion) || seleccion.length === 0) {
    return res.status(400).json({ message: "No has seleccionado items para asignar" });
  }

  try {
    const factura = await facturasService.getById(id_factura);
    const saldoDisponible = Number(factura.saldo_x_aplicar_items);

    const idsRelacion = [...new Set(seleccion.map((s) => s.id_relacion))];
    const pendientes = await facturasItemsService.getPendientesByRelaciones(idsRelacion);

    const pendientesMap = Object.fromEntries(pendientes.map((p) => [p.id_item, p]));
    const pendientesPorRelacion = pendientes.reduce((acc, p) => {
      if (!acc[p.id_relacion]) acc[p.id_relacion] = [];
      acc[p.id_relacion].push(p);
      return acc;
    }, {});

    const inserts = [];
    let totalAsignar = 0;

    for (const sel of seleccion) {
      if (!sel.id_relacion || !sel.tipo) {
        return res.status(400).json({ message: "Cada selección requiere id_relacion y tipo" });
      }

      if (sel.tipo === "completa") {
        const itemsRelacion = pendientesPorRelacion[sel.id_relacion] ?? [];
        if (itemsRelacion.length === 0) {
          return res.status(400).json({
            message: `No hay items pendientes para la relación ${sel.id_relacion}`,
          });
        }
        for (const item of itemsRelacion) {
          const monto = Number(item.monto_por_facturar);
          inserts.push({ id_item: item.id_item, id_factura, monto });
          totalAsignar += monto;
        }
      } else if (sel.tipo === "parcial") {
        if (!Array.isArray(sel.items) || sel.items.length === 0) {
          return res.status(400).json({
            message: `La selección parcial de ${sel.id_relacion} requiere items`,
          });
        }
        for (const item of sel.items) {
          const db = pendientesMap[item.id_item];
          if (!db) {
            return res.status(400).json({
              message: `El item ${item.id_item} no existe o ya está completamente facturado`,
            });
          }
          const montoAsignar = Number(item.monto_asignar);
          if (montoAsignar <= 0) {
            return res.status(400).json({
              message: `monto_asignar del item ${item.id_item} debe ser mayor a 0`,
            });
          }
          if (montoAsignar > Number(db.monto_por_facturar)) {
            return res.status(400).json({
              message: `monto_asignar (${montoAsignar}) del item ${item.id_item} supera el pendiente (${db.monto_por_facturar})`,
            });
          }
          inserts.push({ id_item: item.id_item, id_factura, monto: montoAsignar });
          totalAsignar += montoAsignar;
        }
      } else {
        return res.status(400).json({
          message: `Tipo inválido: ${sel.tipo}. Use "completa" o "parcial"`,
        });
      }
    }

    if (Math.round(totalAsignar * 100) > Math.round(saldoDisponible * 100)) {
      return res.status(400).json({
        message: `El total a asignar (${totalAsignar.toFixed(2)}) supera el saldo disponible de la factura (${saldoDisponible.toFixed(2)})`,
      });
    }

    await runTransaction(async (conn) => {
      for (const ins of inserts) {
        await facturasItemsService.asignarItemAFactura(ins, conn);
      }
    });

    return res.status(200).json({
      message: "Items asignados correctamente",
      data: inserts,
      metadata: { total_asignado: totalAsignar },
    });
  } catch (error) {
    console.error("Error en asignarItems:", error);
    return res.status(error.statusCode ?? 500).json({
      error: "Error al asignar items a la factura",
      details: error.message || error,
    });
  }
};

module.exports = { getItemsPendientes, asignarItems };
