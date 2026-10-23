-- Sector y feria dejan de ser la misma cosa (confirmado por la cooperativa el
-- 2026-09-30). El socio particular elige un sector y tiene ahorro; el socio de
-- feria elige una feria y sólo tiene salud. Una cédula está como mucho en un
-- sector y en una feria.
--
-- Clasificación de lo que ya existe: es feria la que se llama así, la de código
-- 5x-xx del sistema anterior (50-00 Feria del Este, 51-00 Feria del Centro,
-- 52-00 Feria Ruiz Pineda) y cualquiera que ya tenga trabajadores o pagos de
-- salud por feria. El resto son sectores (01-00 a 10-00, 01-06 trabajadores de
-- El Triunfo, SEDE).
CREATE TYPE "TipoUbicacion" AS ENUM ('sector', 'feria');

ALTER TABLE "ubicaciones" ADD COLUMN "tipo" "TipoUbicacion" NOT NULL DEFAULT 'sector';

UPDATE "ubicaciones" u
SET "tipo" = 'feria'
WHERE u."nombre" ILIKE '%feria%'
   OR u."codigo" ~ '^5[0-9]-'
   OR EXISTS (SELECT 1 FROM "trabajador_feria" t WHERE t."feria_id" = u."id")
   OR EXISTS (SELECT 1 FROM "pagos_salud_feria" p WHERE p."feria_id" = u."id");

CREATE INDEX "ubicaciones_tipo_idx" ON "ubicaciones"("tipo");
