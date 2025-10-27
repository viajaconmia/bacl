const db = require("../../config/db");
const { Validacion } = require("../../lib/utils/validates");
const { ITEMS_FACTURAS: schema } = require("./schema");

const updateByRelacion = async (conn, fi) => {
  const newSchema = { ...schema, id: "id_relacion" };
  Validacion.uuid(fi[newSchema.id]);
  return await db.update(conn, newSchema, fi);
};

module.exports = { updateByRelacion };
