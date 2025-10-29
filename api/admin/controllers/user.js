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
const updateUserPermission = async (req, res) => {
  try {
    const { id_permission, id_user, value } = req.body;
    if (value) {
      await executeQuery(
        `INSERT INTO user_permissions (user_id, permission_id) VALUES (?,?)`,
        [id_user, id_permission]
      );
    } else {
      await executeQuery(
        `DELETE from user_permissions where user_id = ? AND permission_id = ?`,
        [id_user, id_permission]
      );
    }

    res.status(204).json({ message: "Actualizado con exito", data: null });
  } catch (error) {
    console.error(error.message || "Error al crear usuario");
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al registrar el usuario",
      data: null,
      error,
    });
  }
};
const updateUserRole = async (req, res) => {
  try {
    const { id_role, id_user } = req.body;
    await executeQuery(`UPDATE user_role SET role_id = ? WHERE user_id = ?`, [
      id_role,
      id_user,
    ]);

    res.status(204).json({ message: "Actualizado con exito", data: null });
  } catch (error) {
    console.error(error.message || "Error al crear usuario");
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al registrar el usuario",
      data: null,
      error,
    });
  }
};

module.exports = {
  updateUserPermission,
  updateUserRole,
  updateActive,
  getRoles,
};
