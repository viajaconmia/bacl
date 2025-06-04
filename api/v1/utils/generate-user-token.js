const jwt = require('jsonwebtoken');

// 🔧 CONFIGURACIÓN (reemplaza estos valores o usa variables de entorno)
const JWT_SECRET = 'TU_JWT_SECRET_DE_SUPABASE'; // ⚠️ Nunca lo expongas al frontend
const USER_ID = 'uuid-del-usuario-a-impersonar'; // <- este lo defines tú

// 🧱 Payload básico según formato de Supabase Auth
const payload = {
  sub: USER_ID,             // Este debe ser el id del usuario en Supabase
  role: 'authenticated',    // Este rol activa la política RLS
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // válido por 24 horas
};

// 🔐 Generar el token
const token = jwt.sign(payload, JWT_SECRET);

console.log('\n🔐 JWT generado para el usuario:', USER_ID);
console.log(token);
