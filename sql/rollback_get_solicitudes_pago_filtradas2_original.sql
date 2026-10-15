-- RESPALDO DE REFERENCIA (ya no es el mecanismo de rollback activo):
-- define get_solicitudes_pago_filtradas2 EXACTAMENTE como estaba antes de la
-- optimización del 2026-10-15 (vw_new_reservas + vw_details_agente +
-- vw_agente_primer_empresa), confirmado vía SHOW CREATE PROCEDURE.
--
-- DECIDIDO (2026-10-15): el SP original NUNCA se tocó ni se borró — sigue
-- viviendo en la base tal cual, con su nombre original. El switch a la
-- versión optimizada se hizo en CÓDIGO (bacl/api/v1/controller/
-- pago_proveedor.js, función getSolicitudes, ahora llama a
-- get_solicitudes_pago_filtradas2_optimizado), no renombrando SPs en la DB.
-- Si algo falla, el rollback real es revertir ese deploy en Vercel (o el
-- commit en git) para que el controller vuelva a llamar al nombre original
-- — no hace falta correr este archivo para nada.
--
-- Este archivo se deja solo como documentación/histórico de cómo era el SP
-- original, por si algún día se necesita consultar o el SP original se
-- pierde/modifica por error y hay que restaurarlo tal cual era.

DELIMITER $$

DROP PROCEDURE IF EXISTS get_solicitudes_pago_filtradas2 $$

