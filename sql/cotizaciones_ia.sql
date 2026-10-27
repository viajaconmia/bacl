-- ===========================================================================
-- Cotizaciones de MIA con IA (cotizaciones-ia)
-- Ejecutar una sola vez en la base de datos. Es idempotente y solo AGREGA:
-- no modifica ni borra ninguna tabla existente (solicitudes, cart, etc.).
--
-- Las cotizaciones NO llevan precios: Operaciones los agrega al cotizar.
-- Autobús es un tipo más; el sistema de reservas aún no lo soporta, por eso
-- este flujo es independiente de `solicitudes` y del carrito de pago.
-- ===========================================================================

-- 1) Cotización: lo que el cliente pidió (texto, PDF, imagen, CSV o Excel) ya
--    estructurado por la IA y confirmado por la persona en MIA.
CREATE TABLE IF NOT EXISTS cotizaciones_ia (
  id_cotizacion VARCHAR(50) NOT NULL PRIMARY KEY,           -- "cot-<uuid>"
  id_usuario VARCHAR(64) NOT NULL,                          -- id del usuario en Supabase Auth
  id_agente VARCHAR(64) NULL,
  solicitante_nombre VARCHAR(255) NULL,
  solicitante_correo VARCHAR(255) NULL,
  origen_entrada VARCHAR(20) NOT NULL,                      -- texto|pdf|imagen|csv|excel|mixto
  resumen TEXT NOT NULL,
  notas TEXT NULL,
  items JSON NOT NULL,                                      -- QuoteItem[] (flight|car_rental|hotel|bus)
  tipos VARCHAR(100) NOT NULL,                              -- tipos presentes, p. ej. "flight,hotel"
  estado VARCHAR(20) NOT NULL DEFAULT 'nueva',              -- nueva|en_proceso|cotizada|cerrada|cancelada
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cotizaciones_ia_estado (estado),
  INDEX idx_cotizaciones_ia_created_at (created_at),
  INDEX idx_cotizaciones_ia_id_usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Archivos originales (viven en el bucket privado de Supabase Storage).
--    storage_path: ruta dentro del bucket (NULL si la subida falló en MIA).
--    url_archivo: ruta ESTABLE del endpoint de bacl que, con sesión admin y
--    permiso, entrega una URL firmada temporal para abrir el archivo.
CREATE TABLE IF NOT EXISTS cotizaciones_ia_archivos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_cotizacion VARCHAR(50) NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  tipo_mime VARCHAR(100) NOT NULL,
  tamano_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path VARCHAR(500) NULL,
  url_archivo VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cotizaciones_ia_archivos_cotizacion (id_cotizacion),
  CONSTRAINT fk_cotizaciones_ia_archivos_cotizacion
    FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones_ia (id_cotizacion)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Permiso que habilita la vista de cotizaciones de MIA (IA) en el admin.
--    Es distinto de `view.cotizaciones` (vista vieja de correos procesados): no lo toca.
--    Categoría "vista" para que aparezca en el array `permisos` del usuario
--    y el front pueda validarlo con hasAccess(PERMISOS.VISTAS.COTIZACIONES_IA).
INSERT INTO permissions (name, description, categoria)
SELECT 'view.cotizaciones_ia',
       'Acceso a la vista de cotizaciones solicitadas por clientes desde MIA (IA), separada de la vista de correos procesados',
       'vista'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE name = 'view.cotizaciones_ia'
);

-- 4) Otorga el permiso a PATY / Operaciones.
--    >>> Cambia el correo por el de cada persona y descomenta. Repite por usuario. <<<
-- INSERT INTO user_permissions (user_id, permission_id)
-- SELECT ua.id, p.id
-- FROM users_admin ua
-- JOIN permissions p ON p.name = 'view.cotizaciones_ia'
-- WHERE ua.email = 'CORREO_DE_PATY_U_OPERACIONES@dominio.com'
--   AND NOT EXISTS (
--     SELECT 1 FROM user_permissions up
--     WHERE up.user_id = ua.id AND up.permission_id = p.id
--   );
