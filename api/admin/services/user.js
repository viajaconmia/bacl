const { executeQuery } = require("../../../config/db");

const getUser = async (email) => {
  const [user_completo] = await executeQuery(
    `SELECT * FROM users_admin WHERE email = ? AND active = 1`,
    [email]
  );
  if (!user_completo) throw new Error("No existe ese usuario");
  const { password: _, ...user } = user_completo;

  const permisos_obj = await executeQuery(
    `SELECT name FROM vw_permisos_by_user WHERE categoria = "vista" AND user_id = ?;`,
    [user.id]
  );
  const permisos = permisos_obj.map((permiso) => permiso.name);
  let { password: contrasena, ...usuario } = user;

  return { ...usuario, permisos };
};

module.exports = { getUser };
