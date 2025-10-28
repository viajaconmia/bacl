const { Calculo } = require("../../lib/utils/calculates");
const { Formato } = require("../../lib/utils/formats");
const { Validacion } = require("../../lib/utils/validates");
const db = require("../../config/db");
const { ITEMS: schema } = require("./schema");

const create = async (conn, item) => {
  console.log('LOG (Item.create): Recibido para insertar:', item);
  item = Calculo.uuid(item, "id_item", "ite-"); // <-- Genera el ID aquí

  try {
    item = Calculo.precio(item);
    if (item.saldo !== undefined) item.saldo = Formato.precio(item.saldo);
    
  } catch (validationError) {
    console.error("LOG (Item.create): Error validación/formato:", validationError, "Datos:", item);
    throw validationError;
  }

 
 const [insertedItem, insertResponse] = await db.insert(conn, schema, item);
  console.log('LOG (Item.create): Resultado db.insert:', insertResponse);
  return insertedItem; };

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

  const query = `DELETE FROM ${schema.table} WHERE id_item in (${ids
    .map((_) => "?")
    .join(",")})`;
  return await conn.execute(query, ids);
};

const findActivos = async (conn, id_hospedaje, orden = 'ASC') => {
  const query = `
    SELECT i.*, IFNULL(SUM(itf.monto), 0) as monto_facturado_previo 
    FROM ${schema.table} i
    LEFT JOIN items_facturas itf ON i.id_item = itf.id_item
    WHERE i.id_hospedaje = ? AND i.estado = 1
    GROUP BY i.id_item
    ORDER BY i.fecha_uso ${orden === 'LIFO' ? 'DESC' : 'ASC'}
  `;
  const [rows] = await conn.execute(query, [id_hospedaje]);
  return rows;
};
const agregar_nuevas_noches = async (conn, id_hospedaje, fecha_ultima_noche, delta_noches, precio_por_noche) => {
  const items_creados = [];
  let ultima_fecha = new Date(fecha_ultima_noche);
  // ... (logs) ...

  for (let i = 0; i < delta_noches; i++) {
    ultima_fecha.setDate(ultima_fecha.getDate() + 1);
    const { total: total_item, subtotal: sub_item, impuestos: imp_item } = Calculo.precio({ total: precio_por_noche });
    // ... (logs) ...

    const itemData = { // Renombrado para claridad
      id_hospedaje: id_hospedaje,
      id_catalogo_item: null,
      id_factura: null,
      id_viaje_aereo: null,
      id_renta_carro: null,
      total: total_item,
      subtotal: sub_item,
      impuestos: imp_item,
      saldo: 0,
      costo_total: 0,
      costo_subtotal: 0,
      costo_impuestos: 0,
      costo_iva: 0,
      fecha_uso: Formato.fechaSQL(ultima_fecha),
      is_ajuste: 0,
      estado: 1,
      is_facturado: 0
    };

    console.log('LOG (agregar_nuevas_noches): Objeto item ANTES de llamar a create:', itemData);

    // --- CAPTURAR EL RESULTADO COMPLETO DE CREATE ---
    const newItemRecord = await create(conn, itemData); // Llama a Item.create
    console.log('LOG (agregar_nuevas_noches): Item creado devuelto por create:', newItemRecord);

    // --- USAR EL RESULTADO PARA EL ARRAY DEVUELTO ---
    // newItemRecord ahora contiene el id_item generado
    items_creados.push(newItemRecord);
  }
  return items_creados; // Devuelve el array de objetos item completos
};
const desactivar_noches_lifo = async (conn, id_hospedaje, delta_noches_abs) => {
  const items_activos_lifo = await findActivos(conn, id_hospedaje, 'LIFO');
  const items_a_desactivar = items_activos_lifo.slice(0, delta_noches_abs);
  
  if (items_a_desactivar.length === 0) {
    return []; // No hay nada que desactivar
  }

  const ids_a_desactivar = items_a_desactivar.map(i => i.id_item);
  const placeholders = ids_a_desactivar.map(() => '?').join(',');

  const query = `UPDATE ${schema.table} SET estado = 0 WHERE id_item IN (${placeholders})`;
  await conn.execute(query, ids_a_desactivar);

  // Devolvemos los items que acabamos de desactivar,
  // por si el controlador necesita su 'monto_facturado_previo' (Regla Morada)
  return items_a_desactivar;
};

const crear_item_ajuste = async (conn, id_hospedaje, delta_precio_venta, tasaIvaDecimal = 0.16) => {
  // Usamos tu helper de cálculo, pero adaptado
  const { total, subtotal, impuestos } = Calculo.precio({ total: delta_precio_venta });

  const item = {
    id_hospedaje: id_hospedaje,
    fecha_uso: null, // Ajuste no lleva fecha
    is_ajuste: 1,
    total: total,
    subtotal: subtotal,
    impuestos: impuestos,
    estado: 1
  };
  
  const [result] = await create(conn, item);
  return { id_item: item.id_item, ...item };
};

const aplicar_split_precio = async (conn, items_activos, nuevo_total_venta) => {
  if (!items_activos || items_activos.length === 0) return;

  const total_por_item = nuevo_total_venta / items_activos.length;
  let total_acumulado = 0;

  for (let i = 0; i < items_activos.length; i++) {
    const item = items_activos[i];
    let calculo;

    if (i === items_activos.length - 1) {
      const total_restante = nuevo_total_venta - total_acumulado;
      calculo = Calculo.precio({ total: total_restante });
    } else {
      calculo = Calculo.precio({ total: total_por_item });
      total_acumulado += Formato.precio(calculo.total); 
    }
    
    
    const query = `UPDATE ${schema.table} SET total = ?, subtotal = ?, impuestos = ? WHERE id_item = ?`;
    await conn.execute(query, [calculo.total, calculo.subtotal, calculo.impuestos, item.id_item]);
  }
};

const getAllByIdConexion = async (id_conexion,tipo_conexion) => {
  Validacion.uuidfk(id_conexion);
  const query = `SELECT * FROM ${schema.table} WHERE ${tipo_conexion} = ${id_conexion} ;`;
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

module.exports = { update, create, drop, getAllByIdConexion, add_items,agregar_nuevas_noches,aplicar_split_precio,desactivar_noches_lifo,crear_item_ajuste,findActivos };
