-- Una persona puede figurar en VARIOS acuerdos de funeraria (pedido de la
-- cooperativa del 10/11): "cuando un beneficiario está registrado en algún
-- acuerdo, debe permitir incluirlo en otro acuerdo", y quien salió de un
-- acuerdo debe poder registrarse de nuevo.
--
-- Hasta ahora la pertenencia era UNA columna en la ficha
-- (beneficiarios.acuerdo_funeraria_id + fecha_retiro_funeraria): una persona
-- solo podía estar en un acuerdo. Pasa a ser una tabla propia, un renglón por
-- cada vez que la persona entra a un acuerdo:
--   * entrar a otro acuerdo = otro renglón (el primero no se toca);
--   * retirarse = se pone fecha_retiro (el renglón NO se borra: es historial);
--   * volver a entrar = un renglón nuevo, así se ve cuándo salió y cuándo volvió.
--
-- Las fichas (datos de la persona) no cambian: siguen siendo una por
-- expediente, y la del titular sigue en acuerdos_funeraria.beneficiario_id.

CREATE TABLE "acuerdo_funeraria_beneficiarios" (
  "id"              SERIAL       PRIMARY KEY,
  "acuerdo_id"      INTEGER      NOT NULL,
  "beneficiario_id" INTEGER      NOT NULL,
  "fecha_ingreso"   DATE         NOT NULL DEFAULT CURRENT_DATE,
  "fecha_retiro"    DATE,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "acuerdo_funeraria_beneficiarios_acuerdo_id_idx" ON "acuerdo_funeraria_beneficiarios"("acuerdo_id");
CREATE INDEX "acuerdo_funeraria_beneficiarios_beneficiario_id_idx" ON "acuerdo_funeraria_beneficiarios"("beneficiario_id");

-- La misma persona no puede estar DOS veces vigente en el mismo acuerdo (sí
-- una vigente y varias ya retiradas, que son su historial)
CREATE UNIQUE INDEX "acuerdo_funeraria_beneficiarios_vigente_key"
  ON "acuerdo_funeraria_beneficiarios"("acuerdo_id", "beneficiario_id")
  WHERE "fecha_retiro" IS NULL;

-- Borrar un acuerdo (solo se permite si no tiene pagos) se lleva sus renglones;
-- antes la ficha quedaba con acuerdo_funeraria_id en NULL, que es lo mismo.
ALTER TABLE "acuerdo_funeraria_beneficiarios" ADD CONSTRAINT "acuerdo_funeraria_beneficiarios_acuerdo_id_fkey"
  FOREIGN KEY ("acuerdo_id") REFERENCES "acuerdos_funeraria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acuerdo_funeraria_beneficiarios" ADD CONSTRAINT "acuerdo_funeraria_beneficiarios_beneficiario_id_fkey"
  FOREIGN KEY ("beneficiario_id") REFERENCES "beneficiarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pasar lo que ya existe, tal cual: quien está en un acuerdo, con su fecha de
-- retiro de funeraria si la tiene. Sin fecha de ingreso, la de alta de la ficha.
INSERT INTO "acuerdo_funeraria_beneficiarios" ("acuerdo_id", "beneficiario_id", "fecha_ingreso", "fecha_retiro", "created_at", "updated_at")
SELECT b."acuerdo_funeraria_id",
       b."id",
       COALESCE(b."fecha_ingreso", b."created_at"::date),
       b."fecha_retiro_funeraria",
       b."created_at",
       CURRENT_TIMESTAMP
FROM "beneficiarios" b
WHERE b."acuerdo_funeraria_id" IS NOT NULL;

-- beneficiarios.acuerdo_funeraria_id y fecha_retiro_funeraria quedan como
-- estaban (no se borran, para no perder el dato de origen), pero el sistema
-- deja de leerlos y escribirlos: la pertenencia vive en la tabla nueva.
COMMENT ON COLUMN "beneficiarios"."acuerdo_funeraria_id" IS 'OBSOLETO desde 10/11/2026: ver acuerdo_funeraria_beneficiarios';
COMMENT ON COLUMN "beneficiarios"."fecha_retiro_funeraria" IS 'OBSOLETO desde 10/11/2026: ver acuerdo_funeraria_beneficiarios';
