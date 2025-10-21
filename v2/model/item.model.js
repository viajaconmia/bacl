const { Calculo } = require("../../lib/utils/calculates");
const { Formato } = require("../../lib/utils/formats");
const { Validacion } = require("../../lib/utils/validates");
const db = require("../../config/db");
const { ITEMS: schema } = require("./schema");

const create = async (conn, item) => {
  item = Calculo.uuid(item, "id_item", "ite-");
  item = Calculo.precio(item);
  const costo = Calculo.precio({ total: item.costo_total });
  item = {
    ...item,
    saldo: Formato.precio(item.saldo),
    costo_total: costo.total,
    costo_subtotal: costo.subtotal,
    costo_iva: costo.impuestos,
  };
  return await db.insert(conn, schema, pago);
};

const update = async (conn, item) => {
  Validacion.uuid(servicio.id_item);
  item = Calculo.precio(item);
  if (item.costo_total) {
    const costo = Calculo.precio({ total: item.costo_total });
    item = {
      ...item,
      costo_total: costo.total,
      costo_subtotal: costo.subtotal,
      costo_iva: costo.impuestos,
    };
  }
  if (item.saldo) {
    item = {
      ...item,
      saldo: Formato.precio(item.saldo),
    };
  }
  return await db.update(conn, schema, item);
};

const drop = async (conn, ...ids) => {
  ids.forEach((id) => Validacion.uuid(id));

  const query = `DELETE FROM ${table} WHERE id_item in (${ids
    .map((_) => "?")
    .join(",")})`;
  return await conn.execute(query, ids);
};

module.exports = { update, create, drop };
