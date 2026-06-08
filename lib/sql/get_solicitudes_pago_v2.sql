DELIMITER $$

DROP PROCEDURE IF EXISTS get_solicitudes_pago_v2 $$

CREATE PROCEDURE get_solicitudes_pago_v2(
  IN p_folio               VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,   -- codigo_confirmacion / folio
  IN p_cliente             VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,   -- nombre agente
  IN p_viajero             VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_hotel               VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_estado_solicitud    VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_estado_facturacion  VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_forma_pago          VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_created_start       DATETIME,
  IN p_created_end         DATETIME,
  IN p_check_in_start      DATE,
  IN p_check_in_end        DATE,
  IN p_check_out_start     DATE,
  IN p_check_out_end       DATE,
  IN p_id_cliente          VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_estado_reserva      VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_etapa_reservacion   VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_reservante          VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_metodo_pago_reserva VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_fecha_reserva_start DATETIME,
  IN p_fecha_reserva_end   DATETIME,
  IN p_filtrar_fecha_por   VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,   -- 'check_in' | 'check_out' | 'created_at'
  IN p_comentarios         VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_comentario_cxp      VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_estatus_pagos       VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_uuid_factura        VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_pag                 INT,
  IN p_limite              INT,
  IN p_bucket              VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
)
BEGIN
  DECLARE v_offset INT DEFAULT 0;

  IF p_pag   IS NULL OR p_pag   < 1 THEN SET p_pag   = 1;  END IF;
  IF p_limite IS NULL OR p_limite < 1 THEN SET p_limite = 50; END IF;
  SET v_offset = (p_pag - 1) * p_limite;

  SELECT
    -- ── solicitudes_pago_proveedor ──────────────────────────────────────────
    spp.id_solicitud_proveedor,
    spp.id_booking,
    spp.id_proveedor,
    spp.codigo_confirmacion,
    spp.created_at,
    spp.fecha_solicitud,
    spp.monto_solicitado,
    spp.saldo,
    spp.forma_pago_solicitada,
    spp.id_tarjeta_solicitada,
    spp.usuario_solicitante,
    spp.usuario_generador,
    spp.comentarios,
    spp.notas_internas,
    spp.comentario_AP,
    spp.estado_solicitud,
    spp.estado_facturacion,
    spp.estatus_pagos,
    spp.comentario_CXP,
    spp.monto_facturado,
    spp.monto_por_facturar,
    spp.is_ajuste,
    spp.comentario_ajuste,
    spp.consolidado,
    spp.propina,
    spp.monto_adicional,
    spp.monto_original,

    -- ── vw_details_booking ──────────────────────────────────────────────────
    db.proveedor             AS hotel,
    db.nombre_viajero,
    db.nombre_agente         AS agente,
    db.check_in,
    db.check_out,
    db.tipo_cuarto_vuelo     AS room,
    db.costo_total,
    db.total,
    db.metodo_pago,
    db.estado                AS status,
    db.id_agente,
    db.id_viajero,
    db.type                  AS tipo_reserva,
    db.prefacturado,
    db.id_confirmacion,

    -- ── tarjetas ────────────────────────────────────────────────────────────
    t.ultimos_4,
    t.banco_emisor,
    t.tipo_tarjeta,

    -- ── proveedores_datos_fiscales ──────────────────────────────────────────
    pdf.rfc                  AS rfc_proveedor,
    pdf.razon_social         AS razon_social_proveedor,

    -- ── pagos (uno por solicitud, agregado como JSON) ───────────────────────
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'id_pago_proveedores',    pp.id_pago_proveedores,
          'id_solicitud_proveedor', pp.id_solicitud_proveedor,
          'monto_pagado',           pp.monto_pagado,
          'fecha_pago',             pp.fecha_pago,
          'estatus',                pp.estatus,
          'metodo_de_pago',         pp.metodo_de_pago,
          'numero_comprobante',     pp.numero_comprobante,
          'concepto',               pp.concepto,
          'total',                  pp.total,
          'moneda',                 pp.moneda,
          'cuenta_origen',          pp.cuenta_origen,
          'cuenta_destino',         pp.cuenta_destino,
          'referencia_pago',        pp.referencia_pago,
          'nombre_beneficiario',    pp.nombre_beneficiario,
          'razon_social',           pp.razon_social,
          'origen_pago',            pp.origen_pago
        )
      )
      FROM pago_proveedores pp
      WHERE pp.id_solicitud_proveedor = spp.id_solicitud_proveedor
    ) AS pagos_json,

    -- ── facturas (vínculo real: vw_pagos_facturas_proveedores_detalle.id_solicitud;
    --    facturas_pago_proveedor.id_solicitud_proveedor está siempre NULL, por eso
    --    se usa la vista como fuente de verdad y se reenlaza a la tabla solo para
    --    recuperar columnas que no expone la vista) ───────────────────────────
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'id_factura_proveedor',  fp.id_factura_proveedor,
          'uuid_cfdi',             v.uuid_factura,
          'rfc_emisor',            v.rfc_emisor,
          'razon_social_emisor',   v.razon_social_fiscal,
          'monto_facturado',       v.monto_facturado,
          'total',                 v.total,
          'subtotal',              v.subtotal,
          'impuestos',             v.impuestos,
          'fecha_factura',         fp.fecha_factura,
          'estado_factura',        fp.estado_factura,
          'estado',                fp.estado,
          'uso_cfdi',              fp.uso_cfdi,
          'forma_pago',            fp.forma_pago,
          'metodo_pago',           fp.metodo_pago,
          'moneda',                fp.moneda,
          'url_pdf',               v.url_pdf,
          'url_xml',               v.url_xml,
          'total_moneda_O',        fp.total_moneda_O,
          'propina',               fp.propina,
          'created_at',            fp.created_at
        )
      )
      FROM vw_pagos_facturas_proveedores_detalle v
      LEFT JOIN facturas_pago_proveedor fp
        ON CONVERT(fp.id_factura_proveedor USING utf8mb4) COLLATE utf8mb4_unicode_ci
         = CONVERT(v.id_factura            USING utf8mb4) COLLATE utf8mb4_unicode_ci
      WHERE v.id_solicitud = spp.id_solicitud_proveedor
    ) AS facturas_json,

    -- ── razones sociales ────────────────────────────────────────────────────
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'razon_social', rs,
          'rfc',          rfc,
          'origen',       origen
        )
      )
      FROM (
        SELECT DISTINCT
          UPPER(TRIM(CONVERT(v.razon_social_fiscal USING utf8mb4) COLLATE utf8mb4_unicode_ci)) AS rs,
          CONVERT(v.rfc_emisor USING utf8mb4) COLLATE utf8mb4_unicode_ci                       AS rfc,
          _utf8mb4'factura' COLLATE utf8mb4_unicode_ci                                         AS origen
        FROM vw_pagos_facturas_proveedores_detalle v
        WHERE v.id_solicitud = spp.id_solicitud_proveedor
          AND v.razon_social_fiscal IS NOT NULL
          AND TRIM(v.razon_social_fiscal) <> ''

        UNION

        SELECT DISTINCT
          UPPER(TRIM(CONVERT(pdf2.razon_social USING utf8mb4) COLLATE utf8mb4_unicode_ci)) AS rs,
          CONVERT(pdf2.rfc USING utf8mb4) COLLATE utf8mb4_unicode_ci                       AS rfc,
          _utf8mb4'proveedor' COLLATE utf8mb4_unicode_ci                                   AS origen
        FROM proveedores_datos_fiscales_relacion pdfr2
        JOIN proveedores_datos_fiscales pdf2
          ON pdfr2.id_datos_fiscales = pdf2.id
        WHERE pdfr2.id_proveedor = spp.id_proveedor
          AND pdfr2.active       = 1
          AND pdf2.razon_social  IS NOT NULL
          AND TRIM(pdf2.razon_social) <> ''
      ) AS _rs
    ) AS razones_sociales_json

  FROM solicitudes_pago_proveedor spp

  LEFT JOIN vw_details_booking db
    ON spp.id_booking = db.id_booking

  LEFT JOIN tarjetas t
    ON spp.id_tarjeta_solicitada = t.id

  LEFT JOIN (
    SELECT id_proveedor, MIN(id_datos_fiscales) AS id_datos_fiscales
    FROM proveedores_datos_fiscales_relacion
    WHERE active = 1
    GROUP BY id_proveedor
  ) pdfr ON spp.id_proveedor = pdfr.id_proveedor

  LEFT JOIN proveedores_datos_fiscales pdf
    ON pdfr.id_datos_fiscales = pdf.id

  WHERE 1 = 1

  -- excluye canceladas salvo cuando el bucket las pide explícitamente
  AND (
    p_bucket = 'canceladas'
    OR UPPER(TRIM(CONVERT(spp.estado_solicitud USING utf8mb4) COLLATE utf8mb4_unicode_ci)) <> 'CANCELADA'
  )

  -- ── Bucket ─────────────────────────────────────────────────────────────────
  AND (
       p_bucket IS NULL OR p_bucket = '' OR p_bucket = 'all'
    OR (p_bucket = 'ap_credito'        AND UPPER(TRIM(CONVERT(spp.estado_solicitud      USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = 'SOLICITADA')
    OR (p_bucket = 'spei'              AND UPPER(TRIM(CONVERT(spp.estado_solicitud      USING utf8mb4) COLLATE utf8mb4_unicode_ci)) IN ('TRANSFERENCIA_SOLICITADA','DISPERSION'))
    OR (p_bucket = 'pago_tdc'          AND LOWER(TRIM(CONVERT(spp.forma_pago_solicitada USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = 'card'
                                       AND UPPER(TRIM(CONVERT(spp.estado_solicitud      USING utf8mb4) COLLATE utf8mb4_unicode_ci)) <> 'CANCELADA')
    OR (p_bucket = 'pago_link'         AND LOWER(TRIM(CONVERT(spp.forma_pago_solicitada USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = 'link'
                                       AND UPPER(TRIM(CONVERT(spp.estado_solicitud      USING utf8mb4) COLLATE utf8mb4_unicode_ci)) <> 'CANCELADA')
    OR (p_bucket = 'pendiente_credito' AND UPPER(TRIM(CONVERT(spp.estado_solicitud      USING utf8mb4) COLLATE utf8mb4_unicode_ci)) IN ('CUPON ENVIADO','CARTA_ENVIADA'))
    OR (p_bucket = 'pagada'            AND UPPER(TRIM(CONVERT(spp.estado_solicitud      USING utf8mb4) COLLATE utf8mb4_unicode_ci)) IN ('PAGADO TARJETA','PAGADO TRANSFERENCIA','PAGADO LINK'))
    OR (p_bucket = 'notificados'       AND UPPER(TRIM(CONVERT(spp.estado_solicitud      USING utf8mb4) COLLATE utf8mb4_unicode_ci)) <> 'CANCELADA'
                                       AND COALESCE(spp.is_ajuste, 0) = 1
                                       AND LOWER(TRIM(CONVERT(spp.forma_pago_solicitada USING utf8mb4) COLLATE utf8mb4_unicode_ci)) IN ('transfer','card'))
    OR (p_bucket = 'canceladas'        AND UPPER(TRIM(CONVERT(spp.estado_solicitud      USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = 'CANCELADA')
  )

  -- ── Filtros solicitud ───────────────────────────────────────────────────────
  AND (p_folio              IS NULL OR CONVERT(spp.codigo_confirmacion    USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', p_folio,           '%'))
  AND (p_estado_solicitud   IS NULL OR UPPER(TRIM(CONVERT(spp.estado_solicitud      USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = UPPER(TRIM(p_estado_solicitud)))
  AND (p_estado_facturacion IS NULL OR LOWER(TRIM(CONVERT(spp.estado_facturacion    USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = LOWER(TRIM(p_estado_facturacion)))
  AND (p_forma_pago         IS NULL OR LOWER(TRIM(CONVERT(spp.forma_pago_solicitada USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = LOWER(TRIM(p_forma_pago)))
  AND (p_created_start      IS NULL OR spp.created_at >= p_created_start)
  AND (p_created_end        IS NULL OR spp.created_at <= p_created_end)
  AND (p_comentarios        IS NULL OR CONVERT(spp.comentarios    USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', p_comentarios,   '%'))
  AND (p_comentario_cxp     IS NULL OR CONVERT(spp.comentario_CXP USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', p_comentario_cxp,'%'))
  AND (p_estatus_pagos      IS NULL OR LOWER(TRIM(CONVERT(spp.estatus_pagos         USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = LOWER(TRIM(p_estatus_pagos)))

  -- ── Filtros booking ─────────────────────────────────────────────────────────
  AND (p_hotel               IS NULL OR CONVERT(db.proveedor     USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', p_hotel,   '%'))
  AND (p_cliente             IS NULL OR CONVERT(db.nombre_agente  USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', p_cliente, '%'))
  AND (p_viajero             IS NULL OR CONVERT(db.nombre_viajero USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', p_viajero, '%'))
  AND (p_id_cliente          IS NULL OR CONVERT(db.id_agente      USING utf8mb4) COLLATE utf8mb4_unicode_ci  = p_id_cliente)
  AND (p_estado_reserva      IS NULL OR LOWER(TRIM(CONVERT(db.estado      USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = LOWER(TRIM(p_estado_reserva)))
  AND (p_etapa_reservacion   IS NULL OR LOWER(TRIM(CONVERT(db.type        USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = LOWER(TRIM(p_etapa_reservacion)))
  AND (p_metodo_pago_reserva IS NULL OR LOWER(TRIM(CONVERT(db.metodo_pago USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = LOWER(TRIM(p_metodo_pago_reserva)))
  AND (
       p_reservante IS NULL
    OR (LOWER(TRIM(p_reservante)) = 'cliente'     AND db.id_agente IS NOT NULL)
    OR (LOWER(TRIM(p_reservante)) = 'operaciones' AND db.id_agente IS NULL)
  )
  AND (p_check_in_start  IS NULL OR db.check_in  >= p_check_in_start)
  AND (p_check_in_end    IS NULL OR db.check_in  <= p_check_in_end)
  AND (p_check_out_start IS NULL OR db.check_out >= p_check_out_start)
  AND (p_check_out_end   IS NULL OR db.check_out <= p_check_out_end)

  -- ── Filtro fecha reserva dinámico ───────────────────────────────────────────
  AND (
    p_filtrar_fecha_por IS NULL
    OR (p_fecha_reserva_start IS NULL AND p_fecha_reserva_end IS NULL)
    OR (p_filtrar_fecha_por = 'check_in'
        AND (p_fecha_reserva_start IS NULL OR db.check_in  >= DATE(p_fecha_reserva_start))
        AND (p_fecha_reserva_end   IS NULL OR db.check_in  <= DATE(p_fecha_reserva_end)))
    OR (p_filtrar_fecha_por = 'check_out'
        AND (p_fecha_reserva_start IS NULL OR db.check_out >= DATE(p_fecha_reserva_start))
        AND (p_fecha_reserva_end   IS NULL OR db.check_out <= DATE(p_fecha_reserva_end)))
    OR (p_filtrar_fecha_por = 'created_at'
        AND (p_fecha_reserva_start IS NULL OR spp.created_at >= p_fecha_reserva_start)
        AND (p_fecha_reserva_end   IS NULL OR spp.created_at <= p_fecha_reserva_end))
  )

  -- ── Filtro UUID factura (mismo vínculo real que facturas_json: la vista, no la
  --    tabla, porque facturas_pago_proveedor.id_solicitud_proveedor es siempre NULL) ──
  AND (
    p_uuid_factura IS NULL
    OR EXISTS (
      SELECT 1
      FROM vw_pagos_facturas_proveedores_detalle v2
      WHERE v2.id_solicitud = spp.id_solicitud_proveedor
        AND CONVERT(v2.uuid_factura USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', p_uuid_factura, '%')
    )
  )

  ORDER BY spp.created_at DESC
  LIMIT p_limite OFFSET v_offset;

END $$

DELIMITER ;
