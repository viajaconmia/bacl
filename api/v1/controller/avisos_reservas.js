const { executeQuery } = require("../../../config/db");

const read = async () => {
  try {
    const query = `select * from vw_new_reservas limit 50`;

    // Ejecutar el procedimiento almacenado
    const response = await executeQuery(query);

    return response; // Retorna el resultado de la ejecución
  } catch (error) {
    throw error; // Lanza el error para que puedas manejarlo donde llames la función
  }
};

module.exports = {
    read
}