-- Funeraria: los beneficiarios pasan a pertenecer a un acuerdo (máx. 8 activos
-- por acuerdo) y un socio puede tener varios acuerdos de funeraria activos
-- (confirmado por la cooperativa el 29/10).
ALTER TABLE "beneficiarios" ADD COLUMN "acuerdo_funeraria_id" INTEGER;
CREATE INDEX "beneficiarios_acuerdo_funeraria_id_idx" ON "beneficiarios"("acuerdo_funeraria_id");
ALTER TABLE "beneficiarios" ADD CONSTRAINT "beneficiarios_acuerdo_funeraria_id_fkey" FOREIGN KEY ("acuerdo_funeraria_id") REFERENCES "acuerdos_funeraria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hasta ahora cada socio tenía un solo acuerdo y todos sus beneficiarios se
-- mostraban en él: se ligan a ese acuerdo para que nada cambie en pantalla.
-- Si un socio tuviera más de uno, se usa el más antiguo sin retirar.
UPDATE "beneficiarios" b
SET "acuerdo_funeraria_id" = (
  SELECT a."id"
  FROM "acuerdos_funeraria" a
  JOIN "beneficiarios" t ON t."id" = a."beneficiario_id"
  WHERE t."socio_id" = b."socio_id"
  ORDER BY (a."estado" = 'retirado'), a."fecha_inicio", a."id"
  LIMIT 1
)
WHERE lower(trim(b."parentesco")) <> 'titular';
