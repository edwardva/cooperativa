-- AlterEnum
ALTER TYPE "EstadoBeneficiario" ADD VALUE 'fallecido';

-- AlterTable
ALTER TABLE "acuerdos_funeraria" ADD COLUMN     "fecha_retiro" DATE,
ADD COLUMN     "motivo_retiro" TEXT,
ADD COLUMN     "numero_acuerdo" VARCHAR(20),
ADD COLUMN     "numero_contrato" VARCHAR(20);

-- AlterTable
ALTER TABLE "beneficiarios" ADD COLUMN     "fecha_fallecimiento" DATE,
ADD COLUMN     "fecha_ingreso" DATE;

-- AlterTable
ALTER TABLE "socios" ADD COLUMN     "codigo_social" VARCHAR(30);

-- CreateIndex
CREATE UNIQUE INDEX "acuerdos_funeraria_numero_acuerdo_key" ON "acuerdos_funeraria"("numero_acuerdo");

-- CreateIndex
CREATE INDEX "acuerdos_funeraria_numero_acuerdo_idx" ON "acuerdos_funeraria"("numero_acuerdo");

