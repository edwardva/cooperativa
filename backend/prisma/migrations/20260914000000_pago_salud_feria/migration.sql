-- ============================================================================
-- Pago de salud por feria (fase 2, Sprint B)
-- ============================================================================
--
-- Un pago de la feria por período (encabezado) con un renglón por trabajador.
-- El período lleva su tipo (mensual o semanal): la cooperativa no confirmó la
-- periodicidad, y así cambiarla no altera los pagos hechos.
--
-- Al final: índice único PARCIAL (un renglón vigente por trabajador y
-- período) y CHECK de rangos. Prisma no los expresa en el schema; si se
-- regenera esta migración hay que volver a agregarlos a mano.
-- ============================================================================

-- CreateEnum
CREATE TYPE "TipoPeriodoSalud" AS ENUM ('mensual', 'semanal');

-- CreateEnum
CREATE TYPE "EstadoPagoSalud" AS ENUM ('vigente', 'anulado');

-- CreateTable
CREATE TABLE "periodos_salud" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoPeriodoSalud" NOT NULL,
    "anio" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_salud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_salud_feria" (
    "id" SERIAL NOT NULL,
    "feria_id" INTEGER NOT NULL,
    "periodo_id" INTEGER NOT NULL,
    "fecha_pago" DATE NOT NULL,
    "cantidad_trabajadores" INTEGER NOT NULL,
    "tarifa_usd" DECIMAL(10,2) NOT NULL,
    "monto_esperado_usd" DECIMAL(12,2) NOT NULL,
    "tasa_cambio" DECIMAL(10,4) NOT NULL,
    "monto_esperado_bs" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'BS',
    "monto_recibido" DECIMAL(14,2) NOT NULL,
    "metodo_pago" VARCHAR(30) NOT NULL,
    "referencia" VARCHAR(60),
    "observaciones" TEXT,
    "estado" "EstadoPagoSalud" NOT NULL DEFAULT 'vigente',
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulado_por" INTEGER,
    "fecha_anulacion" TIMESTAMP(3),
    "motivo_anulacion" TEXT,

    CONSTRAINT "pagos_salud_feria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_salud_trabajador" (
    "id" SERIAL NOT NULL,
    "pago_id" INTEGER NOT NULL,
    "trabajador_id" INTEGER NOT NULL,
    "feria_id" INTEGER NOT NULL,
    "periodo_id" INTEGER NOT NULL,
    "monto_usd" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoPagoSalud" NOT NULL DEFAULT 'vigente',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_salud_trabajador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "periodos_salud_tipo_anio_numero_key" ON "periodos_salud"("tipo", "anio", "numero");

-- CreateIndex
CREATE INDEX "pagos_salud_feria_feria_id_periodo_id_idx" ON "pagos_salud_feria"("feria_id", "periodo_id");

-- CreateIndex
CREATE INDEX "pagos_salud_feria_referencia_idx" ON "pagos_salud_feria"("referencia");

-- CreateIndex
CREATE INDEX "pagos_salud_feria_estado_idx" ON "pagos_salud_feria"("estado");

-- CreateIndex
CREATE INDEX "pagos_salud_trabajador_trabajador_id_periodo_id_idx" ON "pagos_salud_trabajador"("trabajador_id", "periodo_id");

-- CreateIndex
CREATE INDEX "pagos_salud_trabajador_pago_id_idx" ON "pagos_salud_trabajador"("pago_id");

-- CreateIndex
CREATE INDEX "pagos_salud_trabajador_periodo_id_feria_id_idx" ON "pagos_salud_trabajador"("periodo_id", "feria_id");

-- AddForeignKey
ALTER TABLE "pagos_salud_feria" ADD CONSTRAINT "pagos_salud_feria_feria_id_fkey" FOREIGN KEY ("feria_id") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_salud_feria" ADD CONSTRAINT "pagos_salud_feria_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_salud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_salud_trabajador" ADD CONSTRAINT "pagos_salud_trabajador_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos_salud_feria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_salud_trabajador" ADD CONSTRAINT "pagos_salud_trabajador_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "socios_trabajadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_salud_trabajador" ADD CONSTRAINT "pagos_salud_trabajador_feria_id_fkey" FOREIGN KEY ("feria_id") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_salud_trabajador" ADD CONSTRAINT "pagos_salud_trabajador_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_salud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RN-10: el mismo trabajador no queda pagado dos veces en un período.
-- Un renglón anulado no cuenta, así el período se puede volver a pagar.
CREATE UNIQUE INDEX "pagos_salud_trabajador_vigente_key"
  ON "pagos_salud_trabajador"("trabajador_id", "periodo_id") WHERE "estado" = 'vigente';

ALTER TABLE "periodos_salud"
  ADD CONSTRAINT "periodos_salud_numero_check"
  CHECK (("tipo" = 'mensual' AND "numero" BETWEEN 1 AND 12) OR ("tipo" = 'semanal' AND "numero" BETWEEN 1 AND 53));

ALTER TABLE "pagos_salud_feria"
  ADD CONSTRAINT "pagos_salud_feria_montos_check"
  CHECK ("cantidad_trabajadores" > 0 AND "tarifa_usd" > 0 AND "monto_recibido" >= 0);

ALTER TABLE "pagos_salud_trabajador"
  ADD CONSTRAINT "pagos_salud_trabajador_monto_check" CHECK ("monto_usd" > 0);
