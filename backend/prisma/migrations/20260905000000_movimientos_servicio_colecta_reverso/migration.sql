-- ============================================================================
-- Movimientos de servicio: origen y marca de reverso
-- ============================================================================
--
-- El reverso de una colecta crea un movimiento espejo, pero el pago original
-- seguia figurando como vigente. Al deshacer un cobro no habia forma de saber
-- cual era el pago valido anterior: se tomaba uno que ya estaba reversado, y la
-- fecha de "ultimo pago" del socio quedaba mal.
--
-- Con `colecta_id` el movimiento sabe de que cobro vino, y `reversado` lo saca
-- de la cuenta cuando ese cobro se deshace.
-- ============================================================================

ALTER TABLE "movimientos_funeraria"
  ADD COLUMN IF NOT EXISTS "colecta_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "reversado"  BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "movimientos_salud"
  ADD COLUMN IF NOT EXISTS "colecta_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "reversado"  BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "movimientos_funeraria_colecta_id_idx"
  ON "movimientos_funeraria"("colecta_id");
CREATE INDEX IF NOT EXISTS "movimientos_salud_colecta_id_idx"
  ON "movimientos_salud"("colecta_id");
