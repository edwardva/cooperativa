-- AlterTable
ALTER TABLE "colecta" ADD COLUMN     "fecha_reverso" TIMESTAMP(3),
ADD COLUMN     "motivo_reverso" TEXT,
ADD COLUMN     "reversada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversada_por" INTEGER;

-- CreateIndex
CREATE INDEX "colecta_reversada_idx" ON "colecta"("reversada");

