-- AlterTable
ALTER TABLE "colecta" ADD COLUMN     "semana_colecta_id" INTEGER;

-- CreateTable
CREATE TABLE "semanas_colecta" (
    "id" SERIAL NOT NULL,
    "semana" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "tasa_usd_bs" DECIMAL(10,4) NOT NULL,
    "meta_ahorro" DECIMAL(15,2) DEFAULT 0,
    "meta_funeraria" DECIMAL(15,2) DEFAULT 0,
    "meta_salud" DECIMAL(15,2) DEFAULT 0,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "actualizado_por" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "semanas_colecta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semanas_colecta_fecha_inicio_fecha_fin_idx" ON "semanas_colecta"("fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE INDEX "semanas_colecta_ano_semana_idx" ON "semanas_colecta"("ano", "semana");

-- CreateIndex
CREATE UNIQUE INDEX "semanas_colecta_semana_ano_key" ON "semanas_colecta"("semana", "ano");

-- CreateIndex
CREATE INDEX "colecta_semana_colecta_id_idx" ON "colecta"("semana_colecta_id");

-- AddForeignKey
ALTER TABLE "colecta" ADD CONSTRAINT "colecta_semana_colecta_id_fkey" FOREIGN KEY ("semana_colecta_id") REFERENCES "semanas_colecta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
