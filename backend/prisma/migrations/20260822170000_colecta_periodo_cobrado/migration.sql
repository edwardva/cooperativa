-- AlterTable
ALTER TABLE "colecta" ADD COLUMN     "ano_cobro" INTEGER,
ADD COLUMN     "referencia" VARCHAR(50),
ADD COLUMN     "semana_cobro" INTEGER,
ADD COLUMN     "semanas_cobradas" INTEGER NOT NULL DEFAULT 1;