CREATE DEFINER=`admin`@`%` PROCEDURE `get_solicitudes_pago_filtradas2`(
    IN p_folio                     VARCHAR(255),
    IN p_cliente                   VARCHAR(255),
    IN p_viajero                   VARCHAR(255),
    IN p_hotel                     VARCHAR(255),
    IN p_estado_solicitud          VARCHAR(100),
    IN p_estado_facturacion        VARCHAR(100),
    IN p_forma_pago                VARCHAR(100),
    IN p_created_start             DATETIME,
    IN p_created_end               DATETIME,
    IN p_check_in_start            DATE,
    IN p_check_in_end              DATE,
    IN p_check_out_start           DATE,
    IN p_check_out_end             DATE,
    IN p_id_cliente                VARCHAR(255),
    IN p_estado_reserva            VARCHAR(100),
    IN p_etapa_reservacion         VARCHAR(100),
    IN p_reservante                VARCHAR(255),
    IN p_metodo_pago_reserva       VARCHAR(100),
    IN p_fecha_reserva_start       DATETIME,
    IN p_fecha_reserva_end         DATETIME,
    IN p_filtrar_fecha_por_reserva VARCHAR(50),
    IN p_comentarios               VARCHAR(255),
    IN p_comentario_CXP            VARCHAR(255),
    IN p_estatus_pagos             VARCHAR(100),
    IN p_uuid_factura              VARCHAR(255),
    IN p_tipo_reserva_pago         VARCHAR(20),
    IN p_pagos_parciales           VARCHAR(10),
    IN p_facturas_parciales        VARCHAR(10),
    IN p_pagina                    INT,
    IN p_limite                    INT,
    IN p_canal_de_reservacion      VARCHAR(20),
    IN p_nombre_intermediario      VARCHAR(255),
    IN p_forma_pago_solicitada     VARCHAR(20),
    IN p_comentario_ap             VARCHAR(255),
    IN p_reserva_diferencia        VARCHAR(10)
)
BEGIN
    DECLARE _folio                     VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_folio), '');
    DECLARE _cliente                   VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_cliente), '');
    DECLARE _viajero                   VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_viajero), '');
    DECLARE _hotel                     VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_hotel), '');
    DECLARE _estado_solicitud          VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_estado_solicitud), '');
    DECLARE _estado_facturacion        VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_estado_facturacion), '');
    DECLARE _forma_pago                VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_forma_pago), '');
    DECLARE _id_cliente                VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_id_cliente), '');
    DECLARE _etapa_reservacion         VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT LOWER(NULLIF(TRIM(p_etapa_reservacion), ''));
    DECLARE _filtrar_fecha_por_reserva VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT LOWER(NULLIF(TRIM(p_filtrar_fecha_por_reserva), ''));
    DECLARE _created_start             DATETIME     DEFAULT p_created_start;
    DECLARE _created_end               DATETIME     DEFAULT p_created_end;
    DECLARE _comentarios               VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_comentarios), '');
    DECLARE _comentario_CXP            VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_comentario_CXP), '');
    DECLARE _estatus_pagos             VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_estatus_pagos), '');
    DECLARE _uuid_factura              VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULLIF(TRIM(p_uuid_factura), '');
    DECLARE _tipo_reserva_pago         VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT UPPER(NULLIF(TRIM(p_tipo_reserva_pago), ''));
    DECLARE _pagos_parciales           VARCHAR(10)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT UPPER(NULLIF(TRIM(p_pagos_parciales), ''));
    DECLARE _metodo_pago_reserva       VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT UPPER(NULLIF(TRIM(p_metodo_pago_reserva), ''));

    DECLARE _pagina INT DEFAULT GREATEST(1, COALESCE(p_pagina, 1));
    DECLARE _limite INT DEFAULT LEAST(200, GREATEST(1, COALESCE(p_limite, 50)));
    DECLARE _offset INT DEFAULT 0;

    SET _offset = (_pagina - 1) * _limite;
    SET SESSION group_concat_max_len = 1000000;

    SELECT GROUP_CONCAT(
        CONCAT('spp.`', COLUMN_NAME, '`')
        ORDER BY ORDINAL_POSITION
        SEPARATOR ',\n        '
    )
    INTO @cols_spp
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'solicitudes_pago_proveedor'
      AND COLUMN_NAME NOT IN ('id_enviado', 'id_creador', 'estado_solicitud', 'estado_facturacion');

    IF @cols_spp IS NULL OR @cols_spp = '' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se encontraron columnas de solicitudes_pago_proveedor';
    END IF;

    SET @folio                     = CASE WHEN _folio                     IS NULL THEN NULL ELSE CONVERT(_folio                     USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @cliente                   = CASE WHEN _cliente                   IS NULL THEN NULL ELSE CONVERT(_cliente                   USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @viajero                   = CASE WHEN _viajero                   IS NULL THEN NULL ELSE CONVERT(_viajero                   USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @hotel                     = CASE WHEN _hotel                     IS NULL THEN NULL ELSE CONVERT(_hotel                     USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @reservante            = CASE WHEN NULLIF(TRIM(p_reservante), '')            IS NULL THEN NULL ELSE CONVERT(UPPER(TRIM(p_reservante))            USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @canal_de_reservacion  = CASE WHEN NULLIF(TRIM(p_canal_de_reservacion), '')   IS NULL THEN NULL ELSE CONVERT(LOWER(TRIM(p_canal_de_reservacion)) USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @nombre_intermediario  = CASE WHEN NULLIF(TRIM(p_nombre_intermediario), '')   IS NULL THEN NULL ELSE CONVERT(TRIM(p_nombre_intermediario)          USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @forma_pago_solicitada = CASE WHEN NULLIF(TRIM(p_forma_pago_solicitada), '')  IS NULL THEN NULL ELSE CONVERT(LOWER(TRIM(p_forma_pago_solicitada))  USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @comentario_ap         = CASE WHEN NULLIF(TRIM(p_comentario_ap), '')          IS NULL THEN NULL ELSE CONVERT(TRIM(p_comentario_ap)                 USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @reserva_diferencia    = CASE WHEN NULLIF(TRIM(p_reserva_diferencia), '')     IS NULL THEN NULL ELSE CONVERT(UPPER(TRIM(p_reserva_diferencia))     USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @estado_solicitud          = CASE WHEN _estado_solicitud          IS NULL THEN NULL ELSE CONVERT(_estado_solicitud          USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @estado_facturacion        = CASE WHEN _estado_facturacion        IS NULL THEN NULL ELSE CONVERT(_estado_facturacion        USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @forma_pago                = CASE WHEN _forma_pago                IS NULL THEN NULL ELSE CONVERT(_forma_pago                USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @id_cliente                = CASE WHEN _id_cliente                IS NULL THEN NULL ELSE CONVERT(_id_cliente                USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @etapa_reservacion         = CASE WHEN _etapa_reservacion         IS NULL THEN NULL ELSE CONVERT(_etapa_reservacion         USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @filtrar_fecha_por_reserva = CASE WHEN _filtrar_fecha_por_reserva IS NULL THEN NULL ELSE CONVERT(_filtrar_fecha_por_reserva USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @comentarios               = CASE WHEN _comentarios               IS NULL THEN NULL ELSE CONVERT(_comentarios               USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @comentario_CXP            = CASE WHEN _comentario_CXP            IS NULL THEN NULL ELSE CONVERT(_comentario_CXP            USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @estatus_pagos             = CASE WHEN _estatus_pagos             IS NULL THEN NULL ELSE CONVERT(_estatus_pagos             USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @uuid_factura              = CASE WHEN _uuid_factura              IS NULL THEN NULL ELSE CONVERT(_uuid_factura              USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @tipo_reserva_pago         = CASE WHEN _tipo_reserva_pago         IS NULL THEN NULL ELSE CONVERT(_tipo_reserva_pago         USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @pagos_parciales           = CASE WHEN _pagos_parciales           IS NULL THEN NULL ELSE CONVERT(_pagos_parciales           USING utf8mb4) COLLATE utf8mb4_unicode_ci END;
    SET @metodo_pago_reserva       = CASE WHEN _metodo_pago_reserva       IS NULL THEN NULL ELSE CONVERT(_metodo_pago_reserva       USING utf8mb4) COLLATE utf8mb4_unicode_ci END;

    SET @created_start       = _created_start;
    SET @created_end         = _created_end;
    SET @check_in_start      = p_check_in_start;
    SET @check_in_end        = p_check_in_end;
    SET @check_out_start     = p_check_out_start;
    SET @check_out_end       = p_check_out_end;
    SET @fecha_reserva_start = p_fecha_reserva_start;
    SET @fecha_reserva_end   = p_fecha_reserva_end;

    IF @filtrar_fecha_por_reserva IS NULL
       AND (p_fecha_reserva_start IS NOT NULL OR p_fecha_reserva_end IS NOT NULL)
    THEN
        SET @filtrar_fecha_por_reserva = 'created_at';
    END IF;

    SET @limite = _limite;
    SET @offset = _offset;

    SET @sql = CONCAT('
WITH
PagosAgregados AS (
    SELECT
        p.id_servicio,
        JSON_ARRAYAGG(JSON_OBJECT(
            ''id_pago'',        p.id_pago,
            ''metodo_de_pago'', p.metodo_de_pago,
            ''tipo_de_pago'',   p.tipo_de_pago
        )) AS detalles_pagos_json,
        SUM(p.monto_a_credito) AS monto_a_credito_total
    FROM pagos p
    GROUP BY p.id_servicio
),
SumaCredito AS (
    SELECT
        pc.id_servicio,
        SUM(pc.pendiente_por_cobrar) AS pendiente_por_cobrar_total
    FROM pagos_credito pc
    GROUP BY pc.id_servicio
),
PagosFacturasAgg AS (
    SELECT
        vpfp.id_solicitud,
        JSON_ARRAYAGG(JSON_OBJECT(
            ''id_relacion_pago_factura'', vpfp.id_relacion_pago_factura,
            ''id_pago_proveedor'',        vpfp.id_pago_proveedor,
            ''id_solicitud'',             vpfp.id_solicitud,
            ''monto_solicitado'',         vpfp.monto_solicitado,
            ''id_factura'',               vpfp.id_factura,
            ''monto_facturado'',          vpfp.monto_facturado,
            ''uuid_factura'',             vpfp.uuid_factura,
            ''url_pdf'',                  vpfp.url_pdf,
            ''url_xml'',                  vpfp.url_xml,
            ''rfc_emisor'',               vpfp.rfc_emisor,
            ''id_agente'',                vpfp.id_agente,
            ''total'',                    vpfp.total,
            ''subtotal'',                 vpfp.subtotal,
            ''impuestos'',                vpfp.impuestos,
            ''uso_cfdi'',                 vpfp.uso_cfdi,
            ''moneda'',                   vpfp.moneda,
            ''forma_pago'',               vpfp.forma_pago,
            ''metodo_pago'',              vpfp.metodo_pago,
            ''total_moneda_O'',           vpfp.total_moneda_O,
            ''sub_total_moneda_O'',       vpfp.sub_total_moneda_O,
            ''impuestos_moneda_O'',       vpfp.impuestos_moneda_O,
            ''razon_social_fiscal'',      vpfp.razon_social_fiscal,
            ''id_booking'',               vpfp.id_booking,
            ''codigo_confirmacion'',      vpfp.codigo_confirmacion
        )) AS pagos_facturas_proveedores_json,
        SUM(COALESCE(CAST(vpfp.monto_facturado AS DECIMAL(12,2)), 0)) AS total_facturado_en_pfp,
        0 AS total_pagado_en_pfp
    FROM vw_pagos_facturas_proveedores_detalle vpfp
    GROUP BY vpfp.id_solicitud
),
TitularEnvioMap AS (
    SELECT x.id_enviado_key, MAX(x.Titular) AS Titular
    FROM (
        SELECT
            TRIM(CAST(t.`idTitular` AS CHAR(255) CHARACTER SET utf8mb4)) COLLATE utf8mb4_unicode_ci AS id_enviado_key,
            t.`Titular`
        FROM titular t
        WHERE t.`idTitular` IS NOT NULL AND TRIM(CAST(t.`idTitular` AS CHAR)) <> ''''
        UNION ALL
        SELECT
            TRIM(CAST(t.`identificacion` AS CHAR(255) CHARACTER SET utf8mb4)) COLLATE utf8mb4_unicode_ci,
            t.`Titular`
        FROM titular t
        WHERE t.`identificacion` IS NOT NULL AND TRIM(CAST(t.`identificacion` AS CHAR)) <> ''''
    ) x
    GROUP BY x.id_enviado_key
),
SppBookingMap AS (
    SELECT DISTINCT spp.id_solicitud_proveedor, bs.id_booking
    FROM solicitudes_pago_proveedor spp
    INNER JOIN booking_solicitud bs
        ON CONVERT(bs.id_solicitud USING utf8mb4) COLLATE utf8mb4_unicode_ci =
           CONVERT(CAST(spp.id_solicitud_proveedor AS CHAR(40)) USING utf8mb4) COLLATE utf8mb4_unicode_ci
)

SELECT
    COUNT(*) OVER() AS total_filtrado,
    COALESCE(tem.Titular, CAST(spp.id_enviado AS CHAR CHARACTER SET utf8mb4)) AS id_enviado,
    ', @cols_spp, ',
    COALESCE(ua.name, spp.id_creador) AS id_creador,
    spp.estado_solicitud,
    CASE
        WHEN UPPER(TRIM(CONVERT(spp.estado_facturacion USING utf8mb4))) COLLATE utf8mb4_unicode_ci
             IN (''COMPLETADO'' COLLATE utf8mb4_unicode_ci, ''FACTURADO'' COLLATE utf8mb4_unicode_ci)
        THEN ''FACTURADO''
        ELSE spp.estado_facturacion
    END AS estado_facturacion,
    m.id_booking,
    b.updated_at        AS booking_updated_at,
    b.is_comisionable AS is_comisionable,
    r.id_solicitud,
    r.id_servicio,
    r.id_viajero,
    r.viajero,
    r.type,
    r.etapa_reservacion,
    r.estado,
    r.total,
    r.costo_total,
    r.check_in,
    r.check_out,
    r.origen,
    r.destino,
    r.horario_salida,
    r.horario_llegada,
    r.reservante,
    r.proveedor,
    r.tipo_cuarto_vuelo,
    r.codigo_confirmacion,
    r.metodo_pago,
    r.comments,
    r.nuevo_incluye_desayuno,
    r.id_hospedaje,
    r.id_renta_autos,
    r.id_viaje_aereo,
    r.id_agente,
    r.agente,
    r.nombre_comercial,
    r.correo_cliente,
    r.telefono_cliente,
    r.id_intermediario,
    r.intermediario,
    r.created_at        AS created_at_reserva,
    r.viajero           AS nombre_viajero,
    r.viajero           AS nombre_viajero_completo,
    r.type              AS tipo_reserva,
    r.etapa_reservacion AS estado_reserva,
    r.estado            AS status,
    r.proveedor         AS hotel,
    r.tipo_cuarto_vuelo AS room,
    r.agente            AS nombre_agente,
    CONCAT_WS('' '', vwa.primer_nombre, vwa.segundo_nombre,
                     vwa.apellido_paterno, vwa.apellido_materno) AS nombre_agente_completo,
    vwa.correo,
    vwa.telefono,
    vwae.razon_social,
    vwae.rfc            AS rfc_empresa_agente,
    vwae.tipo_persona,
    s.created_at        AS servicio_created_at,
    s.is_credito,
    pa.detalles_pagos_json       AS detalles_pagos,
    pa.monto_a_credito_total,
    sc.pendiente_por_cobrar_total AS pendiente_por_cobrar,
    t.ultimos_4,
    t.banco_emisor,
    t.tipo_tarjeta,
    COALESCE(NULLIF(spp.id_proveedor, ''''), r.id_proveedor) AS id_proveedor_resuelto,
    (
        SELECT pdf.rfc
        FROM proveedores_datos_fiscales_relacion pdfrel
        INNER JOIN proveedores_datos_fiscales pdf ON pdf.id = pdfrel.id_datos_fiscales
        WHERE CONVERT(pdfrel.id_proveedor USING utf8mb4) COLLATE utf8mb4_unicode_ci =
              CONVERT(COALESCE(NULLIF(spp.id_proveedor, ''''), r.id_proveedor) USING utf8mb4) COLLATE utf8mb4_unicode_ci
        ORDER BY pdfrel.id_datos_fiscales DESC
        LIMIT 1
    ) AS rfc_proveedor,
    COALESCE(pfp.pagos_facturas_proveedores_json, JSON_ARRAY()) AS pagos_facturas_proveedores_json,
    COALESCE(pfp.total_facturado_en_pfp, 0)                     AS total_facturado_en_pfp,
    COALESCE(pfp.total_pagado_en_pfp, 0)                        AS total_pagado_en_pfp

FROM SppBookingMap m

INNER JOIN solicitudes_pago_proveedor spp
    ON CONVERT(spp.id_solicitud_proveedor USING utf8mb4) COLLATE utf8mb4_unicode_ci =
       CONVERT(m.id_solicitud_proveedor USING utf8mb4) COLLATE utf8mb4_unicode_ci

LEFT JOIN users_admin ua        ON ua.id            = spp.id_creador
LEFT JOIN TitularEnvioMap tem
    ON tem.id_enviado_key =
       TRIM(CAST(spp.id_enviado AS CHAR(255) CHARACTER SET utf8mb4)) COLLATE utf8mb4_unicode_ci
LEFT JOIN vw_new_reservas r     ON r.id_booking     = m.id_booking
LEFT JOIN bookings b            ON b.id_booking     = m.id_booking
LEFT JOIN servicios s           ON s.id_servicio    = r.id_servicio
LEFT JOIN tarjetas t            ON t.id             = spp.id_tarjeta_solicitada
LEFT JOIN vw_details_agente vwa ON vwa.id_agente    = r.id_agente
LEFT JOIN vw_agente_primer_empresa vwae ON vwae.id_agente = r.id_agente
LEFT JOIN PagosAgregados pa     ON pa.id_servicio   = r.id_servicio
LEFT JOIN SumaCredito sc        ON sc.id_servicio   = r.id_servicio
LEFT JOIN PagosFacturasAgg pfp
    ON CONVERT(pfp.id_solicitud USING utf8mb4) COLLATE utf8mb4_unicode_ci =
       CONVERT(spp.id_solicitud_proveedor USING utf8mb4) COLLATE utf8mb4_unicode_ci

WHERE
    (CONVERT(spp.estado_solicitud USING utf8mb4) COLLATE utf8mb4_unicode_ci <> ''CANCELADA'' OR spp.estado_solicitud IS NULL)

    AND (@folio IS NULL OR CONVERT(r.codigo_confirmacion USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @folio, ''%'') COLLATE utf8mb4_unicode_ci)

    AND (
        @cliente IS NULL
        OR CONVERT(r.nombre_comercial  USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @cliente, ''%'') COLLATE utf8mb4_unicode_ci
        OR CONVERT(r.reservante        USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @cliente, ''%'') COLLATE utf8mb4_unicode_ci
        OR CONVERT(r.correo_cliente    USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @cliente, ''%'') COLLATE utf8mb4_unicode_ci
        OR CONVERT(r.telefono_cliente  USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @cliente, ''%'') COLLATE utf8mb4_unicode_ci
    )

    AND (@viajero IS NULL OR CONVERT(r.viajero   USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @viajero, ''%'') COLLATE utf8mb4_unicode_ci)
    AND (@hotel   IS NULL OR CONVERT(r.proveedor USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @hotel,   ''%'') COLLATE utf8mb4_unicode_ci)

    AND (
        @estado_solicitud IS NULL
        OR UPPER(TRIM(CONVERT(spp.estado_solicitud USING utf8mb4))) COLLATE utf8mb4_unicode_ci =
           UPPER(TRIM(@estado_solicitud)) COLLATE utf8mb4_unicode_ci
    )

    AND (
        @estado_facturacion IS NULL
        OR (UPPER(TRIM(@estado_facturacion)) COLLATE utf8mb4_unicode_ci = ''COMPLETO'' COLLATE utf8mb4_unicode_ci
            AND UPPER(TRIM(CONVERT(spp.estado_facturacion USING utf8mb4))) COLLATE utf8mb4_unicode_ci
                IN (''COMPLETADO'' COLLATE utf8mb4_unicode_ci, ''FACTURADO'' COLLATE utf8mb4_unicode_ci))
        OR (UPPER(TRIM(@estado_facturacion)) COLLATE utf8mb4_unicode_ci <> ''COMPLETO'' COLLATE utf8mb4_unicode_ci
            AND UPPER(TRIM(CONVERT(spp.estado_facturacion USING utf8mb4))) COLLATE utf8mb4_unicode_ci =
                UPPER(TRIM(@estado_facturacion)) COLLATE utf8mb4_unicode_ci)
    )

    AND (@forma_pago IS NULL OR LOWER(TRIM(CONVERT(spp.forma_pago_solicitada USING utf8mb4))) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(@forma_pago)) COLLATE utf8mb4_unicode_ci)

    AND (@created_start  IS NULL OR spp.created_at >= @created_start)
    AND (@created_end    IS NULL OR spp.created_at <= @created_end)
    AND (@check_in_start IS NULL OR DATE(r.check_in)  >= @check_in_start)
    AND (@check_in_end   IS NULL OR DATE(r.check_in)  <= @check_in_end)
    AND (@check_out_start IS NULL OR DATE(r.check_out) >= @check_out_start)
    AND (@check_out_end   IS NULL OR DATE(r.check_out) <= @check_out_end)

    AND (@id_cliente IS NULL OR CONVERT(CAST(r.id_agente AS CHAR(50)) USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @id_cliente, ''%'') COLLATE utf8mb4_unicode_ci)

    AND (
        @etapa_reservacion IS NULL
        OR (
            @etapa_reservacion COLLATE utf8mb4_unicode_ci = ''check_in'' COLLATE utf8mb4_unicode_ci
            AND DATE(r.check_in) > CURDATE()
        )
        OR (
            @etapa_reservacion COLLATE utf8mb4_unicode_ci = ''in home'' COLLATE utf8mb4_unicode_ci
            AND DATE(r.check_in)  <= CURDATE()
            AND DATE(r.check_out) >  CURDATE()
        )
        OR (
            @etapa_reservacion COLLATE utf8mb4_unicode_ci = ''check_out'' COLLATE utf8mb4_unicode_ci
            AND DATE(r.check_out) <= CURDATE()
        )
    )

    AND (@comentarios    IS NULL OR CONVERT(spp.comentarios    USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @comentarios,    ''%'') COLLATE utf8mb4_unicode_ci)
    AND (@comentario_CXP IS NULL OR CONVERT(spp.comentario_CXP USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @comentario_CXP, ''%'') COLLATE utf8mb4_unicode_ci)

    AND (
        (@fecha_reserva_start IS NULL AND @fecha_reserva_end IS NULL)
        OR (@filtrar_fecha_por_reserva COLLATE utf8mb4_unicode_ci = ''created_at'' COLLATE utf8mb4_unicode_ci
            AND (@fecha_reserva_start IS NULL OR r.created_at >= @fecha_reserva_start)
            AND (@fecha_reserva_end   IS NULL OR r.created_at <= @fecha_reserva_end))
        OR (@filtrar_fecha_por_reserva COLLATE utf8mb4_unicode_ci = ''check_in'' COLLATE utf8mb4_unicode_ci
            AND (@fecha_reserva_start IS NULL OR DATE(r.check_in) >= DATE(@fecha_reserva_start))
            AND (@fecha_reserva_end   IS NULL OR DATE(r.check_in) <= DATE(@fecha_reserva_end)))
        OR (@filtrar_fecha_por_reserva COLLATE utf8mb4_unicode_ci = ''check_out'' COLLATE utf8mb4_unicode_ci
            AND (@fecha_reserva_start IS NULL OR DATE(r.check_out) >= DATE(@fecha_reserva_start))
            AND (@fecha_reserva_end   IS NULL OR DATE(r.check_out) <= DATE(@fecha_reserva_end)))
    )

    AND (
        @estatus_pagos IS NULL
        OR (@estatus_pagos COLLATE utf8mb4_unicode_ci = ''pendiente'' COLLATE utf8mb4_unicode_ci
            AND (LOWER(TRIM(CONVERT(COALESCE(spp.estatus_pagos, '''') USING utf8mb4))) COLLATE utf8mb4_unicode_ci IN (''enviado_a_pago'' COLLATE utf8mb4_unicode_ci, '''' COLLATE utf8mb4_unicode_ci)
                 OR spp.estatus_pagos IS NULL))
        OR (@estatus_pagos COLLATE utf8mb4_unicode_ci <> ''pendiente'' COLLATE utf8mb4_unicode_ci
            AND LOWER(TRIM(CONVERT(spp.estatus_pagos USING utf8mb4))) COLLATE utf8mb4_unicode_ci =
                LOWER(TRIM(@estatus_pagos)) COLLATE utf8mb4_unicode_ci)
    )

    AND (
        @uuid_factura IS NULL
        OR EXISTS (
            SELECT 1
            FROM vw_pagos_facturas_proveedores_detalle vpfp2
            WHERE CONVERT(vpfp2.id_solicitud USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                  CONVERT(spp.id_solicitud_proveedor USING utf8mb4) COLLATE utf8mb4_unicode_ci
              AND CONVERT(vpfp2.uuid_factura USING utf8mb4) COLLATE utf8mb4_unicode_ci
                  LIKE CONCAT(''%'', @uuid_factura, ''%'') COLLATE utf8mb4_unicode_ci
        )
    )

    AND (
        @tipo_reserva_pago IS NULL
        OR (@tipo_reserva_pago COLLATE utf8mb4_unicode_ci = ''CREDITO'' COLLATE utf8mb4_unicode_ci
            AND LOWER(TRIM(CONVERT(spp.forma_pago_solicitada USING utf8mb4))) COLLATE utf8mb4_unicode_ci = ''credit'' COLLATE utf8mb4_unicode_ci)
        OR (@tipo_reserva_pago COLLATE utf8mb4_unicode_ci = ''PREPAGO'' COLLATE utf8mb4_unicode_ci
            AND (spp.forma_pago_solicitada IS NULL
                 OR LOWER(TRIM(CONVERT(spp.forma_pago_solicitada USING utf8mb4))) COLLATE utf8mb4_unicode_ci <> ''credit'' COLLATE utf8mb4_unicode_ci))
    )

    AND (
        @pagos_parciales IS NULL
        OR (
            @pagos_parciales COLLATE utf8mb4_unicode_ci = ''SI'' COLLATE utf8mb4_unicode_ci
            AND spp.saldo IS NOT NULL
            AND spp.saldo <> 0
            AND spp.saldo <> spp.monto_solicitado
        )
        OR (
            @pagos_parciales COLLATE utf8mb4_unicode_ci = ''NO'' COLLATE utf8mb4_unicode_ci
            AND NOT (spp.saldo IS NOT NULL AND spp.saldo <> 0 AND spp.saldo <> spp.monto_solicitado)
        )
    )

    AND (
        @metodo_pago_reserva IS NULL
        OR (@metodo_pago_reserva COLLATE utf8mb4_unicode_ci = ''CREDITO'' COLLATE utf8mb4_unicode_ci
            AND LOWER(TRIM(CONVERT(r.metodo_pago USING utf8mb4))) COLLATE utf8mb4_unicode_ci
                LIKE ''%credito%'' COLLATE utf8mb4_unicode_ci)
        OR (@metodo_pago_reserva COLLATE utf8mb4_unicode_ci = ''PREPAGO'' COLLATE utf8mb4_unicode_ci
            AND LOWER(TRIM(CONVERT(r.metodo_pago USING utf8mb4))) COLLATE utf8mb4_unicode_ci
                LIKE ''%contado%'' COLLATE utf8mb4_unicode_ci)
    )

    AND (
        @reservante IS NULL
        OR UPPER(CONVERT(r.reservante USING utf8mb4)) COLLATE utf8mb4_unicode_ci
           LIKE CONCAT(''%'', UPPER(@reservante), ''%'') COLLATE utf8mb4_unicode_ci
    )

    AND (
        @canal_de_reservacion IS NULL
        OR (@canal_de_reservacion COLLATE utf8mb4_unicode_ci = ''directo''       COLLATE utf8mb4_unicode_ci AND r.id_intermediario IS NULL)
        OR (@canal_de_reservacion COLLATE utf8mb4_unicode_ci = ''intermediario'' COLLATE utf8mb4_unicode_ci AND r.id_intermediario IS NOT NULL)
    )

    AND (
        @nombre_intermediario IS NULL
        OR CONVERT(r.intermediario USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @nombre_intermediario, ''%'') COLLATE utf8mb4_unicode_ci
    )

    AND (
        @forma_pago_solicitada IS NULL
        OR LOWER(TRIM(CONVERT(spp.forma_pago_solicitada USING utf8mb4))) COLLATE utf8mb4_unicode_ci =
           LOWER(TRIM(@forma_pago_solicitada)) COLLATE utf8mb4_unicode_ci
    )

    AND (
        @comentario_ap IS NULL
        OR CONVERT(spp.comentario_AP USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT(''%'', @comentario_ap, ''%'') COLLATE utf8mb4_unicode_ci
    )

    AND (
        @reserva_diferencia IS NULL
        OR (@reserva_diferencia COLLATE utf8mb4_unicode_ci = ''SI'' COLLATE utf8mb4_unicode_ci
            AND ROUND(COALESCE(spp.monto_solicitado, 0), 2) <> ROUND(COALESCE(pfp.total_facturado_en_pfp, 0), 2))
        OR (@reserva_diferencia COLLATE utf8mb4_unicode_ci = ''NO'' COLLATE utf8mb4_unicode_ci
            AND ROUND(COALESCE(spp.monto_solicitado, 0), 2) = ROUND(COALESCE(pfp.total_facturado_en_pfp, 0), 2))
    )

ORDER BY COALESCE(s.created_at, r.check_in, spp.created_at) DESC
LIMIT ? OFFSET ?
');

    PREPARE stmt FROM @sql;
    EXECUTE stmt USING @limite, @offset;
    DEALLOCATE PREPARE stmt;

END $$

DELIMITER ;
