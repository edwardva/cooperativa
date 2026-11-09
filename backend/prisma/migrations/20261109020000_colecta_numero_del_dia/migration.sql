-- Movimiento N° del socio en el día (pedido del 09/11/2026): se reinicia cada
-- día por socio, para saber cuántos movimientos hizo ese día.
ALTER TABLE "colecta" ADD COLUMN "numero_del_dia" INTEGER;

-- Las colectas ya registradas también quedan numeradas, por día y socio
UPDATE "colecta" c
SET "numero_del_dia" = n.numero
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY socio_id, (fecha_colecta AT TIME ZONE 'UTC' AT TIME ZONE 'America/Caracas')::date
           ORDER BY fecha_colecta, id
         ) AS numero
  FROM "colecta"
) n
WHERE n.id = c.id;
