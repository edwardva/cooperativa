-- ============================================================================
-- Largo de cada año del calendario de colecta (10/11/2026)
-- ============================================================================
--
-- La cooperativa aclaró que el año cierra en 52 o en 53 según lo avise la
-- funeraria cada diciembre. Para 2026: cierra la 52 el domingo 27/12 y la 1
-- de 2027 arranca el lunes 28/12 (la regla del 1 de enero del 23/10). Cuando
-- la funeraria pida 53, se confirma el año en esta tabla desde Semanas de
-- colecta y el sistema re-rotula solo lo que ya estaba guardado.
CREATE TABLE "anos_colecta" (
    "ano"            INTEGER      NOT NULL,
    "semanas"        INTEGER      NOT NULL,
    "confirmado_por" INTEGER,
    "observaciones"  TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "anos_colecta_pkey" PRIMARY KEY ("ano"),
    CONSTRAINT "anos_colecta_semanas_check" CHECK ("semanas" IN (52, 53))
);

-- ----------------------------------------------------------------------------
-- Datos guardados con la regla vieja (ISO) antes del 23/10
-- ----------------------------------------------------------------------------
-- Hasta que la regla del 1 de enero llegó a producción el sistema numeraba con
-- ISO. Desde 2024 las dos reglas sólo difieren en los rótulos de 2027 en
-- adelante (adelantos): la "S01/2027" ISO es la semana del 04/01/2027, que con
-- la regla del 1 de enero es la S02/2027. Se traducen conservando la fecha.
--
-- REVISAR ANTES DE APLICAR EN PRODUCCIÓN: `desde` es el día en que la regla del
-- 1 de enero (commit 98d4732, del 23/10) llegó a producción. Lo escrito antes
-- de esa fecha está en ISO.
CREATE TEMP TABLE corte AS SELECT TIMESTAMP '2026-10-23 00:00:00' AS desde;

-- Lunes real de un rótulo ISO
CREATE FUNCTION pg_temp.lunes_iso(a int, s int) RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT to_date(a::text || '-' || lpad(s::text, 2, '0'), 'IYYY-IW')
$$;
-- Rótulo de un lunes con la regla del 1 de enero
CREATE FUNCTION pg_temp.ano_regla(d date) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT EXTRACT(YEAR FROM d + 6)::int
$$;
CREATE FUNCTION pg_temp.semana_regla(d date) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT ((d - date_trunc('week', make_date(pg_temp.ano_regla(d), 1, 1))::date) / 7 + 1)::int
$$;

UPDATE acuerdos_funeraria
SET ano_pagado_hasta    = pg_temp.ano_regla(pg_temp.lunes_iso(ano_pagado_hasta, semana_pagada_hasta)),
    semana_pagada_hasta = pg_temp.semana_regla(pg_temp.lunes_iso(ano_pagado_hasta, semana_pagada_hasta))
WHERE ano_pagado_hasta >= 2027 AND semana_pagada_hasta IS NOT NULL
  AND updated_at < (SELECT desde FROM corte);

UPDATE acuerdos_salud
SET ano_pagado_hasta    = pg_temp.ano_regla(pg_temp.lunes_iso(ano_pagado_hasta, semana_pagada_hasta)),
    semana_pagada_hasta = pg_temp.semana_regla(pg_temp.lunes_iso(ano_pagado_hasta, semana_pagada_hasta))
WHERE ano_pagado_hasta >= 2027 AND semana_pagada_hasta IS NOT NULL
  AND updated_at < (SELECT desde FROM corte);

UPDATE movimientos_funeraria
SET ano_cobertura    = pg_temp.ano_regla(pg_temp.lunes_iso(ano_cobertura, semana_cobertura)),
    semana_cobertura = pg_temp.semana_regla(pg_temp.lunes_iso(ano_cobertura, semana_cobertura))
WHERE ano_cobertura >= 2027 AND semana_cobertura IS NOT NULL
  AND created_at < (SELECT desde FROM corte);

UPDATE movimientos_salud
SET ano_cobertura    = pg_temp.ano_regla(pg_temp.lunes_iso(ano_cobertura, semana_cobertura)),
    semana_cobertura = pg_temp.semana_regla(pg_temp.lunes_iso(ano_cobertura, semana_cobertura))
WHERE ano_cobertura >= 2027 AND semana_cobertura IS NOT NULL
  AND created_at < (SELECT desde FROM corte);

