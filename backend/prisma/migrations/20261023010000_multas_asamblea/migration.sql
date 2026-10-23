-- Multas por inasistencia a asamblea (confirmado por la cooperativa el 23/10).
-- Sólo se guardan las pagadas; quién la debe se calcula de la asistencia.
CREATE TYPE "EstadoMulta" AS ENUM ('pagada', 'reversada');

CREATE TABLE "multas_asamblea" (
    "id" SERIAL NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "monto_usd" DECIMAL(10,2) NOT NULL,
    "monto_bs" DECIMAL(14,2) NOT NULL,
    "tasa_cambio" DECIMAL(12,4) NOT NULL,
    "forma_pago" VARCHAR(20) NOT NULL,
    "referencia" VARCHAR(50),
    "cuenta_ahorro_id" INTEGER,
    "movimiento_ahorro_id" INTEGER,
    "estado" "EstadoMulta" NOT NULL DEFAULT 'pagada',
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" INTEGER NOT NULL,
    "observacion" TEXT,
    "fecha_reverso" TIMESTAMP(3),
    "motivo_reverso" TEXT,
    "reversada_por" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "multas_asamblea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "multas_asamblea_socio_id_ano_idx" ON "multas_asamblea"("socio_id", "ano");
CREATE INDEX "multas_asamblea_fecha_pago_idx" ON "multas_asamblea"("fecha_pago");

-- Una sola multa pagada por socio y año: dos cajas a la vez no pueden cobrarla dos veces
CREATE UNIQUE INDEX "multas_asamblea_una_pagada_por_ano" ON "multas_asamblea"("socio_id", "ano") WHERE "estado" = 'pagada';

ALTER TABLE "multas_asamblea" ADD CONSTRAINT "multas_asamblea_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
