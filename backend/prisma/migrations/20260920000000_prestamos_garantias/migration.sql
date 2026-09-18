-- Garantías de préstamo, confirmado por la cooperativa el 2026-09-18:
--
--   - Los fiadores cubren la parte del SALDO DEUDOR que no cubre el ahorro propio
--     del socio, y se liberan DE A UNO a medida que el socio paga, en el orden
--     que se elige al otorgar el préstamo.
--   - Al saldar se libera todo, incluido el ahorro propio que respaldaba.

ALTER TABLE "fiadores" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 1;

-- Ahorro propio del socio bloqueado como garantía de ESTE préstamo (sin contar
-- la parte de la inicial que puso con su ahorro, que está en inicial_ahorro_usd)
ALTER TABLE "prestamos" ADD COLUMN "garantia_propia_usd" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Al saldar se devuelve el ahorro propio una sola vez: si un reverso reabre el
-- préstamo, no se vuelve a bloquear (confirmado) ni se devuelve dos veces
ALTER TABLE "prestamos" ADD COLUMN "garantias_liberadas" BOOLEAN NOT NULL DEFAULT false;
