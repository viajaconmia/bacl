-- Nueva vista: agente_details_lite
--
-- Por qué existe: `agente_details` mezcla identidad/datos fiscales del agente
-- (barato) con saldos financieros agregados (`wallet`, `wallet_finanzas`, vía
-- LEFT JOIN + SUM() sobre `saldos_a_favor`, caro). Los consumidores que solo
-- necesitan nombre/correo/teléfono/razón social/RFC (p. ej. reportes) pagan
-- ese costo sin usarlo nunca.
--
-- Esta vista es EXACTAMENTE la misma lógica de `agente_details` (mismo CTE,
-- mismo ROW_NUMBER()/rn=1 para "primer viajero por agente") pero SIN el
-- LEFT JOIN a `saldos_a_favor` ni las columnas `wallet`/`wallet_finanzas`.
-- `agente_details` NO se toca, se queda igual para quien sí necesite esos
-- campos (ver nota Obsidian "vista agente_details.md").
--
-- Uso previsto inicial: reemplazar los joins a `vw_details_agente` +
-- `vw_agente_primer_empresa` dentro de `get_solicitudes_pago_filtradas2`
-- (ver optimizar_get_solicitudes_pago_filtradas2.sql).

DROP VIEW IF EXISTS agente_details_lite;

CREATE ALGORITHM=UNDEFINED DEFINER=`admin`@`%` SQL SECURITY DEFINER VIEW `agente_details_lite` AS
WITH `primer_viajero_por_agente` AS (
    SELECT
        `a`.`id_agente` AS `id_agente`,
        `a`.`monto_credito` AS `monto_credito`,
        `a`.`active` AS `active`,
        `a`.`saldo` AS `saldo`,
        `a`.`nombre_identificacion` AS `nombre_identificacion`,
        `a`.`linea_credito` AS `linea_credito`,
        `a`.`tiene_credito_consolidado` AS `tiene_credito_consolidado`,
        REPLACE(`a`.`nombre`, '  ', ' ') AS `nombre_agente_completo`,
        `a`.`notas` AS `notas`,
        `a`.`por_confirmar` AS `por_confirmar`,
        `a`.`vendedor` AS `vendedor`,
        `a`.`created_at` AS `created_agente`,
        `v`.`id_viajero` AS `id_viajero`,
        `v`.`primer_nombre` AS `primer_nombre`,
        `v`.`segundo_nombre` AS `segundo_nombre`,
        `v`.`apellido_paterno` AS `apellido_paterno`,
        `v`.`apellido_materno` AS `apellido_materno`,
        `v`.`correo` AS `correo`,
        `v`.`fecha_nacimiento` AS `fecha_nacimiento`,
        `v`.`genero` AS `genero`,
        `v`.`telefono` AS `telefono`,
        `v`.`created_at` AS `created_at`,
        `v`.`updated_at` AS `updated_at`,
        `v`.`nacionalidad` AS `nacionalidad`,
        `v`.`numero_pasaporte` AS `numero_pasaporte`,
        `v`.`numero_empleado` AS `numero_empleado`,
        REPLACE(CONCAT_WS(' ', `v`.`primer_nombre`, `v`.`segundo_nombre`, `v`.`apellido_paterno`, `v`.`apellido_materno`), '  ', ' ') AS `nombre_other`,
        REPLACE(`a`.`nombre`, '  ', ' ') AS `nombre`,
        `emp`.`razon_social` AS `razon_social`,
        `emp`.`nombre_comercial` AS `nombre_comercial`,
        `df`.`rfc` AS `rfc`,
        `emp`.`tipo_persona` AS `tipo_persona`,
        ROW_NUMBER() OVER (PARTITION BY `a`.`id_agente` ORDER BY `v_e`.`created_at`) AS `rn`
    FROM `agentes` `a`
    JOIN `empresas_agentes` `e_a` ON (`a`.`id_agente` = `e_a`.`id_agente`)
    JOIN `viajero_empresa` `v_e` ON (`v_e`.`id_empresa` = `e_a`.`id_empresa`)
    JOIN `empresas` `emp` ON (`emp`.`id_empresa` = `e_a`.`id_empresa`)
    LEFT JOIN `datos_fiscales` `df` ON (`df`.`id_empresa` = `emp`.`id_empresa`)
    JOIN `viajeros` `v` ON (`v_e`.`id_viajero` = `v`.`id_viajero`)
    -- NOTA: sin LEFT JOIN a saldos_a_favor ni SUM(wallet)/SUM(wallet_finanzas)
    -- — esa es la diferencia completa contra agente_details.
)
SELECT
    `p`.`id_agente` AS `id_agente`,
    `p`.`monto_credito` AS `monto_credito`,
    `p`.`saldo` AS `saldo`,
    `p`.`nombre_identificacion` AS `nombre_identificacion`,
    `p`.`tiene_credito_consolidado` AS `tiene_credito_consolidado`,
    `p`.`nombre` AS `nombre`,
    `p`.`notas` AS `notas`,
    `p`.`por_confirmar` AS `por_confirmar`,
    `p`.`vendedor` AS `vendedor`,
    `p`.`created_agente` AS `created_agente`,
    `p`.`id_viajero` AS `id_viajero`,
    `p`.`primer_nombre` AS `primer_nombre`,
    `p`.`segundo_nombre` AS `segundo_nombre`,
    `p`.`apellido_paterno` AS `apellido_paterno`,
    `p`.`apellido_materno` AS `apellido_materno`,
    `p`.`correo` AS `correo`,
    `p`.`fecha_nacimiento` AS `fecha_nacimiento`,
    `p`.`genero` AS `genero`,
    `p`.`linea_credito` AS `linea_credito`,
    `p`.`telefono` AS `telefono`,
    `p`.`created_at` AS `created_at`,
    `p`.`active` AS `active`,
    `p`.`updated_at` AS `updated_at`,
    `p`.`nacionalidad` AS `nacionalidad`,
    `p`.`numero_pasaporte` AS `numero_pasaporte`,
    `p`.`numero_empleado` AS `numero_empleado`,
    `p`.`nombre_agente_completo` AS `nombre_agente_completo`,
    `p`.`razon_social` AS `razon_social`,
    `p`.`rfc` AS `rfc`,
    `p`.`tipo_persona` AS `tipo_persona`,
    `p`.`nombre_comercial` AS `nombre_comercial`,
    `p`.`nombre_other` AS `nombre_other`,
    `p`.`rn` AS `rn`
FROM `primer_viajero_por_agente` `p`
WHERE (`p`.`rn` = 1);
