-- Sector y feria dejan de ser la misma cosa (confirmado por la cooperativa el
-- 2026-09-30). El socio particular elige un sector y tiene ahorro; el socio de
-- feria elige una feria y sólo tiene salud. Una cédula está como mucho en un
-- sector y en una feria.
--
-- Clasificación de lo que ya existe: SÓLO POR CÓDIGO. Son feria las 5x-xx del
-- sistema anterior (50-00 Feria del Este, 51-00 Feria del Centro, 52-00 Feria
-- Ruiz Pineda) y la de prueba (PRB). El resto son sectores (01-00 a 10-00,
-- 01-06 trabajadores de El Triunfo, SEDE).
--
-- No se usa el nombre: en producción TODAS las ubicaciones se llaman "Feria
-- XX-XX". Tampoco tener trabajadores o pagos de salud por feria: el 01-06 y el
-- 10-00 tienen alguno (cargados en pruebas) y son sectores.
CREATE TYPE "TipoUbicacion" AS ENUM ('sector', 'feria');

ALTER TABLE "ubicaciones" ADD COLUMN "tipo" "TipoUbicacion" NOT NULL DEFAULT 'sector';

UPDATE "ubicaciones"
SET "tipo" = 'feria'
WHERE "codigo" ~ '^5[0-9]-' OR "codigo" = 'PRB';

CREATE INDEX "ubicaciones_tipo_idx" ON "ubicaciones"("tipo");
