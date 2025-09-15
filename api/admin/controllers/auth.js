const { executeQuery, runTransaction } = require("../../../config/db");
const { SALT_ROUNDS, SECRET_KEY } = require("../../../lib/constant");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { ShortError, CustomError } = require("../../../middleware/errorHandler");
const Validation = require("../validations");

const signUp = async (req, res) => {
  try {
    let { username, password, email, role } = req.body;

    console.log("entrando");

    Validation.password(password);
    Validation.username(username);
    Validation.email(email);

    const [usuario] = await executeQuery(
      `SELECT * FROM users_admin WHERE email = ?`,
      [email]
    );
    if (usuario) throw new ShortError("El usuario ya existe", 403);

    const hashedPassword = await bcrypt.hash(password, Number(SALT_ROUNDS));

    await runTransaction(async (conn) => {
      try {
        //Crear el usuario
        await conn.execute(
          `INSERT INTO users_admin (name, email, password) VALUES (?,?,?)`,
          [username, email, hashedPassword]
        );

        //Extraer el usuario
        const [user] = await conn.execute(
          `SELECT * FROM users_admin WHERE email = ?`,
          [email]
        );
        if (!user[0]) throw new ShortError("Error al crear el usuario", 404);

        if (!role) role = { id: 1 };
        console.log(user);
        await conn.execute(
          `INSERT INTO user_roles (user_id, role_id) VALUES (?,?)`,
          [user[0].id, role.id]
        );
      } catch (error) {
        throw new CustomError(
          error.message ||
            error.sqlMessage ||
            "Ha ocurrido un error al hacer la petición",
          error.statusCode || 500,
          "DATABASE_ERROR",
          error
        );
      }
    });

    res.status(204).json({ message: "Usuario creado con exito", data: null });
  } catch (error) {
    console.error(error.message || "Error al crear usuario");
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al registrar el usuario",
      data: null,
      error,
    });
  }
};

const logIn = async (req, res) => {
  try {
    let { password, email } = req.body;
    const { session } = req;

    if (session.user) throw new Error("Ya existe una sessión iniciada");

    Validation.password(password);
    Validation.email(email);

    const [user_completo] = await executeQuery(
      `SELECT * FROM users_admin WHERE email = ?`,
      [email]
    );
    if (!user_completo) throw new Error("No existe ese usuario");

    const isValid = await bcrypt.compare(password, user_completo.password);

    if (!isValid) throw new Error("Contraseña incorrecta");

    const { password: _, ...user } = user_completo;

    const permisos_obj = await executeQuery(
      `
      select p.name from user_roles ur 
        left join role_permissions rp on rp.role_id = ur.role_id 
        left join user_permissions up on up.user_id = ur.user_id
        left join permissions p on p.id = rp.permission_id OR p.id = up.permission_id
      where ur.user_id = ?;`,
      [user.id]
    );

    const permisos = permisos_obj.map((permiso) => permiso.name);

    const token = jwt.sign({ ...user, permisos }, SECRET_KEY, {
      expiresIn: "1d",
    });

    res
      .cookie("access-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24,
      })
      .status(200)
      .json({
        message: "Accediendo con exito",
        data: { id: user.id, name: user.name, token, permisos },
      });
  } catch (error) {
    console.error(error.message || "Error al crear usuario");
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al registrar el usuario",
      data: null,
      error,
    });
  }
};
const logOut = async (req, res) => {
  try {
    const { user } = req.session;
    if (!user) throw new Error("No hay cuenta activa");

    res.clearCookie("access-token").status(204).json({ message: "session" });
  } catch (error) {
    console.error(error.message || "Error al crear usuario");
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al registrar el usuario",
      data: null,
      error,
    });
  }
};
const verifySession = async (req, res) => {
  try {
    const { user } = req.session;
    res.status(200).json({ message: "Comprobando verificación", data: user });
  } catch (error) {
    console.error(error.message || "Error al crear usuario");
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al registrar el usuario",
      data: null,
      error,
    });
  }
};
const getUsuariosAdmin = async (req, res) => {
  try {
    const usuarios = await executeQuery(`
        select ua.id, ua.name, ua.email, ua.created_at, ur.role_id, r.name as role_name, COUNT(up.permission_id) as permissions_extra, ua.active from users_admin ua
          left join user_roles ur on ur.user_id = ua.id
          left join roles r on r.id = ur.role_id
          left join user_permissions up on up.user_id = ua.id
        group by ua.id;
        `);

    res
      .status(200)
      .json({ message: "Comprobando verificación", data: usuarios });
  } catch (error) {
    console.error(error.message || "Error al crear usuario");
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al registrar el usuario",
      data: null,
      error,
    });
  }
};
const getPermisos = async (req, res) => {
  try {
    const { id } = req.query;
    console.log(id);
    const permisos = await executeQuery(
      `
        SELECT 
    p.id,
    p.name,
    p.description,
    CASE 
        WHEN vw.permission_id IS NOT NULL THEN 1
        ELSE 0
    END AS active
FROM permissions p
LEFT JOIN vw_permisos_by_user vw 
    ON vw.permission_id = p.id 
   AND vw.user_id = ?;`,
      [id || ""]
    );

    res
      .status(200)
      .json({ message: "Permisos obtenidos con exito", data: permisos });
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
  signUp,
  logIn,
  logOut,
  verifySession,
  getUsuariosAdmin,
  getPermisos,
};
