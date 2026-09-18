-- Morosidad, confirmado por la cooperativa el 2026-09-18:
--   - El sistema muestra desde cuándo y hasta cuándo está suspendido el socio.
--   - En la semana 41 el socio se retira AUTOMÁTICAMENTE por el artículo 5,
--     literal c (pasividad mayor a seis meses), y queda un reporte para archivar.
ALTER TABLE "socios" ADD COLUMN "suspendido_desde" DATE;
