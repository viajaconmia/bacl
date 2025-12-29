const { executeQuery, runTransaction } = require("../../../config/db");
const { SALT_ROUNDS, SECRET_KEY } = require("../../../lib/constant");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { ShortError, CustomError } = require("../../../middleware/errorHandler");
const Validation = require("../validations");
const { getUser } = require("../services/user");

/**
 * Enmascara un string sensible: muestra inicio/fin y oculta lo demás.
 */
function mask(str, left = 10, right = 6) {
  if (!str || typeof str !== "string") return String(str);
  if (str.length <= left + right) return str;
  return `${str.slice(0, left)}...${str.slice(-right)}`;
}

/**
 * Identifica el tipo de hash por prefijo (heurístico).
 */
function detectHashType(hash) {
  if (typeof hash !== "string") return "unknown";
  if (/^\$2[aby]\$\d{2}\$/.test(hash)) return "bcrypt ($2a/$2b/$2y)";
  if (/^\$argon2(id|i|d)\$/.test(hash)) return "argon2";
  if (/^\$pbkdf2-/.test(hash)) return "pbkdf2";
  return "unknown";
}

/**
 * Logs de autenticación seguros (NO imprime password en claro, NO imprime hash completo).
 * Actívalo con: DEBUG_AUTH=true (solo local).
 */
async function debugBcryptFlow({ email, plainPassword, storedHash }) {
  const debugEnabled =
    String(process.env.DEBUG_AUTH).toLowerCase() === "true" &&
    process.env.NODE_ENV !== "production";

  if (!debugEnabled) return;

  try {
    console.log("[AUTH_DEBUG] email:", email);
    console.log("[AUTH_DEBUG] hashType:", detectHashType(storedHash));
    console.log("[AUTH_DEBUG] storedHash (masked):", mask(storedHash));

    // rounds (cost)
    const rounds = bcrypt.getRounds(storedHash);
    console.log("[AUTH_DEBUG] rounds:", rounds);

    // salt embebido dentro del hash bcrypt
    const saltFromHash = bcrypt.getSalt(storedHash);
    console.log("[AUTH_DEBUG] saltFromHash:", saltFromHash);

    // Nunca imprimas el password; si quieres “ver algo”, imprime longitud y un fingerprint no reversible
    const len = plainPassword ? String(plainPassword).length : 0;
    const pwFingerprint = crypto
      .createHash("sha256")
      .update(String(plainPassword))
      .digest("hex")
      .slice(0, 12);

    console.log("[AUTH_DEBUG] inputPasswordLength:", len);
    console.log("[AUTH_DEBUG] inputPasswordFingerprint(sha256-12):", pwFingerprint);

    // Simula el compare: re-hash usando el MISMO salt del hash guardado
    const rehash = await bcrypt.hash(String(plainPassword), saltFromHash);
    console.log("[AUTH_DEBUG] rehash (masked):", mask(rehash));
    console.log("[AUTH_DEBUG] rehashMatchesStored:", rehash === storedHash);

    // (Opcional) comparación en tiempo constante (didáctico)
    if (rehash.length === storedHash.length) {
      const safeEqual = crypto.timingSafeEqual(
        Buffer.from(rehash),
        Buffer.from(storedHash)
      );
      console.log("[AUTH_DEBUG] timingSafeEqual:", safeEqual);
    }
  } catch (e) {
    console.log("[AUTH_DEBUG] debug error:", e?.message || e);
  }
}

