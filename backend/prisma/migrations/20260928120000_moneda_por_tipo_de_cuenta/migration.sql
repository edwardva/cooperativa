-- El ahorro a la vista se lleva en BOLIVARES, no en dolares.
--
-- Confirmado por la cooperativa al probar el sistema: "ahorros a la vista debe
-- ser en bolivares, no debe hacer el cambio a $". Hasta ahora el sistema
-- guardaba el saldo en dolares y derivaba los bolivares con la tasa del dia,
-- de modo que el saldo en bolivares de un socio subia o bajaba solo porque
-- cambiaba la tasa. La cuenta a la vista es un producto en bolivares; la de
-- divisas es la que se lleva en dolares.
--
-- Por defecto todo queda en bolivares y se marca en dolares solo AHORRO
-- DIVISAS, que es el unico producto descrito como "cuenta de ahorro en dolares
-- estadounidenses".

CREATE TYPE "MonedaCuenta" AS ENUM ('bs', 'usd');

ALTER TABLE "tipos_cuenta_ahorro"
  ADD COLUMN "moneda" "MonedaCuenta" NOT NULL DEFAULT 'bs';

UPDATE "tipos_cuenta_ahorro" SET "moneda" = 'usd' WHERE "codigo" = '12';
