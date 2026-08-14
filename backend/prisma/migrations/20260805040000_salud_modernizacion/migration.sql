-- AlterTable
ALTER TABLE "acuerdos_salud" ADD COLUMN     "fecha_retiro" DATE,
ADD COLUMN     "motivo_retiro" TEXT,
ADD COLUMN     "numero_acuerdo" VARCHAR(20),
ADD COLUMN     "numero_contrato" VARCHAR(20);

-- AlterTable
ALTER TABLE "movimientos_salud" ADD COLUMN     "numero_recibo" VARCHAR(30),
ADD COLUMN     "ubicacion_id" INTEGER;

-- CreateIndex
CREATE INDEX "acuerdos_salud_numero_acuerdo_idx" ON "acuerdos_salud"("numero_acuerdo");

-- CreateIndex
CREATE UNIQUE INDEX "acuerdos_salud_numero_acuerdo_beneficiario_id_key" ON "acuerdos_salud"("numero_acuerdo", "beneficiario_id");

-- CreateIndex
CREATE INDEX "movimientos_salud_numero_recibo_idx" ON "movimientos_salud"("numero_recibo");

-- AddForeignKey
ALTER TABLE "movimientos_salud" ADD CONSTRAINT "movimientos_salud_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
