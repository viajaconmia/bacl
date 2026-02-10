const { API_KEY } = require("../config/auth");
const { executeQuery } = require("../config/db");
const { SECRET_KEY } = require("../lib/constant");
const jwt = require("jsonwebtoken");

function checkApiKey(req, res, next) {
  if (req.path === "/v1/stripe/payment-links-hook") {
    return next();
  }

  const apiKey = req.headers["x-api-key"];
  if (!apiKey) {
    return res.status(401).json({
      error: {
        message: "No autorizado: API Key faltante",
        details: {
          apiKeyProvided: apiKey,
        },
      },
    });
  }

  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({
      error: {
        message: "No autorizado: API Key inválida",
        details: {
          apiKeyProvided: apiKey,
        },
      },
    });
  }

  next();
}

async function isSignToken(req, res, next) {
  try {
    console.log("verificando");
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) throw new Error("");

    const payload = jwt.verify(token, SECRET_KEY);
    const [permission] = await findPermissionByJti(payload.jti);

    if (!permission || permission.status != "issued") throw new Error("");

    await updateJti(payload.jti, "consumed");

    next();
  } catch (error) {
    console.log("Entrando a los permisos", error);
    res.status(500).json({
      message: "Hubo un error, intente mas tarde",
      data: null,
      error: null,
    });
  }
}

async function findPermissionByJti(jti) {
  try {
    return await executeQuery(`SELECT * FROM sign_jwt WHERE jti = ?`, [jti]);
  } catch (error) {
    throw error;
  }
}
async function updateJti(jti, status) {
  try {
    return await executeQuery(`UPDATE sign_jwt SET status = ? WHERE jti = ?`, [
      status,
      jti,
    ]);
  } catch (error) {
    throw error;
  }
}

module.exports = {
  checkApiKey,
  isSignToken,
};
