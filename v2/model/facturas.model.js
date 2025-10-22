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
  Validacion.uuid();
  const precioFormat = {
    invoice: Calculo.precio({ total: invoice.invoice }).total,
    monto: Calculo.precio({ total: invoice.monto }).total,
  };
  invoice = {
    ...invoice,
    ...Object.entries(precioFormat)
      .filter(([_, v]) => !!v)
      .map(([k, v]) => ({ [k]: v }))
      .reduce((p, c) => ({ ...p, ...c }), {}),
  };
  return await db.update(conn, schema, invoice);
};

module.exports = { update, create };

/* Para cada caso se debera ver que afecta la facturación y si ya esta pagado y si son varios (menos en pago directo que solo hay uno)
caso 1.- Pago directo
caso 2.- Pago con saldos (varios)
caso 3.- Pago con credito
caso 4.- Pago con credito ya pagado  */
