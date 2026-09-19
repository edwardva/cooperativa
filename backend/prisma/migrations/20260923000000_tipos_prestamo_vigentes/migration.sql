-- Tipos de préstamo que siguen en uso (confirmado por la cooperativa el 2026-09-18).
--
-- Se desactivan los que quedaron del sistema viejo y ya no se otorgan. No se
-- borran: desactivados dejan de aparecer al otorgar, y se pueden reactivar desde
-- "Tipos de Préstamo". "Con fiador" se desactiva también hasta que la
-- cooperativa defina su tasa: tenía 0,21% y ningún préstamo en el sistema viejo.
UPDATE "tipos_prestamo"
SET "estado" = false
WHERE "codigo" IN ('01', '03', '06', '07', '08', '09', '10', '11', 'PRE001');

-- "Divisas" (tipo 99 del sistema viejo) no se había migrado: préstamo en
-- dólares en físico, con aval de los ahorros en divisas del socio, al 1% mensual.
-- Usa la misma tabla de cuotas que los demás y se cobra en divisas.
INSERT INTO "tipos_prestamo" (
  "codigo", "nombre", "descripcion", "tasa_interes_anual", "tasa_interes_mensual",
  "tasa_mora_mensual", "requiere_fiadores", "moneda", "estado"
)
VALUES (
  '99', 'Divisas', 'Préstamo en divisas en físico, con aval de los ahorros en divisas del socio',
  12.00, 1.00, 0, false, 'USD', true
)
ON CONFLICT ("codigo") DO NOTHING;