UPDATE detalle_colecta
SET cobertura_ano_antes    = pg_temp.ano_regla(pg_temp.lunes_iso(cobertura_ano_antes, cobertura_semana_antes)),
    cobertura_semana_antes = pg_temp.semana_regla(pg_temp.lunes_iso(cobertura_ano_antes, cobertura_semana_antes))
WHERE cobertura_ano_antes >= 2027 AND cobertura_semana_antes IS NOT NULL
  AND created_at < (SELECT desde FROM corte);

UPDATE detalle_colecta
SET cobertura_ano_despues    = pg_temp.ano_regla(pg_temp.lunes_iso(cobertura_ano_despues, cobertura_semana_despues)),
    cobertura_semana_despues = pg_temp.semana_regla(pg_temp.lunes_iso(cobertura_ano_despues, cobertura_semana_despues))
WHERE cobertura_ano_despues >= 2027 AND cobertura_semana_despues IS NOT NULL
  AND created_at < (SELECT desde FROM corte);

-- ----------------------------------------------------------------------------
-- Tablas con fechas: el rótulo sale de la fecha de inicio
-- ----------------------------------------------------------------------------
-- La tabla de semanas se generó en septiembre con ISO y todavía tiene una
-- "S53/2026". Dos filas de la misma semana real: queda la que ya está bien
-- rotulada, o la editada a mano, o la más vieja; sus colectas pasan a esa.
CREATE TEMP TABLE semanas_dup AS
SELECT id, FIRST_VALUE(id) OVER w AS queda
FROM semanas_colecta
WINDOW w AS (
  PARTITION BY fecha_inicio
  ORDER BY (ano = pg_temp.ano_regla(fecha_inicio) AND semana = pg_temp.semana_regla(fecha_inicio)) DESC,
           (actualizado_por IS NOT NULL) DESC,
           id
);

UPDATE colecta c SET semana_colecta_id = d.queda
FROM semanas_dup d WHERE c.semana_colecta_id = d.id AND d.id <> d.queda;

DELETE FROM semanas_colecta s USING semanas_dup d WHERE s.id = d.id AND d.id <> d.queda;

-- En dos pasos para no chocar con el único (semana, ano) a mitad de camino
UPDATE semanas_colecta SET semana = -id
WHERE ano <> pg_temp.ano_regla(fecha_inicio) OR semana <> pg_temp.semana_regla(fecha_inicio);

UPDATE semanas_colecta
SET ano       = pg_temp.ano_regla(fecha_inicio),
    semana    = pg_temp.semana_regla(fecha_inicio),
    fecha_fin = fecha_inicio + 6
WHERE semana < 0;

-- Períodos semanales de salud de los trabajadores: igual
CREATE TEMP TABLE periodos_dup AS
SELECT id, FIRST_VALUE(id) OVER w AS queda
FROM periodos_salud
WHERE tipo = 'semanal'
WINDOW w AS (
  PARTITION BY fecha_inicio
  ORDER BY (anio = pg_temp.ano_regla(fecha_inicio) AND numero = pg_temp.semana_regla(fecha_inicio)) DESC, id
);

UPDATE pagos_salud_feria p SET periodo_id = d.queda
FROM periodos_dup d WHERE p.periodo_id = d.id AND d.id <> d.queda;
UPDATE pagos_salud_feria p SET periodo_hasta_id = d.queda
FROM periodos_dup d WHERE p.periodo_hasta_id = d.id AND d.id <> d.queda;
UPDATE pagos_salud_trabajador p SET periodo_id = d.queda
FROM periodos_dup d WHERE p.periodo_id = d.id AND d.id <> d.queda;

DELETE FROM periodos_salud s USING periodos_dup d WHERE s.id = d.id AND d.id <> d.queda;

UPDATE periodos_salud SET numero = -id
WHERE tipo = 'semanal'
  AND (anio <> pg_temp.ano_regla(fecha_inicio) OR numero <> pg_temp.semana_regla(fecha_inicio));

UPDATE periodos_salud
SET anio      = pg_temp.ano_regla(fecha_inicio),
    numero    = pg_temp.semana_regla(fecha_inicio),
    fecha_fin = fecha_inicio + 6
WHERE tipo = 'semanal' AND numero < 0;

DROP TABLE corte;
DROP TABLE semanas_dup;
DROP TABLE periodos_dup;
