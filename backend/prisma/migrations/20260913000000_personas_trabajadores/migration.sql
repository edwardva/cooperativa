-- ============================================================================
-- Personas y expedientes de trabajador (fase 2, Sprint A)
-- ============================================================================
--
-- Persona ≠ expediente. `personas` guarda la identidad; `socios` sigue siendo
-- el expediente ahorrista (ahora con persona_id) y `socios_trabajadores` es el
-- expediente de quien trabaja en una feria, con su historial de ferias en
-- `trabajador_feria`.
--
-- `socios.persona_id` queda NULO: lo completa `prisma/backfill-personas.ts`,
-- que primero muestra qué haría y deja para revisión las cédulas repetidas con
-- nombres distintos. Una migración no puede tomar esa decisión a ciegas.
--
-- Al final van dos índices únicos PARCIALES y dos CHECK que Prisma no expresa
-- en el schema. Prisma los ignora al comparar; si se regenera esta migración
-- desde el schema, hay que volver a agregarlos a mano.
-- ============================================================================

-- CreateEnum
CREATE TYPE "TipoIdentificacion" AS ENUM ('V', 'E', 'J', 'P');

-- CreateEnum
CREATE TYPE "EstadoPersona" AS ENUM ('activo', 'inactivo', 'fallecido');

-- CreateEnum
CREATE TYPE "EstadoTrabajador" AS ENUM ('activo', 'suspendido', 'retirado', 'inactivo');

-- AlterTable
ALTER TABLE "socios" ADD COLUMN     "persona_id" INTEGER;

-- AlterTable
ALTER TABLE "ubicaciones" ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "responsable" VARCHAR(100),
ADD COLUMN     "ubicacion" VARCHAR(150);

-- CreateTable
CREATE TABLE "personas" (
    "id" SERIAL NOT NULL,
    "tipo_identificacion" "TipoIdentificacion" NOT NULL DEFAULT 'V',
    "numero_identificacion" VARCHAR(20) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "sexo" "Sexo",
    "fecha_nacimiento" DATE,
    "telefono" VARCHAR(100),
    "email" VARCHAR(100),
    "direccion" TEXT,
    "estado" "EstadoPersona" NOT NULL DEFAULT 'activo',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socios_trabajadores" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "codigo_trabajador" VARCHAR(20) NOT NULL,
    "fecha_ingreso" DATE NOT NULL,
    "estado" "EstadoTrabajador" NOT NULL DEFAULT 'activo',
    "fecha_salida" DATE,
    "motivo_salida" TEXT,
    "observaciones" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "socios_trabajadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trabajador_feria" (
    "id" SERIAL NOT NULL,
    "trabajador_id" INTEGER NOT NULL,
    "feria_id" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "motivo_cambio" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trabajador_feria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personas_numero_identificacion_key" ON "personas"("numero_identificacion");

-- CreateIndex
CREATE INDEX "personas_apellidos_nombres_idx" ON "personas"("apellidos", "nombres");

-- CreateIndex
CREATE UNIQUE INDEX "socios_trabajadores_codigo_trabajador_key" ON "socios_trabajadores"("codigo_trabajador");

-- CreateIndex
CREATE INDEX "socios_trabajadores_persona_id_idx" ON "socios_trabajadores"("persona_id");

-- CreateIndex
CREATE INDEX "socios_trabajadores_estado_idx" ON "socios_trabajadores"("estado");

-- CreateIndex
CREATE INDEX "trabajador_feria_trabajador_id_idx" ON "trabajador_feria"("trabajador_id");

-- CreateIndex
CREATE INDEX "trabajador_feria_feria_id_idx" ON "trabajador_feria"("feria_id");

-- CreateIndex
CREATE INDEX "socios_persona_id_idx" ON "socios"("persona_id");

-- AddForeignKey
ALTER TABLE "socios" ADD CONSTRAINT "socios_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socios_trabajadores" ADD CONSTRAINT "socios_trabajadores_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajador_feria" ADD CONSTRAINT "trabajador_feria_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "socios_trabajadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajador_feria" ADD CONSTRAINT "trabajador_feria_feria_id_fkey" FOREIGN KEY ("feria_id") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Una persona no tiene dos expedientes de trabajador sin retirar
CREATE UNIQUE INDEX "socios_trabajadores_persona_vigente_key"
  ON "socios_trabajadores"("persona_id") WHERE "estado" <> 'retirado';

-- Una sola feria abierta por trabajador (QA-FIN-06)
CREATE UNIQUE INDEX "trabajador_feria_abierta_key"
  ON "trabajador_feria"("trabajador_id") WHERE "fecha_fin" IS NULL;

ALTER TABLE "trabajador_feria"
  ADD CONSTRAINT "trabajador_feria_fechas_check"
  CHECK ("fecha_fin" IS NULL OR "fecha_fin" >= "fecha_inicio");

ALTER TABLE "socios_trabajadores"
  ADD CONSTRAINT "socios_trabajadores_salida_check"
  CHECK ("fecha_salida" IS NULL OR "fecha_salida" >= "fecha_ingreso");
