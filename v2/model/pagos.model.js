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
  const currentPago = await model.PAGO.getById(id_pago);
  const id = currentPago.id_saldo_a_favor ?? currentPago.id_pago;
  const [pago_facturado] = await db.executeQuery(
    QUERYS.PAGOS.GET_IS_FACTURADO,
    [id]
  );
  return { pago: currentPago, ...pago_facturado };
};

module.exports = { update, create, getById, isFacturado };