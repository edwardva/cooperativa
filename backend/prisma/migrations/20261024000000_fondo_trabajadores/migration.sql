-- Fondo de los trabajadores de El Triunfo (confirmado por la cooperativa el 24/10).
-- Fondo común, en bolívares: entra lo que se consigue y sale como ayuda según el
-- porcentaje del concepto. Los conceptos de partida se editan desde la pantalla.
CREATE TYPE "TipoMovimientoFondo" AS ENUM ('ingreso', 'egreso');
CREATE TYPE "ParentescoFondo" AS ENUM ('padre', 'madre', 'conyuge', 'hijo');

CREATE TABLE "fondo_conceptos" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoMovimientoFondo" NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "porcentaje" DECIMAL(5,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fondo_conceptos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fondo_conceptos_tipo_nombre_key" ON "fondo_conceptos"("tipo", "nombre");

CREATE TABLE "fondo_beneficiarios" (
    "id" SERIAL NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "cedula" VARCHAR(11),
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "parentesco" "ParentescoFondo" NOT NULL,
    "fecha_nacimiento" DATE,
    "telefono" VARCHAR(100),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fondo_beneficiarios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fondo_beneficiarios_socio_id_idx" ON "fondo_beneficiarios"("socio_id");
ALTER TABLE "fondo_beneficiarios" ADD CONSTRAINT "fondo_beneficiarios_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "fondo_movimientos" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoMovimientoFondo" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto_id" INTEGER NOT NULL,
    "descripcion" TEXT,
    "monto_bs" DECIMAL(14,2) NOT NULL,
    "monto_usd" DECIMAL(12,2) NOT NULL,
    "tasa_cambio" DECIMAL(12,4) NOT NULL,
    "entregado_por" VARCHAR(100),
    "referencia" VARCHAR(50),
    "socio_id" INTEGER,
    "beneficiario_id" INTEGER,
    "gasto_total_bs" DECIMAL(14,2),
    "porcentaje" DECIMAL(5,2),
    "a_cargo_socio_bs" DECIMAL(14,2),
    "usuario_id" INTEGER NOT NULL,
    "reversado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_reverso" TIMESTAMP(3),
    "motivo_reverso" TEXT,
    "reversado_por" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fondo_movimientos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fondo_movimientos_fecha_idx" ON "fondo_movimientos"("fecha");
CREATE INDEX "fondo_movimientos_socio_id_idx" ON "fondo_movimientos"("socio_id");
CREATE INDEX "fondo_movimientos_tipo_reversado_idx" ON "fondo_movimientos"("tipo", "reversado");
ALTER TABLE "fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "fondo_conceptos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_beneficiario_id_fkey" FOREIGN KEY ("beneficiario_id") REFERENCES "fondo_beneficiarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Conceptos de partida, sacados de lo que contó la cooperativa. Los porcentajes
-- de los gastos se ajustan con su tabla desde Fondo → Conceptos.
INSERT INTO "fondo_conceptos" ("tipo", "nombre", "porcentaje", "updated_at") VALUES
  ('ingreso', 'Venta de pollo', NULL, now()),
  ('ingreso', 'Venta de queso', NULL, now()),
  ('ingreso', 'Venta de chucherías', NULL, now()),
  ('ingreso', 'Venta de insumos médicos', NULL, now()),
  ('ingreso', 'Otro ingreso', NULL, now()),
  ('egreso', 'Lentes', 70, now()),
  ('egreso', 'Emergencia', 100, now()),
  ('egreso', 'Otro gasto', 100, now());
