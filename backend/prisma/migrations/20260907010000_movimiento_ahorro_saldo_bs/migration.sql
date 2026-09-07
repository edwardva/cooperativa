-- ============================================================================
-- Movimientos de ahorro: saldo en bolivares
-- ============================================================================
--
-- La libreta muestra el saldo con el que quedo la cuenta despues de cada
-- movimiento. Derivarlo de los dolares multiplicando por la tasa pierde
-- centimos, y el saldo de la libreta deja de cuadrar con el de la cuenta —
-- exactamente el tipo de descuadre que el personal no puede explicarle al
-- socio. Se guarda el valor en bolivares tal cual.
-- ============================================================================

ALTER TABLE "movimientos_ahorro" ADD COLUMN IF NOT EXISTS "saldo_nuevo_bs" DECIMAL(12,2);

-- Relleno de lo existente con la mejor aproximacion disponible: el saldo en
-- dolares por la tasa del propio movimiento.
UPDATE "movimientos_ahorro"
SET "saldo_nuevo_bs" = ROUND("saldo_nuevo_usd" * "tasa_cambio", 2)
WHERE "saldo_nuevo_bs" IS NULL;
