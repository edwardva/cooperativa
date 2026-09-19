-- Sector de los trabajadores de la sede de El Triunfo (confirmado el 2026-09-18):
-- se maneja igual que una feria, para que esos trabajadores tengan el suyo.
INSERT INTO "ubicaciones" ("codigo", "nombre", "observaciones")
SELECT 'SEDE', 'EL TRIUNFO (SEDE)', 'Trabajadores de la sede de la cooperativa'
WHERE NOT EXISTS (SELECT 1 FROM "ubicaciones" WHERE UPPER("nombre") = 'EL TRIUNFO (SEDE)')
ON CONFLICT ("codigo") DO NOTHING;
