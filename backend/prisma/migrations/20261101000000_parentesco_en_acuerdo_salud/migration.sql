-- Parentesco con el titular dentro de un acuerdo de salud, para personas de
-- otro expediente (un socio que es beneficiario del acuerdo de otro socio).
ALTER TABLE "acuerdos_salud" ADD COLUMN "parentesco" VARCHAR(30);

-- Personas que hoy figuran como "titular" dentro de un acuerdo ajeno: el
-- titular real de cada acuerdo es la primera fila "titular" (la del socio que
-- lo creó); las demás son beneficiarios. Su parentesco real no se guardó, así
-- que quedan como 'Otro' y se corrige desde el detalle del acuerdo.
WITH titular_de_grupo AS (
  SELECT DISTINCT ON (a.numero_acuerdo) a.numero_acuerdo, b.socio_id
  FROM "acuerdos_salud" a
  JOIN "beneficiarios" b ON b.id = a.beneficiario_id
  WHERE a.numero_acuerdo IS NOT NULL AND LOWER(TRIM(b.parentesco)) = 'titular'
  ORDER BY a.numero_acuerdo, a.id
)
UPDATE "acuerdos_salud" a
SET "parentesco" = 'Otro'
FROM "beneficiarios" b, titular_de_grupo t
WHERE b.id = a.beneficiario_id
  AND t.numero_acuerdo = a.numero_acuerdo
  AND LOWER(TRIM(b.parentesco)) = 'titular'
  AND b.socio_id <> t.socio_id;
