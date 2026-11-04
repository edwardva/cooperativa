-- Las cajas desde las que se atiende, y de cual salio cada operacion.
--
-- Confirmado por la cooperativa: "asi como esta la oficina sede central que se
-- llama caja1, tambien existe otra sede principal llamada caja2, tiene otra
-- ubicacion y ellos tambien acceden al mismo sistema administrativo; se
-- necesita que ellos con su usuario accedan preguntando en que caja van a
-- ingresar, para llevar el registro de lo que hacen y desde donde, porque por
-- supuesto tienen otros clientes y cierres de caja".
--
-- La caja NO es el usuario: una misma persona puede atender hoy en una y
-- manana en otra, asi que se elige al entrar.
--
-- Las columnas nacen NULAS a proposito: lo ya registrado no se puede inventar
-- de que caja salio, y poner una por defecto seria afirmar algo que no consta.

CREATE TABLE "cajas" (
  "id"           SERIAL PRIMARY KEY,
  "codigo"       VARCHAR(20)  NOT NULL,
  "nombre"       VARCHAR(100) NOT NULL,
  "ubicacion_id" INTEGER,
  "estado"       BOOLEAN      NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "cajas_codigo_key" ON "cajas"("codigo");
CREATE INDEX "cajas_estado_idx" ON "cajas"("estado");

ALTER TABLE "cajas" ADD CONSTRAINT "cajas_ubicacion_id_fkey"
  FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Las dos que existen hoy. El sistema viejo entra con el usuario "caja1".
INSERT INTO "cajas" ("codigo", "nombre") VALUES
  ('caja1', 'Caja 1 — Sede central'),
  ('caja2', 'Caja 2 — Sede principal');

ALTER TABLE "audit_log"  ADD COLUMN "caja_id" INTEGER;
ALTER TABLE "colecta"    ADD COLUMN "caja_id" INTEGER;
ALTER TABLE "cierre_caja" ADD COLUMN "caja_id" INTEGER;

CREATE INDEX "audit_log_caja_id_idx"   ON "audit_log"("caja_id");
CREATE INDEX "colecta_caja_id_idx"     ON "colecta"("caja_id");
CREATE INDEX "cierre_caja_caja_id_idx" ON "cierre_caja"("caja_id");

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_caja_id_fkey"
  FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "colecta" ADD CONSTRAINT "colecta_caja_id_fkey"
  FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cierre_caja" ADD CONSTRAINT "cierre_caja_caja_id_fkey"
  FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
