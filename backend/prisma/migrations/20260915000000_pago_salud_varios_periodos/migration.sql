-- Un pago de salud por feria cubre uno o varios períodos seguidos.
-- La cooperativa confirmó que la salud de los trabajadores se calcula por
-- SEMANA y que la feria paga varias semanas juntas (8, 9, 10...). El pago
-- guarda desde qué período hasta cuál cubre; los renglones siguen siendo uno
-- por trabajador y período, y el índice único parcial de la migración
-- 20260914000000 sigue impidiendo cobrar dos veces la misma semana.

ALTER TABLE "pagos_salud_feria" ADD COLUMN "periodo_hasta_id" INTEGER;
ALTER TABLE "pagos_salud_feria" ADD COLUMN "cantidad_periodos" INTEGER NOT NULL DEFAULT 1;

-- Los pagos anteriores cubren un solo período
UPDATE "pagos_salud_feria" SET "periodo_hasta_id" = "periodo_id";
ALTER TABLE "pagos_salud_feria" ALTER COLUMN "periodo_hasta_id" SET NOT NULL;

ALTER TABLE "pagos_salud_feria"
  ADD CONSTRAINT "pagos_salud_feria_periodo_hasta_id_fkey"
  FOREIGN KEY ("periodo_hasta_id") REFERENCES "periodos_salud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma no expresa CHECK: si se regenera esta migración, volver a agregarlo
ALTER TABLE "pagos_salud_feria"
  ADD CONSTRAINT "pagos_salud_feria_cantidad_periodos_check" CHECK ("cantidad_periodos" BETWEEN 1 AND 52);

-- La periodicidad pasa a semanal, salvo que ya haya pagos mensuales vigentes:
-- un mes pagado más semanas sueltas de ese mismo mes cobraría dos veces. En ese
-- caso se revisa y se cambia a mano en Parámetros.
UPDATE "parametros_sistema" SET "valor" = 'semanal'
WHERE "clave" = 'PERIODICIDAD_SALUD_FERIA'
  AND NOT EXISTS (
    SELECT 1 FROM "pagos_salud_feria" p
    JOIN "periodos_salud" s ON s."id" = p."periodo_id"
    WHERE s."tipo" = 'mensual' AND p."estado" = 'vigente'
  );
