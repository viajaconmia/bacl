const { CustomError } = require("../../middleware/errorHandler");

/**
 * Genera los placeholders y params planos para una cláusula IN.
 *
 * mysql2 con `pool.execute()` (prepared statements) no expande arrays
 * anidados: un solo `?` con un array como valor se serializa como JSON
 * en vez de como lista de valores, por lo que `IN (?)` + `[ids]` nunca
 * matchea nada. Hay que generar un `?` por cada valor y pasarlos planos.
 *
 * @param {Array|*} values
 * @returns {{ placeholders: string, params: any[] }}
 *
 * @example
 * const { placeholders, params } = sqlIn(ids);
 * run(`SELECT * FROM t WHERE id IN (${placeholders})`, params);
 */
const sqlIn = (values) => {
  const arr = Array.isArray(values) ? values : [values];
  if (arr.length === 0) {
    throw new CustomError("Se requiere al menos un valor para IN()", 400, "VALIDATION_ERROR");
  }
  return { placeholders: arr.map(() => "?").join(", "), params: arr };
};

module.exports = { sqlIn };
