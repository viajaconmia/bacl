const db = require("../../config/db");
const { Validacion } = require("../../lib/utils/validates");
const { ITEMS_PAGOS: schema } = require("./schema");

// const create = async (conn, pago) => {
//   Validacion.uuidfk(pago.id_servicio);
//   pago = {
//     ...Calculo.uuid(pago, schema.id, "pag-"),
//     ...Calculo.precio(pago),
//   };
//   return await db.insert(conn, schema, pago);
// };

const updateByPago = async (conn, fps) => {
  const newSchema = { ...schema, id: "id_pago" };
  Validacion.uuid(fps[newSchema.id]);
  return await db.update(conn, newSchema, fps);
};

module.exports = { updateByPago };
