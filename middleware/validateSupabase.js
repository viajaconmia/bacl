
const jwt = require("jsonwebtoken");
const SUPABASE_URL = process.env.SUPABASE_URL; 
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET; 
const ISSUER = `${SUPABASE_URL}/auth/v1`;

function supabaseAuth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  const token = h.slice(7);

  try {
    const payload = verify(token, SUPABASE_JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: "authenticated",
    });
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      ...payload,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado", detail: err.message });
  }
}

module.exports= { supabaseAuth };
