const { executeQuery } = require("../config/db");

const verificarPermiso = (permiso) => {
  return async (req, res, next) => {
    try {
      const { user } = req.session;
      if (!user) throw new Error("No se encontro el usuario");
      const [acceso] = await executeQuery(
        `SELECT * FROM vw_permisos_by_user WHERE user_id = ? AND name = ?;`,
        [user.id, permiso]
      );
      if (!acceso) throw new Error("No tienes acceso a este recurso");
      next();
    } catch (error) {
      res.status(404).json({
        message: error.message || "Error al verificar permisos de usuario",
        error,
        data: null,
      });
    }
  };
};
module.exports = { verificarPermiso };
