const { executeQuery, runTransaction } = require("../../../config/db");

const updateActive = async (req, res) => {
  try {
    const { id, value } = req.body;

    await executeQuery(`UPDATE users_admin SET active = ? WHERE id = ?`, [
      value,
      id,
    ]);

    res.status(204).json({ message: "Actualizado con exito", data: value });
  } catch (error) {
    const message = error.message || "Error al editar usuario";
    console.error(message);
    res.status(error.statusCode || error.status || 500).json({
      message,
      data: null,
      error,
    });
  }
};

const getRoles = async (req, res) => {
  try {
    const roles = await executeQuery(
      `SELECT id as role_id, name as role_name FROM roles`
    );

    res.status(200).json({ message: "Obtenido con exito", data: roles });
  } catch (error) {
    const message = error.message || "Error al editar usuario";
    console.error(message);
    res.status(error.statusCode || error.status || 500).json({
      message,
      data: null,
      error,
    });
  }
};

module.exports = {
  updateActive,
  getRoles,
};
