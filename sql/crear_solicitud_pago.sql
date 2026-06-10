DROP PROCEDURE IF EXISTS crear_solicitud_pago;

DELIMITER $$

CREATE DEFINER=`admin`@`%` PROCEDURE `crear_solicitud_pago`(
    IN p_monto_solicitado DECIMAL(12,2),
    IN p_forma_pago_solicitada ENUM('credit','transfer','card','link'),
    IN p_id_tarjeta_solicitada CHAR(36),
    IN p_usuario_solicitante CHAR(36),
    IN p_usuario_generador CHAR(36),
    IN p_comentarios TEXT,
    IN p_comentario_cxp TEXT,
    IN p_id_creador CHAR(36),
    IN p_id_hospedaje VARCHAR(40),
    IN p_fecha DATE,
    IN p_hora TIME,
    IN p_estado_solicitud ENUM(
      'CARTA_ENVIADA',
      'PAGADO TARJETA',
      'TRANSFERENCIA_SOLICITADA',
      'PAGADO TRANSFERENCIA',
      'PAGADO LINK',
      'CUPON ENVIADO'
    ),
    IN p_estatus_pagos VARCHAR(45),
    IN p_documento VARCHAR(40)
)
BEGIN
    DECLARE v_id_solicitud_proveedor INT UNSIGNED;
    DECLARE v_id_solicitud_anterior  INT UNSIGNED DEFAULT NULL;

    DECLARE v_sqlstate CHAR(5);
    DECLARE v_errno    INT;
    DECLARE v_msg      TEXT;

    DECLARE v_err               VARCHAR(128);
    DECLARE v_id_tarjeta        CHAR(36);
    DECLARE v_estado_solicitud  VARCHAR(32);
    DECLARE v_id_proveedor      VARCHAR(40);
    DECLARE v_created_at        TIMESTAMP;

    -- ── variables para la validación del estado anterior ──────────────────────
    DECLARE v_estado_anterior      VARCHAR(50)     DEFAULT NULL;
    DECLARE v_forma_pago_anterior  VARCHAR(20)     DEFAULT NULL;
    DECLARE v_monto_anterior       DECIMAL(12,2)   DEFAULT NULL;
    DECLARE v_saldo_anterior       DECIMAL(12,2)   DEFAULT NULL;
    DECLARE v_accion               VARCHAR(30)     DEFAULT 'CANCEL_AND_INSERT';

    DECLARE EXIT HANDLER FOR 1452
    BEGIN
        GET DIAGNOSTICS CONDITION 1
          v_sqlstate = RETURNED_SQLSTATE,
          v_errno    = MYSQL_ERRNO,
          v_msg      = MESSAGE_TEXT;
        SET v_err = LEFT(CONCAT('FK (1452): ', COALESCE(v_msg,'')), 128);
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err;
    END;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
          v_sqlstate = RETURNED_SQLSTATE,
          v_errno    = MYSQL_ERRNO,
          v_msg      = MESSAGE_TEXT;
        SET v_err = LEFT(CONCAT('crear_solicitud_pago [', v_errno, '/', v_sqlstate, ']: ', COALESCE(v_msg,'')), 128);
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err;
    END;

    SET v_id_tarjeta = NULLIF(TRIM(p_id_tarjeta_solicitada), '');

    -- =========================
    -- Validaciones base
    -- =========================
    IF p_monto_solicitado IS NULL OR p_monto_solicitado < 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'monto_solicitado inválido';
    END IF;

    IF p_id_hospedaje IS NULL OR TRIM(p_id_hospedaje) = '' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'id_hospedaje requerido';
    END IF;

    IF p_fecha IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fecha_solicitud requerida';
    END IF;

    IF p_forma_pago_solicitada IN ('card','link') AND v_id_tarjeta IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'id_tarjeta_solicitada requerido para card/link';
    END IF;

    IF p_forma_pago_solicitada IN ('transfer','credit') THEN
      SET v_id_tarjeta = NULL;
    END IF;

    -- =========================
    -- created_at: combina fecha + hora (si viene la hora)
    -- =========================
    SET v_created_at = TIMESTAMP(p_fecha, COALESCE(p_hora, '00:00:00'));

    -- =========================
    -- Estado por default
    -- =========================
    IF p_estado_solicitud IS NULL THEN
      SET v_estado_solicitud = CASE
        WHEN p_forma_pago_solicitada = 'card'     THEN 'CARTA_ENVIADA'
        WHEN p_forma_pago_solicitada = 'link'     THEN 'PAGADO LINK'
        WHEN p_forma_pago_solicitada = 'transfer' THEN 'TRANSFERENCIA_SOLICITADA'
        WHEN p_forma_pago_solicitada = 'credit'   THEN 'CUPON ENVIADO'
        ELSE NULL
      END;
    ELSE
      SET v_estado_solicitud = p_estado_solicitud;
    END IF;

    IF v_estado_solicitud IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'estado_solicitud requerido o inválido';
    END IF;

    -- =========================
    -- Buscar proveedor desde id_booking
    -- =========================
    SELECT r.id_proveedor
      INTO v_id_proveedor
    FROM vw_new_reservas r
    WHERE r.id_booking = p_id_hospedaje
    LIMIT 1;

    IF v_id_proveedor IS NULL OR TRIM(v_id_proveedor) = '' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se encontró id_proveedor para el id_booking enviado';
    END IF;

    START TRANSACTION;

    -- =========================
    -- Buscar solicitud anterior + bloquear
    -- =========================
    SELECT CAST(bs.id_solicitud AS UNSIGNED)
      INTO v_id_solicitud_anterior
    FROM booking_solicitud bs
    WHERE bs.id_booking = p_id_hospedaje
    LIMIT 1
    FOR UPDATE;

    -- =========================
    -- Si existe solicitud anterior: leer su estado, forma de pago y montos
    -- =========================
    IF v_id_solicitud_anterior IS NOT NULL THEN
      SELECT
        UPPER(TRIM(estado_solicitud)),
        LOWER(TRIM(forma_pago_solicitada)),
        monto_solicitado,
        COALESCE(saldo, 0)
      INTO
        v_estado_anterior,
        v_forma_pago_anterior,
        v_monto_anterior,
        v_saldo_anterior
      FROM solicitudes_pago_proveedor
      WHERE id_solicitud_proveedor = v_id_solicitud_anterior
      LIMIT 1
      FOR UPDATE;

      -- ── Caso especial: pagada o en dispersión con misma forma de pago ─────────
      IF v_estado_anterior IN ('PAGADO TRANSFERENCIA', 'DISPERSION')
         AND v_forma_pago_anterior = LOWER(TRIM(p_forma_pago_solicitada)) THEN

        IF p_monto_solicitado > v_monto_anterior THEN
          SET v_accion = 'UPDATE_INCREMENTO';
        ELSEIF p_monto_solicitado < v_monto_anterior THEN
          SET v_accion = 'UPDATE_AJUSTE';
        ELSE
          SET v_accion = 'UPDATE_SIN_CAMBIO';
        END IF;

      END IF;
    END IF;

    -- =========================
    -- Ejecutar acción
    -- =========================
    IF v_accion = 'UPDATE_INCREMENTO' THEN
      -- Monto aumentó: saldo sube por la diferencia
      UPDATE solicitudes_pago_proveedor
      SET
        monto_solicitado = p_monto_solicitado,
        saldo            = v_saldo_anterior + (p_monto_solicitado - v_monto_anterior)
      WHERE id_solicitud_proveedor = v_id_solicitud_anterior;

      SET v_id_solicitud_proveedor = v_id_solicitud_anterior;

    ELSEIF v_accion = 'UPDATE_AJUSTE' THEN
      -- Monto disminuyó: marcar ajuste y dejar trazabilidad en comentario_ajuste
      UPDATE solicitudes_pago_proveedor
      SET
        monto_solicitado  = p_monto_solicitado,
        is_ajuste         = 1,
        comentario_ajuste = CONCAT(
          'Cambio de precio por edición de reserva. ',
          'Monto anterior: ', v_monto_anterior, '. ',
          'Monto nuevo: ', p_monto_solicitado, '. ',
          'Fecha: ', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), '. ',
          'Usuario: ', COALESCE(p_usuario_solicitante, 'sistema'), '.'
        )
      WHERE id_solicitud_proveedor = v_id_solicitud_anterior;

      SET v_id_solicitud_proveedor = v_id_solicitud_anterior;

    ELSEIF v_accion = 'UPDATE_SIN_CAMBIO' THEN
      -- Mismo monto, sin acción
      SET v_id_solicitud_proveedor = v_id_solicitud_anterior;

    ELSE
      -- CANCEL_AND_INSERT: flujo original
      IF v_id_solicitud_anterior IS NOT NULL THEN
        UPDATE solicitudes_pago_proveedor
        SET
          estado_solicitud = 'CANCELADA',
          estatus_pagos    = 'cancelado'
        WHERE id_solicitud_proveedor = v_id_solicitud_anterior
          AND COALESCE(estado_solicitud, '') NOT IN (
            'PAGADO TARJETA',
            'PAGADO TRANSFERENCIA',
            'PAGADO LINK',
            'CANCELADA'
          );
      END IF;

      INSERT INTO solicitudes_pago_proveedor (
          monto_solicitado,
          saldo,
          forma_pago_solicitada,
          id_tarjeta_solicitada,
          usuario_solicitante,
          usuario_generador,
          comentarios,
          comentario_CXP,
          id_creador,
          id_proveedor,
          estado_solicitud,
          estado_facturacion,
          fecha_solicitud,
          estatus_pagos,
          id_enviado,
          id_booking,
          created_at
      ) VALUES (
          p_monto_solicitado,
          p_monto_solicitado,
          p_forma_pago_solicitada,
          v_id_tarjeta,
          p_usuario_solicitante,
          p_usuario_generador,
          p_comentarios,
          p_comentario_cxp,
          p_id_creador,
          v_id_proveedor,
          v_estado_solicitud,
          'pendiente',
          p_fecha,
          p_estatus_pagos,
          NULLIF(TRIM(p_documento), ''),
          p_id_hospedaje,
          v_created_at
      );

      SET v_id_solicitud_proveedor = LAST_INSERT_ID();

      IF v_id_solicitud_anterior IS NOT NULL THEN
        UPDATE booking_solicitud
        SET id_solicitud = CAST(v_id_solicitud_proveedor AS CHAR(40))
        WHERE id_booking = p_id_hospedaje;
      ELSE
        INSERT INTO booking_solicitud (id_booking, id_solicitud)
        VALUES (p_id_hospedaje, CAST(v_id_solicitud_proveedor AS CHAR(40)));
      END IF;

    END IF;

    COMMIT;

    SELECT
      v_id_solicitud_proveedor AS id_solicitud_proveedor,
      CASE WHEN v_accion = 'CANCEL_AND_INSERT' THEN v_id_solicitud_anterior ELSE NULL END AS id_solicitud_cancelada,
      v_accion AS accion;
END$$

DELIMITER ;
