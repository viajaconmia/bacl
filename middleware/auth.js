const { API_KEY } = require("../config/auth");

function checkApiKey(req, res, next) {
  if (req.path === "/v1/stripe/payment-links-hook") {
    return next();
  }
  
  const apiKey = req.headers["x-api-key"];
  console.log(apiKey);
  console.log(API_KEY);
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

module.exports = {
  checkApiKey,
};
