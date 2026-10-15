-- Diagnóstico de solo lectura (SELECT puro, seguro de correr en producción).
--
-- Objetivo: decidir si podemos consolidar en una sola fuente los 3 lugares
-- donde hoy se resuelve "la empresa representativa de un agente":
--   (A) vw_agente_primer_empresa  -> por el vínculo empresas_agentes.created_at
--       más antiguo (NO pasa por viajeros).
--   (B) agente_details            -> por el vínculo viajero_empresa.created_at
--       más antiguo (SÍ pasa por viajeros).
--   (C) vw_details_agente         -> GROUP BY sin agregación real + ORDER BY
--       post-GROUP BY = elección no determinística (ver nota aparte).
--
-- Esta query compara (A) contra (B) para los agentes que tienen más de una
-- empresa en empresas_agentes (para los que tienen solo una, A y B siempre
-- coinciden por definición, así que no hace falta revisarlos).
--
-- Cómo leer el resultado:
--   - resultado = 'COINCIDEN' -> ambos métodos eligen la misma empresa, no
--     hay riesgo en consolidar para ese agente.
--   - resultado = 'DIFIEREN'  -> los métodos eligen empresas distintas, hay
--     que decidir manualmente cuál es la "correcta" para ese agente.
--   - resultado = 'SIN_DATO'  -> a alguno de los dos métodos no le salió
--     ninguna fila (raro, revisar el agente aparte).
--
-- Si casi todas las filas salen 'COINCIDEN', es seguro consolidar sin perder
-- nada. Si hay muchas 'DIFIEREN', hay que mirar esos agentes puntuales antes
-- de decidir cuál lógica usar como la única fuente de verdad.

WITH conteo_empresas AS (
    SELECT id_agente, COUNT(DISTINCT id_empresa) AS num_empresas
    FROM empresas_agentes
    GROUP BY id_agente
),
agentes_multi_empresa AS (
    SELECT id_agente, num_empresas
    FROM conteo_empresas
    WHERE num_empresas > 1
),
pick_por_empresa AS (
    -- misma lógica que vw_agente_primer_empresa
    SELECT e_a.id_agente, e_a.id_empresa, e_a.created_at
    FROM empresas_agentes e_a
    INNER JOIN agentes_multi_empresa m ON m.id_agente = e_a.id_agente
    WHERE e_a.created_at = (
        SELECT MIN(ea2.created_at)
        FROM empresas_agentes ea2
        WHERE ea2.id_agente = e_a.id_agente
    )
),
pick_por_viajero AS (
    -- misma lógica que agente_details (ROW_NUMBER sobre viajero_empresa.created_at)
    SELECT x.id_agente, x.id_empresa, x.created_at
    FROM (
        SELECT
            e_a.id_agente,
            e_a.id_empresa,
            v_e.created_at,
            ROW_NUMBER() OVER (PARTITION BY e_a.id_agente ORDER BY v_e.created_at) AS rn
        FROM empresas_agentes e_a
        INNER JOIN agentes_multi_empresa m ON m.id_agente = e_a.id_agente
        INNER JOIN viajero_empresa v_e ON v_e.id_empresa = e_a.id_empresa
    ) x
    WHERE x.rn = 1
),
comparacion AS (
    SELECT
        m.id_agente,
        m.num_empresas,
        pe.id_empresa AS empresa_segun_vw_agente_primer_empresa,
        pe.created_at AS fecha_vinculo_agente_empresa,
        pv.id_empresa AS empresa_segun_agente_details,
        pv.created_at AS fecha_vinculo_viajero_empresa,
        CASE
            WHEN pe.id_empresa IS NULL OR pv.id_empresa IS NULL THEN 'SIN_DATO'
            WHEN pe.id_empresa = pv.id_empresa THEN 'COINCIDEN'
            ELSE 'DIFIEREN'
        END AS resultado
    FROM agentes_multi_empresa m
    LEFT JOIN pick_por_empresa pe ON pe.id_agente = m.id_agente
    LEFT JOIN pick_por_viajero pv ON pv.id_agente = m.id_agente
)

-- 1) Detalle fila por fila (para mirar los casos que DIFIEREN)
SELECT * FROM comparacion
ORDER BY (resultado = 'DIFIEREN') DESC, (resultado = 'SIN_DATO') DESC, id_agente;

-- 2) Para el resumen (coincidencias vs diferencias), correr aparte:
-- WITH ... (mismo bloque de arriba) ...
-- SELECT resultado, COUNT(*) AS cantidad
-- FROM comparacion
-- GROUP BY resultado;
