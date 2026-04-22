const { executeQuery } = require("../../../config/db");

const read = async (req, res) => {
  try {
    const query = `SELECT * FROM vw_new_reservas LIMIT 50`;
    const response = await executeQuery(query);
    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener avisos de reservas", details: error.message });
  }
}; 

module.exports = {
    read
}