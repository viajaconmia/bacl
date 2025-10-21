const db = require("../../config/db");
const { Calculo } = require("../../lib/utils/calculates");
const { Validacion } = require("../../lib/utils/validates");
const QUERYS = require("../constant/querys");
const { PAGOS: schema } = require("./schema");

/**
 * Crea un nuevo registro de pago en la base de datos.
 *
 * @async
 * @param {object} conn - Conexión activa a la base de datos.
 * @param {object} pago - Objeto de pago a registrar.
 * @returns {Promise<[object, any]>} Retorna una promesa que resuelve en un array con el objeto de pago formateado y la respuesta de la base de datos.
 */
const create = async (conn, pago) => {
  Validacion.uuidfk(pago.id_servicio);
  pago = {
    ...Calculo.uuid(pago, schema.id, "pag-"),
    ...Calculo.precio(pago),
  };
  return await db.insert(conn, schema, pago);
};

/**
 * Actualiza un registro de pago existente en la base de datos.
 * @async
 * @param {object} conn - Conexión activa a la base de datos.
 * @param {object} pago - Objeto de pago a actualizar.
 * @returns {Promise<[object, any]>} Retorna una promesa que resuelve en un array con el objeto de pago actualizado y la respuesta de la base de datos.
 * */
const update = async (conn, pago) => {
  Validacion.uuid(pago[schema.id]);
  const { impuestos, ...rest } = Calculo.precio(pago);
  pago = rest;

  return await db.update(conn, schema, pago);
};

/**
 * Obtiene un pago por su identificador único.
 * @async
 * @param {string} id - Identificador único del pago.
 * @returns {Promise<object>} Retorna una promesa que resuelve en el objeto de pago encontrado.
 */
const getById = async (id) => {
  Validacion.uuid(id);
  const [pago] = await db.getById(schema.table, schema.id, id);
  return pago;
};

/**
 * Verifica si un pago ha sido facturado.
 *
 * @async
 * @param {string} id - Identificador único del pago.
 * @returns {Promise<boolean>} Retorna una promesa que resuelve en true si el pago ha sido facturado, de lo contrario false.
 */
const isFacturado = async (id) => {
  Validacion.uuid(id);
  const [pagos] = db.executeQuery(QUERYS.PAGOS.GET_IS_FACTURADO, [id]);

  // const [pago] = await
  /**
   * Aqui entiendo que en saldo_a_favor se que es por el monto por facturar y asi, pero cuando es pago como verifico que este facturado?
   *
   *
   * Segun mi idea es que se mete en saldos_pagos_y_facturas todo lo que se facturo de un pago por la factura
   * Ese pago ya esta facturado, no importa lo demas, pero cuando estan los items entonces ya vemos como es que conecta, pero de la factura donde ponemos el monto por facturar a items, no necesitamos como tal lo que es solo meter un monto pequeño, o si?
   */
  return true;
};

module.exports = { update, create, getById, isFacturado };
