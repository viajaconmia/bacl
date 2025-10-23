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

const getById = async (...ids) => {
  ids.forEach((id) => Validacion.uuid(id));
  const pagos = await db.getByIds(schema, ...ids);
  return pagos;
};

const isFacturado = async (id_pago) => {
  Validacion.uuid(id_pago);
  const [pago] = await getById(id_pago);
  console.log(pago);
  const id = pago.id_saldo_a_favor ?? pago.id_pago;
  console.log(id);
  const response = await db.executeQuery(QUERYS.PAGOS.GET_IS_FACTURADO, [id]);
  console.log("response: ", response);
  const [pago_facturado] = response;
  return { pago, ...pago_facturado };
};

module.exports = { update, create, getById, isFacturado };
