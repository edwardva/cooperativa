-- Marca propia del trabajador de El Triunfo (empleado de la cooperativa).
-- Antes se deducía del sector (parámetro FONDO_SECTORES_TRABAJADORES) y la
-- cooperativa pidió verlo y marcarlo de forma explícita (09/11/2026).
ALTER TABLE "socios" ADD COLUMN "es_trabajador_triunfo" BOOLEAN NOT NULL DEFAULT false;

-- Punto de partida: los socios de los sectores de trabajadores y de la sede
UPDATE "socios" s
SET "es_trabajador_triunfo" = true
FROM "ubicaciones" u
WHERE u."id" = s."ubicacion_id"
  AND (
    UPPER(u."codigo") = 'SEDE'
    OR UPPER(u."codigo") = ANY (
      SELECT UPPER(TRIM(c))
      FROM UNNEST(STRING_TO_ARRAY(
        COALESCE(
          (SELECT "valor" FROM "parametros_sistema" WHERE "clave" = 'FONDO_SECTORES_TRABAJADORES'),
          '01-06'
        ), ','
      )) AS c
    )
  );

CREATE INDEX "socios_es_trabajador_triunfo_idx" ON "socios" ("es_trabajador_triunfo") WHERE "es_trabajador_triunfo";
