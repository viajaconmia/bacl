const { API_KEY } = require("../config/auth");
const { SALT_ROUNDS, SECRET_KEY } = require("../lib/constant");
const jwt = require("jsonwebtoken");

function checkApiKey(req, res, next) {
  if (req.path === "/v1/stripe/payment-links-hook") {
    return next();
  }

  const apiKey = req.headers["x-api-key"];
  console.log("\n\n\n\n\n");
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

function isSignToken(req, res, next) {
  const token = req.headers["Authorization"]?.split(" ")[1];

  if (token) {
    const { jbi } = jwt.verify(token, SECRET_KEY);
  }
}

module.exports = {
  checkApiKey,
};
