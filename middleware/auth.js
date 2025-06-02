const { API_KEY } = require("../config/auth")

function checkApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'No autorizado: API Key incorrecta o faltante' });
  }

  next();
}

module.exports = {
  checkApiKey
}