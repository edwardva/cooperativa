/*
  Warnings:

  - A unique constraint covering the columns `[codigo_socio]` on the table `socios` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `codigo_socio` to the `socios` table without a default value. This is not possible if the table is not empty.

*/
-- Step 1: Add codigo_socio column as nullable first
ALTER TABLE "socios" ADD COLUMN "codigo_socio" VARCHAR(20);

-- Step 2: Update existing records with temporary unique codes (SOC-0001, SOC-0002, etc.)
UPDATE "socios" SET "codigo_socio" = 'SOC-' || LPAD(id::text, 4, '0') WHERE "codigo_socio" IS NULL;

-- Step 3: Make codigo_socio NOT NULL
ALTER TABLE "socios" ALTER COLUMN "codigo_socio" SET NOT NULL;

-- Step 4: Add other optional columns
ALTER TABLE "socios" ADD COLUMN "autorizado_cedula" VARCHAR(11);
ALTER TABLE "socios" ADD COLUMN "autorizado_nombre" VARCHAR(100);
ALTER TABLE "socios" ADD COLUMN "notas" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "socios_codigo_socio_key" ON "socios"("codigo_socio");

-- CreateIndex
CREATE INDEX "socios_codigo_socio_idx" ON "socios"("codigo_socio");

-- CreateIndex
CREATE INDEX "socios_estado_idx" ON "socios"("estado");
