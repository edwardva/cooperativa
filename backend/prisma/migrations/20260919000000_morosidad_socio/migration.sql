-- Morosidad del socio (Sprint F), con las reglas confirmadas por la cooperativa:
-- al caer en la semana 6 hay 3 días de suspensión; en la 11, un mes en funeraria
-- y 7 días en salud; en la 41 el socio pierde los servicios.
--
-- Acá entran el estado del socio y su historial. El RETIRO de la semana 41 no se
-- aplica solo: queda pendiente de que la cooperativa confirme si lo hace el
-- sistema o una persona, que es como lo hacen hoy.

ALTER TYPE "EstadoSocio" ADD VALUE IF NOT EXISTS 'suspendido';

-- Hasta cuándo corren los días de suspensión: se cumplen aunque pague antes
ALTER TABLE "socios" ADD COLUMN "suspendido_hasta" DATE;

CREATE TABLE "historial_estado_socio" (
    "id" SERIAL NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "estado_anterior" VARCHAR(20) NOT NULL,
    "estado_nuevo" VARCHAR(20) NOT NULL,
    "motivo" TEXT NOT NULL,
    -- 'automatico' (el proceso) o 'manual' (alguien lo hizo desde el sistema)
    "origen" VARCHAR(20) NOT NULL DEFAULT 'automatico',
    "semanas_atraso" INTEGER,
    "suspendido_hasta" DATE,
    "usuario_id" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_estado_socio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "historial_estado_socio_socio_id_fecha_idx" ON "historial_estado_socio"("socio_id", "fecha");

ALTER TABLE "historial_estado_socio"
  ADD CONSTRAINT "historial_estado_socio_socio_id_fkey"
  FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
