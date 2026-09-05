-- ============================================================================
-- COLECTA: cobertura por (año, semana)
-- ============================================================================
--
-- Requisitos 1, 3, 5, 6, 7 y 9 de la reunión con el cliente.
--
-- El cambio de fondo: los servicios dejan de medir la deuda con un contador
-- (`semanas_sin_pago`) y pasan a guardar HASTA QUÉ (año, semana) están pagados.
-- Un contador no puede expresar "pagado hasta la semana 3 de 2027", que es lo
-- que hace falta para adelantar semanas y para cruzar diciembre-enero sin que
-- un técnico intervenga cada año.
--
-- Todo va con IF NOT EXISTS a propósito: varios entornos recibieron columnas
-- por `db push` sin migración, así que esta migración también nivela esa deriva
-- sin fallar donde las columnas ya existen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cobertura pagada en los acuerdos de servicio
-- ----------------------------------------------------------------------------
ALTER TABLE "acuerdos_funeraria"
  ADD COLUMN IF NOT EXISTS "ano_pagado_hasta"    INTEGER,
  ADD COLUMN IF NOT EXISTS "semana_pagada_hasta" INTEGER,
  ADD COLUMN IF NOT EXISTS "fecha_ultimo_pago"   TIMESTAMP(3);

ALTER TABLE "acuerdos_salud"
  ADD COLUMN IF NOT EXISTS "ano_pagado_hasta"    INTEGER,
  ADD COLUMN IF NOT EXISTS "semana_pagada_hasta" INTEGER,
  ADD COLUMN IF NOT EXISTS "fecha_ultimo_pago"   TIMESTAMP(3);

-- Nivelación de deriva: columnas que el modelo ya declaraba y que faltan en
-- las bases que nunca corrieron la migración correspondiente.
ALTER TABLE "acuerdos_salud"
  ADD COLUMN IF NOT EXISTS "numero_acuerdo"  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "numero_contrato" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "fecha_retiro"    DATE,
  ADD COLUMN IF NOT EXISTS "motivo_retiro"   TEXT;

CREATE INDEX IF NOT EXISTS "acuerdos_salud_numero_acuerdo_idx"
  ON "acuerdos_salud"("numero_acuerdo");

-- IF NOT EXISTS y no un guard sobre pg_constraint: en unas bases este indice
-- existe como constraint y en otras como indice suelto, segun por donde llego.
CREATE UNIQUE INDEX IF NOT EXISTS "acuerdos_salud_numero_acuerdo_beneficiario_id_key"
  ON "acuerdos_salud"("numero_acuerdo", "beneficiario_id");

-- ----------------------------------------------------------------------------
-- 2. Período que cubrió cada movimiento de servicio
--    Alimenta los reportes ("hasta qué semana pagó") y el archivo de la
--    funeraria externa.
-- ----------------------------------------------------------------------------
ALTER TABLE "movimientos_funeraria"
  ADD COLUMN IF NOT EXISTS "ano_cobertura"    INTEGER,
  ADD COLUMN IF NOT EXISTS "semana_cobertura" INTEGER;

ALTER TABLE "movimientos_salud"
  ADD COLUMN IF NOT EXISTS "ano_cobertura"    INTEGER,
  ADD COLUMN IF NOT EXISTS "semana_cobertura" INTEGER,
  ADD COLUMN IF NOT EXISTS "numero_recibo"    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "ubicacion_id"     INTEGER;

CREATE INDEX IF NOT EXISTS "movimientos_salud_numero_recibo_idx"
  ON "movimientos_salud"("numero_recibo");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'movimientos_salud_ubicacion_id_fkey') THEN
    ALTER TABLE "movimientos_salud"
      ADD CONSTRAINT "movimientos_salud_ubicacion_id_fkey"
      FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Colecta: oficina, canal y tarifas históricas
