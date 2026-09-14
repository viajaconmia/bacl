-- ===========================================================================
-- Impersonación de usuarios internos (users_admin)
-- Ejecutar una sola vez en la base de datos.
-- ===========================================================================

-- 1) Tabla de auditoría: registra quién impersonó a quién y cuándo.
CREATE TABLE IF NOT EXISTS impersonation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  impersonator_id INT NULL,
  impersonator_email VARCHAR(255) NOT NULL,
  target_id INT NULL,
  target_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2) Permiso que habilita la ruta oculta de impersonación.
--    Categoría "vista" para que aparezca en el array `permisos` del usuario
--    y el front pueda validarlo con hasAccess(PERMISOS.VISTAS.IMPERSONATE).
INSERT INTO permissions (name, description, categoria)
SELECT 'view.impersonate',
       'Acceso a la vista oculta de impersonación de usuarios internos',
       'vista'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE name = 'view.impersonate'
);

-- 3) Otorga el permiso SOLO a tu usuario admin.
--    >>> Cambia 'TU_CORREO@dominio.com' por tu correo real y descomenta <<<
-- INSERT INTO user_permissions (user_id, permission_id)
-- SELECT ua.id, p.id
-- FROM users_admin ua
-- JOIN permissions p ON p.name = 'view.impersonate'
-- WHERE ua.email = 'TU_CORREO@dominio.com'
--   AND NOT EXISTS (
--     SELECT 1 FROM user_permissions up
--     WHERE up.user_id = ua.id AND up.permission_id = p.id
--   );
