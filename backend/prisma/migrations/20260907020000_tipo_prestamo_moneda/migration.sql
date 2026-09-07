-- ============================================================================
-- Tipos de prestamo: moneda de la categoria
-- ============================================================================
--
-- En el sistema actual cada tipo de prestamo trae su moneda ("linea blanca" se
-- otorga en divisas, "efectivo" en bolivares). Es la respuesta a la duda de la
-- reunion sobre si "divisa" era una categoria: no lo es, es un atributo de la
-- categoria, y el prestamo la hereda al otorgarse.
-- ============================================================================

ALTER TABLE "tipos_prestamo" ADD COLUMN IF NOT EXISTS "moneda" "Moneda" NOT NULL DEFAULT 'BS';
