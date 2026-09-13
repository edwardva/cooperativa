-- ============================================================================
-- Abonos de préstamo: de qué colecta vinieron
-- ============================================================================
--
-- El reverso de una colecta encontraba "su" abono buscando el texto
-- "Colecta #N" en el concepto, que falla si el cajero escribió un concepto
-- propio. Y el nuevo reverso de abono necesita saber si el abono salió de la
-- caja: esos se reversan con su colecta, porque sueltos descuadran el cierre.
--
-- Mismo criterio que `movimientos_salud.colecta_id`: sin llave foránea.
-- ============================================================================

ALTER TABLE "abonos_prestamo" ADD COLUMN IF NOT EXISTS "colecta_id" INTEGER;

-- Los abonos existentes cobrados en caja llevan el número en el concepto
UPDATE "abonos_prestamo"
SET "colecta_id" = substring("concepto" from 'Colecta #([0-9]+)')::INTEGER
WHERE "colecta_id" IS NULL
  AND "concepto" ~ 'Colecta #[0-9]+';

CREATE INDEX IF NOT EXISTS "abonos_prestamo_colecta_id_idx"
  ON "abonos_prestamo"("colecta_id");
