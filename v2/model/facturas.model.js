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

/* Para cada caso se debera ver que afecta la facturación y si ya esta pagado y si son varios (menos en pago directo que solo hay uno)
caso 1.- Pago directo
caso 2.- Pago con saldos (varios)
caso 3.- Pago con credito
caso 4.- Pago con credito ya pagado  */

/* Caso 1.- 
Duplicar un wallet con su valor
agregar al wallet la diferencia que se regreso que es el saldo restante
Verificar si esta facturado y al saldo agregarle si es facturable y si esta facturado
Cambiar el valor del pago agregando saldo usado y el id_saldo

Cambiar los items conectados a ese pago disminuyendo y spliteando el valor actual del pago y quitando el valor de los que se dejaron de usar updateando a 0
editar los items que se quedaron en 0 y desactivarlos
editar los items que estan bien y updatear su nuevo total y el is_facturado si esta facturado igual el monto facturado

Verificar si esta facturado el pago 
si esta facturado regresar a la factura la diferencia en saldo x aplicar items
en items_facturas borrar los no ocupados con monto 0, actualizar valor de facturación al nuevo, tomando como limite el monto de la factura menos el saldo por aplicar o algo asi, verificar logica
guardar en facturas pagos y saldos el id saldo  */
