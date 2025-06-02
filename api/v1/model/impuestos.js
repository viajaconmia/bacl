const { executeTransaction, executeQuery } = require("../../../config/db");


const getImpuestos = async () => {
  try {
    let query = `SELECT id_impuesto, name, ROUND(rate, 2) as rate FROM impuestos`;
    let response = await executeQuery(query);
    return response;

  } catch (error) {
    throw error;
  }
}

module.exports = {
  getImpuestos
}