const DB = require("../model/db.model");

const ajustar_items_facturados = async (id_relacion) => {
  const items_facturados = await DB.ITEM_FACTURA.getByRelacion(id_relacion);
  const ids = items_facturados.reduce(
    (prev, curr) =>
      prev.some((elem) => elem == curr.id_factura)
        ? prev
        : [...prev, curr.id_factura],
    []
  );
  const facturas = await DB.FACTURAS.getById(...ids);
  if (facturas.some((fac) => Number(fac.saldo_x_aplicar_items) != 0)) {
  }
  console.log(items_facturados);
  return [items_facturados, facturas];
  /**
 1.- Debemos obtener los items facturados y su monto junto con sus facturas pero de la reserva o vuelo especifico
 2.- Debemos splitear el monto a los items, el monto facturado
 2.1.- En el spliteo debemos verificar que el faltante o restante a asignar sea menor que el monto 
 2.2.- Tambien debemos ver que la diferencia o restante mas la suma de los montos sea mayor a 0
*/
};

module.exports = { ajustar_items_facturados };
