-- CreateEnum
CREATE TYPE "TipoAsamblea" AS ENUM ('ordinaria', 'extraordinaria', 'sectorial');

-- CreateTable
CREATE TABLE "asambleas" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "tipo" "TipoAsamblea" NOT NULL DEFAULT 'ordinaria',
    "fecha" DATE NOT NULL,
    "ano" INTEGER NOT NULL,
    "ubicacion_id" INTEGER,
    "descripcion" TEXT,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "creado_por" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asambleas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencias_asamblea" (
    "id" SERIAL NOT NULL,
    "asamblea_id" INTEGER NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "observacion" TEXT,
    "registrado_por" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencias_asamblea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asambleas_ano_idx" ON "asambleas"("ano");

-- CreateIndex
CREATE INDEX "asambleas_fecha_idx" ON "asambleas"("fecha");

-- CreateIndex
CREATE INDEX "asambleas_ubicacion_id_idx" ON "asambleas"("ubicacion_id");

-- CreateIndex
CREATE INDEX "asistencias_asamblea_socio_id_idx" ON "asistencias_asamblea"("socio_id");

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_asamblea_asamblea_id_socio_id_key" ON "asistencias_asamblea"("asamblea_id", "socio_id");

-- AddForeignKey
ALTER TABLE "asambleas" ADD CONSTRAINT "asambleas_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias_asamblea" ADD CONSTRAINT "asistencias_asamblea_asamblea_id_fkey" FOREIGN KEY ("asamblea_id") REFERENCES "asambleas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias_asamblea" ADD CONSTRAINT "asistencias_asamblea_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

