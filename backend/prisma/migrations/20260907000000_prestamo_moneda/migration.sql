-- ============================================================================
-- Prestamos: moneda de otorgamiento
-- ============================================================================
--
-- La reunion dejaba abierto si "divisa" era una categoria de prestamo o una
-- modalidad. El sistema actual lo responde: lleva `moneda` ("Bolivares" /
-- "Divisas") como un campo APARTE de la categoria (efectivo, linea blanca,
-- gastos medicos), y muestra cada prestamo con su monto, abono y saldo en las
-- dos monedas a la vez.
-- ============================================================================

ALTER TABLE "prestamos" ADD COLUMN IF NOT EXISTS "moneda" "Moneda" NOT NULL DEFAULT 'BS';
