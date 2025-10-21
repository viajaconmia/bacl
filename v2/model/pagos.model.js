const db = require("../../config/db");
const { Calculo } = require("../../lib/utils/calculates");
const { Validacion } = require("../../lib/utils/validates");
const QUERYS = require("../constant/querys");
const model = require("./db.model");
const { PAGOS: schema } = require("./schema");

const create = async (conn, pago) => {
  Validacion.uuidfk(pago.id_servicio);
  pago = {
    ...Calculo.uuid(pago, schema.id, "pag-"),
    ...Calculo.precio(pago),
  };
  return await db.insert(conn, schema, pago);
};

const update = async (conn, pago) => {
  Validacion.uuid(pago[schema.id]);
  const { impuestos, ...rest } = Calculo.precio(pago);
  pago = rest;

  return await db.update(conn, schema, pago);
};

const getById = async (id) => {
  Validacion.uuid(id);
  const [pago] = await db.getById(schema.table, schema.id, id);
  return pago;
};

const isFacturado = async (id_pago) => {
  Validacion.uuid(id_pago);
  const currentPago = model.PAGO.getById(id_pago);
  const id = currentPago.id_saldo_a_favor ?? currentPago.id_pago;
  const [factura] = db.executeQuery(QUERYS.PAGOS.GET_IS_FACTURADO, [id]);
  return [factura.is_facturado, factura.monto_pago - factura.monto_facturado];

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