--    El cuadre se pide por oficina, colector y canal (req. 9). Las tarifas se
--    congelan en la transacción para que cambiarlas después no altere lo ya
--    cobrado.
-- ----------------------------------------------------------------------------
ALTER TABLE "colecta"
  ADD COLUMN IF NOT EXISTS "ubicacion_id"         INTEGER,
  ADD COLUMN IF NOT EXISTS "canal"                VARCHAR(20) NOT NULL DEFAULT 'presencial',
  ADD COLUMN IF NOT EXISTS "tarifa_ahorro_usd"    DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS "tarifa_funeraria_usd" DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS "tarifa_salud_usd"     DECIMAL(10,4);

CREATE INDEX IF NOT EXISTS "colecta_ubicacion_id_idx" ON "colecta"("ubicacion_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'colecta_ubicacion_id_fkey') THEN
    ALTER TABLE "colecta"
      ADD CONSTRAINT "colecta_ubicacion_id_fkey"
      FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "cierre_caja" ADD COLUMN IF NOT EXISTS "ubicacion_id" INTEGER;

-- ----------------------------------------------------------------------------
-- 4. Detalle de colecta: semanas, tarifa y cobertura antes/después
--    Guardarlo aquí hace el reverso EXACTO. Hoy el reverso adivina las semanas
--    buscando "el último movimiento del acuerdo", que puede no ser el de esta
--    colecta si hubo otra operación entremedio.
-- ----------------------------------------------------------------------------
ALTER TABLE "detalle_colecta"
  ADD COLUMN IF NOT EXISTS "semanas"                  INTEGER,
  ADD COLUMN IF NOT EXISTS "tarifa_unitaria_usd"      DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS "es_reintegro"             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cobertura_ano_antes"      INTEGER,
  ADD COLUMN IF NOT EXISTS "cobertura_semana_antes"   INTEGER,
  ADD COLUMN IF NOT EXISTS "cobertura_ano_despues"    INTEGER,
  ADD COLUMN IF NOT EXISTS "cobertura_semana_despues" INTEGER;

-- ----------------------------------------------------------------------------
-- 5. Ahorro: moneda y canal del movimiento
--    La cuenta lleva ambos saldos, pero el cuadre necesita saber si entraron
--    bolívares o divisas, y si fue presencial o por el cajero digital.
-- ----------------------------------------------------------------------------
ALTER TABLE "movimientos_ahorro"
  ADD COLUMN IF NOT EXISTS "moneda" "Moneda"    NOT NULL DEFAULT 'BS',
  ADD COLUMN IF NOT EXISTS "canal"  VARCHAR(20) NOT NULL DEFAULT 'presencial';

-- ----------------------------------------------------------------------------
-- 6. Préstamos: fecha del último abono y reverso del abono
--    Hoy la pantalla muestra la fecha de otorgamiento y obliga a abrir otra
--    ventana para saber cuándo pagó por última vez (req. 5).
-- ----------------------------------------------------------------------------
ALTER TABLE "prestamos" ADD COLUMN IF NOT EXISTS "fecha_ultimo_abono" TIMESTAMP(3);

ALTER TABLE "abonos_prestamo"
  ADD COLUMN IF NOT EXISTS "reversado"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fecha_reverso"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "motivo_reverso" TEXT,
  ADD COLUMN IF NOT EXISTS "reversado_por"  INTEGER;

-- ----------------------------------------------------------------------------
-- 7. Socio trabajador (req. 7): condiciona las categorías de préstamo
-- ----------------------------------------------------------------------------
ALTER TABLE "socios" ADD COLUMN IF NOT EXISTS "es_trabajador" BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 8. Backfill de la fecha del último abono, a partir del historial existente
-- ----------------------------------------------------------------------------
UPDATE "prestamos" p
SET "fecha_ultimo_abono" = a.ultimo
FROM (SELECT "prestamo_id", MAX("fecha_abono") AS ultimo
      FROM "abonos_prestamo" GROUP BY "prestamo_id") a
WHERE a."prestamo_id" = p."id" AND p."fecha_ultimo_abono" IS NULL;
