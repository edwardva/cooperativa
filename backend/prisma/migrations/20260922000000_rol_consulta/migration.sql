-- Rol de sólo consulta, confirmado por la cooperativa el 2026-09-17: además de
-- los cajeros y la caja 99, usan el sistema dos compañeras de contabilidad de
-- ahorro que sólo visualizan y a veces imprimen reportes. Ve todo, no cambia
-- nada. Si ya existe no se toca: sincronizar-permisos.ts mantiene sus permisos.
INSERT INTO "roles" ("nombre", "descripcion", "permisos")
VALUES (
  'consulta',
  'Sólo consulta: ve los módulos e imprime o exporta reportes, sin registrar ni modificar nada',
  '{
    "dashboard": ["read"], "socios": ["read"], "ahorro": ["read"], "funeraria": ["read"],
    "salud": ["read"], "prestamos": ["read"], "colecta": ["read"], "asambleas": ["read"],
    "semanas_colecta": ["read"], "tipos_cuenta": ["read"], "tipos_prestamo": ["read"],
    "ubicaciones": ["read"], "personas": ["read"], "trabajadores": ["read"],
    "salud_feria": ["read"], "reportes": ["read", "export"], "impresion": ["create", "read"]
  }'::jsonb
)
ON CONFLICT ("nombre") DO NOTHING;
