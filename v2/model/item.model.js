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

const getAllByIdConexion = async (id_conexion,tipo_conexion) => {
  Validacion.uuidfk(id_conexion);
  const query = `SELECT * FROM ${table} WHERE ${tipo_conexion} = ${id_conexion} ;`;
  const items = await db.executeQuery(query);
  return items;
}

const add_items = async (conn, check_in,noches, tipo_conexion, total, is_ajuste)=>{
  const items_a_eliminar = await getAllByIdConexion(check_in,tipo_conexion);
  if(items_a_eliminar.length>0){
    await drop(conn,...items_a_eliminar.map(i=>i.id_item));
  }
  const iterador = is_ajuste ? 1 : noches;
  for(let i=0;i<iterador;i++){
    const fecha_uso = new Date(check_in);
    fecha_uso.setDate(fecha_uso.getDate()+i);
    const item = {
      [tipo_conexion]: check_in,
      fecha_uso: is_ajuste? null: Formato.fechaSQL(fecha_uso),
      total: Formato.precio(total),
      saldo: Formato.precio(total),
    }
    await create(conn,item);
  }

}

module.exports = { update, create, drop, getAllByIdConexion, add_items };
