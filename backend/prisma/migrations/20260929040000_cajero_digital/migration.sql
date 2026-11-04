-- Cajero digital: el socio declara desde el celular lo que pago.
--
-- Las tablas `usuarios_digitales` y `pagos_web` ya existian sin nada encima.
-- Se les agrega lo que hacia falta para que el pago sirva de algo: PARA QUE es
-- (semanas, prestamo o ahorro), cuantas semanas cubre, quien lo reviso, y la
-- colecta que se genero al conciliarlo.
--
-- Un pago web NO es un cobro: es un aviso. No toca ningun saldo mientras esta
-- pendiente; alguien lo verifica contra el banco antes de cobrarlo.

CREATE TYPE "DestinoPagoWeb" AS ENUM ('semanas', 'prestamo', 'ahorro');

-- El celular con el que se registro: por ahi va la recuperacion de clave,
-- igual que en el cajero digital actual
ALTER TABLE "usuarios_digitales" ADD COLUMN "telefono" VARCHAR(100);

ALTER TABLE "pagos_web"
  ADD COLUMN "destino"        "DestinoPagoWeb" NOT NULL DEFAULT 'semanas',
  ADD COLUMN "semanas"        INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN "prestamo_id"    INTEGER,
  ADD COLUMN "revisado_por"   INTEGER,
  ADD COLUMN "motivo_rechazo" TEXT,
  ADD COLUMN "colecta_id"     INTEGER;

CREATE INDEX "pagos_web_prestamo_id_idx" ON "pagos_web"("prestamo_id");
CREATE INDEX "pagos_web_colecta_id_idx"  ON "pagos_web"("colecta_id");

ALTER TABLE "pagos_web" ADD CONSTRAINT "pagos_web_prestamo_id_fkey"
  FOREIGN KEY ("prestamo_id") REFERENCES "prestamos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagos_web" ADD CONSTRAINT "pagos_web_colecta_id_fkey"
  FOREIGN KEY ("colecta_id") REFERENCES "colecta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagos_web" ADD CONSTRAINT "pagos_web_revisado_por_fkey"
  FOREIGN KEY ("revisado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La referencia bancaria no se puede repetir: es lo unico que impide que el
-- mismo comprobante se declare dos veces y se cobre dos veces
CREATE UNIQUE INDEX "pagos_web_referencia_bancaria_key" ON "pagos_web"("referencia_bancaria");