const signUp = async (req, res) => {
  try {
    let { username, password, email, role } = req.body;

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
        // Crear el usuario
        await conn.execute(
          `INSERT INTO users_admin (name, email, password) VALUES (?,?,?)`,
          [username, email, hashedPassword]
        );

        // Extraer el usuario
        const [user] = await conn.execute(
          `SELECT * FROM users_admin WHERE email = ?`,
          [email]
        );
        if (!user[0]) throw new ShortError("Error al crear el usuario", 404);

        // Default role (ajusta según tu payload real)
        if (!role) role = { role_id: 1 };

        await conn.execute(
          `INSERT INTO user_roles (user_id, role_id) VALUES (?,?)`,
          [user[0].id, role.role_id]
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

    // 201 es más consistente si devuelves JSON
    res.status(201).json({ message: "Usuario creado con exito", data: null });
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
      `SELECT * FROM users_admin WHERE email = ? AND active = 1`,
      [email]
    );
    if (!user_completo) throw new Error("Credenciales incorrectas");

    // DEBUG SEGURO: muestra rounds/salt y el flujo rehash vs hashBD (enmascarado)
    await debugBcryptFlow({
      email,
      plainPassword: password,
      storedHash: user_completo.password,
    });

    // Verificación real (bcrypt NO desencripta; re-hash + compara)
    const isValid = await bcrypt.compare(password, user_completo.password);
    if (!isValid) throw new Error("Credenciales incorrectas");

    const user = await getUser(email);

    const token = jwt.sign(user, SECRET_KEY, { expiresIn: "7d" });

    res
      .cookie("access-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        // 7 días para empatar el JWT (opcional)
        maxAge: 1000 * 60 * 60 * 24 * 7,
      })
      .status(200)
      .json({
        message: "Accediendo con exito",
        data: user,
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

    res
      .clearCookie("access-token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
      })
      .status(204)
      .json({ message: "session" });
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
    const usuario = await getUser(user.email);
    if (!usuario) {
      res.clearCookie("access-token").status(204).json({ message: "session" });
      return;
    }

    res.status(200).json({ message: "Comprobando verificación", data: usuario });
  } catch (error) {
    console.error(error.message || "Error al crear usuario");
    res
      .clearCookie("access-token")
      .status(error.statusCode || error.status || 500)
      .json({
        message: error.message || "Error al registrar el usuario",
        data: null,
        error,
      });
  }
};

const getUsuariosAdmin = async (req, res) => {
  try {
    const usuarios = await executeQuery(`
      select ua.id, ua.name, ua.email, ua.created_at, ur.role_id, r.name as role_name,
             COUNT(up.permission_id) as permissions_extra, ua.active
      from users_admin ua
      left join user_roles ur on ur.user_id = ua.id
      left join roles r on r.id = ur.role_id
      left join user_permissions up on up.user_id = ua.id
      group by ua.id;
    `);

    res.status(200).json({ message: "Comprobando verificación", data: usuarios });
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
    const permisos = await executeQuery(
      `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.categoria,
        vw.origen,
        CASE WHEN vw.permission_id IS NOT NULL THEN 1 ELSE 0 END AS active
      FROM permissions p
      LEFT JOIN vw_permisos_by_user vw 
        ON vw.permission_id = p.id 
       AND vw.user_id = ?;`,
      [id || ""]
    );

    res.status(200).json({ message: "Permisos obtenidos con exito", data: permisos });
  } catch (error) {
    console.error(error.message || "Error al crear usuario");
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al registrar el usuario",
      data: null,
      error,
    });
  }
};

const createRole = async (req, res) => {
  try {
    const { name } = req.body;
    await executeQuery(`INSERT INTO roles (name) VALUES (?)`, [name || ""]);
    res.status(201).json({ message: "Creado con exito", data: null });
  } catch (error) {
    console.error(error.message || "Error al crear usuario");
    res.status(error.statusCode || error.status || 500).json({
      message: error.message || "Error al registrar el usuario",
      data: null,
      error,
    });
  }
};

const updatePermissionRole = async (req, res) => {
  try {
    const { id_permission, id_role, value } = req.body;

    if (value) {
      await executeQuery(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES (?,?)`,
        [id_role, id_permission]
      );
    } else {
      await executeQuery(
        `DELETE from role_permissions where role_id = ? AND permission_id = ?`,
        [id_role, id_permission]
      );
    }

    res.status(204).json({ message: "Actualizado con exito", data: null });
  } catch (error) {
    const message = error.message || "Error al actualizar el permiso";
    res.status(error.statusCode || error.status || 500).json({
      message,
      data: null,
      error,
    });
  }
};

const getPermissionByRole = async (req, res) => {
  try {
    const { id } = req.query;
    const permisos = await executeQuery(
      `SELECT 
        p.*,
        (CASE WHEN (rp.role_id is null) THEN 0 ELSE 1 END) as active 
      FROM permissions as p
      LEFT JOIN role_permissions as rp on rp.permission_id = p.id AND rp.role_id = ?;`,
      [id]
    );

    res.status(200).json({ message: "Actualizado con exito", data: permisos });
  } catch (error) {
    const message = error.message || "Error al obtener los permisos";
    res.status(error.statusCode || error.status || 500).json({
      message,
      data: null,
      error,
    });
  }
};

module.exports = {
  getPermissionByRole,
  updatePermissionRole,
  signUp,
  logIn,
  logOut,
  verifySession,
  getUsuariosAdmin,
  getPermisos,
  createRole,
};
