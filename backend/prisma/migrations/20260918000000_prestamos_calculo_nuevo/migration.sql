-- Préstamos con el cálculo confirmado por la cooperativa (2026-09-17):
-- cuotas según la tabla por monto, una cada 21 días, interés mensual por tipo
-- calculado a diario sobre el saldo, e inicial que se paga al llevarse el
-- producto (con ahorro en divisas bloqueado, en bolívares, o mezclando).
--
-- Los préstamos que ya existen NO se convierten aquí: conservan su plan
-- semanal hasta que se revise el informe de conversión con la cooperativa.

-- Estados nuevos: el préstamo que no cubre con su propio ahorro espera la
-- reunión de los martes antes de entregarse
ALTER TYPE "EstadoPrestamo" ADD VALUE IF NOT EXISTS 'solicitado';
ALTER TYPE "EstadoPrestamo" ADD VALUE IF NOT EXISTS 'aprobado';

-- Tasa mensual por tipo de préstamo: 1,5% línea blanca y 1% efectivo
ALTER TABLE "tipos_prestamo" ADD COLUMN "tasa_interes_mensual" DECIMAL(5,2) NOT NULL DEFAULT 0;
UPDATE "tipos_prestamo" SET "tasa_interes_mensual" = ROUND("tasa_interes_anual" / 12, 2);

ALTER TABLE "prestamos"
  ADD COLUMN "cantidad_cuotas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dias_por_cuota" INTEGER NOT NULL DEFAULT 21,
  ADD COLUMN "tasa_interes_mensual" DECIMAL(5,2) NOT NULL DEFAULT 0,
  -- Hasta qué día está corrido el interés: el resto se calcula al consultar o cobrar
  ADD COLUMN "interes_calculado_hasta" DATE,
  ADD COLUMN "inicial_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "inicial_ahorro_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "inicial_efectivo_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "inicial_efectivo_bs" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "fecha_solicitud" DATE,
  ADD COLUMN "fecha_aprobacion" DATE,
  ADD COLUMN "aprobado_por" INTEGER,
  ADD COLUMN "observaciones_aprobacion" TEXT;

-- Lo ya otorgado conserva su plan semanal
UPDATE "prestamos" SET "cantidad_cuotas" = "plazo_semanas", "dias_por_cuota" = 7;
UPDATE "prestamos" p SET "tasa_interes_mensual" = ROUND(p."tasa_interes" / 12, 2);

-- Prisma no expresa CHECK: si se regenera esta migración, volver a agregarlo
ALTER TABLE "prestamos"
  ADD CONSTRAINT "prestamos_inicial_check" CHECK (
    "inicial_usd" >= 0 AND "inicial_ahorro_usd" >= 0 AND "inicial_efectivo_usd" >= 0
    AND "inicial_ahorro_usd" + "inicial_efectivo_usd" <= "inicial_usd" + 0.01
  );

CREATE INDEX "prestamos_estado_fecha_desembolso_idx" ON "prestamos"("estado", "fecha_desembolso");
