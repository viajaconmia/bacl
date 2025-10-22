const db = require("../../config/db");
const { Calculo } = require("../../lib/utils/calculates");
const { Validacion } = require("../../lib/utils/validates");
const model = require("./db.model");
const { FACTURAS: schema } = require("./schema");

const create = async (conn, invoice) => {
  Validacion.uuidfk(invoice.usuario_creador);
  invoice = Calculo.uuid(invoice, schema.id, "fac-");
  invoice = Calculo.precio(invoice);
  return await db.insert(conn, schema, invoice);
};

const update = async (conn, invoice) => {
  Validacion.uuid(invoice[schema.id]);
  invoice = Calculo.precio(invoice);
  return await db.update(conn, schema, invoice);
};

const getById = async (...ids) => {
  ids.forEach((id) => Validacion.uuid(id));
  const facturas = await db.getByIds(schema, ...ids);
  return facturas;
};

module.exports = { update, create, getById };
