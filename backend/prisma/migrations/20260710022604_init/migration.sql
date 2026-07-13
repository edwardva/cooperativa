-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('activo', 'inactivo', 'bloqueado');

-- CreateEnum
CREATE TYPE "EstadoSocio" AS ENUM ('activo', 'suspendido', 'inactivo', 'retirado');

-- CreateEnum
CREATE TYPE "EstadoBeneficiario" AS ENUM ('activo', 'inactivo', 'retirado');

-- CreateEnum
CREATE TYPE "EstadoServicio" AS ENUM ('activo', 'suspendido', 'retirado');

-- CreateEnum
CREATE TYPE "EstadoPrestamo" AS ENUM ('activo', 'saldado', 'moroso', 'refinanciado', 'cancelado');

-- CreateEnum
CREATE TYPE "EstadoFiador" AS ENUM ('activo', 'liberado');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('pendiente', 'pagada', 'vencida');

-- CreateEnum
CREATE TYPE "TipoMovimientoBoveda" AS ENUM ('entrada', 'salida');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('USD', 'BS');

-- CreateEnum
CREATE TYPE "EstadoPagoWeb" AS ENUM ('pendiente', 'conciliado', 'rechazado');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100),
    "password_hash" VARCHAR(255) NOT NULL,
    "nombre_completo" VARCHAR(150) NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'activo',
    "ultimo_acceso" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "permisos" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socios" (
    "id" SERIAL NOT NULL,
    "cedula" VARCHAR(11) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "fecha_nacimiento" DATE,
    "direccion" TEXT,
    "telefono" VARCHAR(20),
    "email" VARCHAR(100),
    "fecha_inscripcion" DATE NOT NULL,
    "estado" "EstadoSocio" NOT NULL DEFAULT 'activo',
    "es_delegado" BOOLEAN NOT NULL DEFAULT false,
    "ubicacion_id" INTEGER,
    "foto_url" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "socios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiarios" (
    "id" SERIAL NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "cedula" VARCHAR(11) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "fecha_nacimiento" DATE,
    "parentesco" VARCHAR(50) NOT NULL,
    "telefono" VARCHAR(20),
    "estado" "EstadoBeneficiario" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "direccion" TEXT,
    "telefono" VARCHAR(20),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_cuenta_ahorro" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_cuenta_ahorro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_ahorro" (
    "id" SERIAL NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "tipo_cuenta_id" INTEGER NOT NULL,
    "numero_cuenta" VARCHAR(20) NOT NULL,
    "saldo_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo_bs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monto_bloqueado_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monto_bloqueado_bs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_apertura" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_ahorro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_ahorro" (
    "id" SERIAL NOT NULL,
    "cuenta_id" INTEGER NOT NULL,
    "tipo_movimiento" VARCHAR(20) NOT NULL,
    "monto_usd" DECIMAL(12,2) NOT NULL,
    "monto_bs" DECIMAL(12,2) NOT NULL,
    "tasa_cambio" DECIMAL(10,4) NOT NULL,
    "saldo_anterior_usd" DECIMAL(12,2) NOT NULL,
    "saldo_nuevo_usd" DECIMAL(12,2) NOT NULL,
    "concepto" TEXT,
    "referencia" VARCHAR(50),
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_ahorro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_acuerdo_funeraria" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "monto_usd" DECIMAL(10,2) NOT NULL,
    "ubicacion" VARCHAR(100),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_acuerdo_funeraria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acuerdos_funeraria" (
    "id" SERIAL NOT NULL,
    "beneficiario_id" INTEGER NOT NULL,
    "tipo_acuerdo_id" INTEGER NOT NULL,
    "estado" "EstadoServicio" NOT NULL DEFAULT 'activo',
    "semanas_sin_pago" INTEGER NOT NULL DEFAULT 0,
    "fecha_suspension" DATE,
    "fecha_inicio" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acuerdos_funeraria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_funeraria" (
    "id" SERIAL NOT NULL,
    "acuerdo_id" INTEGER NOT NULL,
    "tipo_movimiento" VARCHAR(20) NOT NULL,
    "monto_usd" DECIMAL(10,2) NOT NULL,
    "monto_bs" DECIMAL(10,2) NOT NULL,
    "tasa_cambio" DECIMAL(10,4) NOT NULL,
    "semanas_pagadas" INTEGER,
    "concepto" TEXT,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_funeraria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_acuerdo_salud" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "monto_usd" DECIMAL(10,2) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_acuerdo_salud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acuerdos_salud" (
    "id" SERIAL NOT NULL,
    "beneficiario_id" INTEGER NOT NULL,
    "tipo_acuerdo_id" INTEGER NOT NULL,
    "estado" "EstadoServicio" NOT NULL DEFAULT 'activo',
    "semanas_sin_pago" INTEGER NOT NULL DEFAULT 0,
    "fecha_suspension" DATE,
    "fecha_inicio" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acuerdos_salud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_salud" (
    "id" SERIAL NOT NULL,
    "acuerdo_id" INTEGER NOT NULL,
    "tipo_movimiento" VARCHAR(20) NOT NULL,
    "monto_usd" DECIMAL(10,2) NOT NULL,
    "monto_bs" DECIMAL(10,2) NOT NULL,
    "tasa_cambio" DECIMAL(10,4) NOT NULL,
    "semanas_pagadas" INTEGER,
    "concepto" TEXT,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_salud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_prestamo" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "tasa_interes_anual" DECIMAL(5,2) NOT NULL,
    "tasa_mora_mensual" DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    "plazo_maximo_semanas" INTEGER NOT NULL DEFAULT 52,
    "requiere_fiadores" BOOLEAN NOT NULL DEFAULT true,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_prestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestamos" (
    "id" SERIAL NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "tipo_prestamo_id" INTEGER NOT NULL,
    "numero_prestamo" VARCHAR(20) NOT NULL,
    "monto_original_usd" DECIMAL(12,2) NOT NULL,
    "monto_original_bs" DECIMAL(12,2) NOT NULL,
    "tasa_cambio_inicial" DECIMAL(10,4) NOT NULL,
    "tasa_interes" DECIMAL(5,2) NOT NULL,
    "plazo_semanas" INTEGER NOT NULL,
    "cuota_semanal_usd" DECIMAL(10,2) NOT NULL,
    "cuota_semanal_bs" DECIMAL(10,2) NOT NULL,
    "saldo_capital_usd" DECIMAL(12,2) NOT NULL,
    "saldo_capital_bs" DECIMAL(12,2) NOT NULL,
    "saldo_interes_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo_interes_bs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo_mora_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo_mora_bs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "EstadoPrestamo" NOT NULL DEFAULT 'activo',
    "fecha_desembolso" DATE NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prestamos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiadores" (
    "id" SERIAL NOT NULL,
    "prestamo_id" INTEGER NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "monto_garantizado_usd" DECIMAL(12,2) NOT NULL,
    "monto_garantizado_bs" DECIMAL(12,2) NOT NULL,
    "monto_bloqueado_usd" DECIMAL(12,2) NOT NULL,
    "monto_bloqueado_bs" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoFiador" NOT NULL DEFAULT 'activo',
    "fecha_liberacion" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_pagos" (
    "id" SERIAL NOT NULL,
    "prestamo_id" INTEGER NOT NULL,
    "numero_cuota" INTEGER NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "monto_capital_usd" DECIMAL(10,2) NOT NULL,
    "monto_capital_bs" DECIMAL(10,2) NOT NULL,
    "monto_interes_usd" DECIMAL(10,2) NOT NULL,
    "monto_interes_bs" DECIMAL(10,2) NOT NULL,
    "monto_total_usd" DECIMAL(10,2) NOT NULL,
    "monto_total_bs" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'pendiente',
    "fecha_pago" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abonos_prestamo" (
    "id" SERIAL NOT NULL,
    "prestamo_id" INTEGER NOT NULL,
    "monto_usd" DECIMAL(10,2) NOT NULL,
    "monto_bs" DECIMAL(10,2) NOT NULL,
    "tasa_cambio" DECIMAL(10,4) NOT NULL,
    "aplicado_capital_usd" DECIMAL(10,2) NOT NULL,
    "aplicado_capital_bs" DECIMAL(10,2) NOT NULL,
    "aplicado_interes_usd" DECIMAL(10,2) NOT NULL,
    "aplicado_interes_bs" DECIMAL(10,2) NOT NULL,
    "aplicado_mora_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "aplicado_mora_bs" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "concepto" TEXT,
    "fecha_abono" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abonos_prestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colecta" (
    "id" SERIAL NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "fecha_colecta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto_total_usd" DECIMAL(10,2) NOT NULL,
    "monto_total_bs" DECIMAL(10,2) NOT NULL,
    "tasa_cambio" DECIMAL(10,4) NOT NULL,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colecta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalle_colecta" (
    "id" SERIAL NOT NULL,
    "colecta_id" INTEGER NOT NULL,
    "servicio" VARCHAR(20) NOT NULL,
    "referencia_id" INTEGER,
    "monto_usd" DECIMAL(10,2) NOT NULL,
    "monto_bs" DECIMAL(10,2) NOT NULL,
    "concepto" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detalle_colecta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_caja" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "fecha_cierre" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_inicio_operacion" DATE NOT NULL,
    "fecha_fin_operacion" DATE NOT NULL,
    "total_ahorro_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_funeraria_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_salud_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_prestamos_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_general_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_ahorro_bs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_funeraria_bs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_salud_bs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_prestamos_bs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_general_bs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cantidad_transacciones" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierre_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_boveda" (
    "id" SERIAL NOT NULL,
    "tipo_movimiento" "TipoMovimientoBoveda" NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_boveda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_digitales" (
    "id" SERIAL NOT NULL,
    "socio_id" INTEGER NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_digitales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_web" (
    "id" SERIAL NOT NULL,
    "usuario_digital_id" INTEGER NOT NULL,
    "monto_usd" DECIMAL(10,2) NOT NULL,
    "monto_bs" DECIMAL(10,2) NOT NULL,
    "referencia_bancaria" VARCHAR(100) NOT NULL,
    "banco" VARCHAR(100) NOT NULL,
    "fecha_pago" DATE NOT NULL,
    "estado" "EstadoPagoWeb" NOT NULL DEFAULT 'pendiente',
    "fecha_conciliacion" DATE,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_web_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_sistema" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(50) NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo_dato" VARCHAR(20) NOT NULL DEFAULT 'string',
    "actualizado_por" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametros_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_tasa_cambio" (
    "id" SERIAL NOT NULL,
    "tasa" DECIMAL(10,4) NOT NULL,
    "fecha_vigencia" DATE NOT NULL,
    "actualizado_por" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_tasa_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER,
    "accion" VARCHAR(50) NOT NULL,
    "modulo" VARCHAR(50) NOT NULL,
    "registro_id" INTEGER,
    "datos_antes" JSONB,
    "datos_despues" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "socios_cedula_key" ON "socios"("cedula");

-- CreateIndex
CREATE INDEX "socios_cedula_idx" ON "socios"("cedula");

-- CreateIndex
CREATE INDEX "socios_nombre_apellido_idx" ON "socios"("nombre", "apellido");

-- CreateIndex
CREATE INDEX "socios_ubicacion_id_idx" ON "socios"("ubicacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "beneficiarios_cedula_key" ON "beneficiarios"("cedula");

-- CreateIndex
CREATE INDEX "beneficiarios_socio_id_idx" ON "beneficiarios"("socio_id");

-- CreateIndex
CREATE INDEX "beneficiarios_cedula_idx" ON "beneficiarios"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_codigo_key" ON "ubicaciones"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_cuenta_ahorro_codigo_key" ON "tipos_cuenta_ahorro"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_ahorro_numero_cuenta_key" ON "cuentas_ahorro"("numero_cuenta");

-- CreateIndex
CREATE INDEX "cuentas_ahorro_socio_id_idx" ON "cuentas_ahorro"("socio_id");

-- CreateIndex
CREATE INDEX "cuentas_ahorro_numero_cuenta_idx" ON "cuentas_ahorro"("numero_cuenta");

-- CreateIndex
CREATE INDEX "movimientos_ahorro_cuenta_id_idx" ON "movimientos_ahorro"("cuenta_id");

-- CreateIndex
CREATE INDEX "movimientos_ahorro_fecha_movimiento_idx" ON "movimientos_ahorro"("fecha_movimiento");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_acuerdo_funeraria_codigo_key" ON "tipos_acuerdo_funeraria"("codigo");

-- CreateIndex
CREATE INDEX "acuerdos_funeraria_beneficiario_id_idx" ON "acuerdos_funeraria"("beneficiario_id");

-- CreateIndex
CREATE INDEX "acuerdos_funeraria_estado_idx" ON "acuerdos_funeraria"("estado");

-- CreateIndex
CREATE INDEX "movimientos_funeraria_acuerdo_id_idx" ON "movimientos_funeraria"("acuerdo_id");

-- CreateIndex
CREATE INDEX "movimientos_funeraria_fecha_movimiento_idx" ON "movimientos_funeraria"("fecha_movimiento");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_acuerdo_salud_codigo_key" ON "tipos_acuerdo_salud"("codigo");

-- CreateIndex
CREATE INDEX "acuerdos_salud_beneficiario_id_idx" ON "acuerdos_salud"("beneficiario_id");

-- CreateIndex
CREATE INDEX "acuerdos_salud_estado_idx" ON "acuerdos_salud"("estado");

-- CreateIndex
CREATE INDEX "movimientos_salud_acuerdo_id_idx" ON "movimientos_salud"("acuerdo_id");

-- CreateIndex
CREATE INDEX "movimientos_salud_fecha_movimiento_idx" ON "movimientos_salud"("fecha_movimiento");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_prestamo_codigo_key" ON "tipos_prestamo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "prestamos_numero_prestamo_key" ON "prestamos"("numero_prestamo");

-- CreateIndex
CREATE INDEX "prestamos_socio_id_idx" ON "prestamos"("socio_id");

-- CreateIndex
CREATE INDEX "prestamos_numero_prestamo_idx" ON "prestamos"("numero_prestamo");

-- CreateIndex
CREATE INDEX "prestamos_estado_idx" ON "prestamos"("estado");

-- CreateIndex
CREATE INDEX "fiadores_prestamo_id_idx" ON "fiadores"("prestamo_id");

-- CreateIndex
CREATE INDEX "fiadores_socio_id_idx" ON "fiadores"("socio_id");

-- CreateIndex
CREATE INDEX "plan_pagos_prestamo_id_idx" ON "plan_pagos"("prestamo_id");

-- CreateIndex
CREATE INDEX "plan_pagos_fecha_vencimiento_idx" ON "plan_pagos"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "abonos_prestamo_prestamo_id_idx" ON "abonos_prestamo"("prestamo_id");

-- CreateIndex
CREATE INDEX "abonos_prestamo_fecha_abono_idx" ON "abonos_prestamo"("fecha_abono");

-- CreateIndex
CREATE INDEX "colecta_socio_id_idx" ON "colecta"("socio_id");

-- CreateIndex
CREATE INDEX "colecta_fecha_colecta_idx" ON "colecta"("fecha_colecta");

-- CreateIndex
CREATE INDEX "colecta_usuario_id_idx" ON "colecta"("usuario_id");

-- CreateIndex
CREATE INDEX "detalle_colecta_colecta_id_idx" ON "detalle_colecta"("colecta_id");

-- CreateIndex
CREATE INDEX "cierre_caja_usuario_id_idx" ON "cierre_caja"("usuario_id");

-- CreateIndex
CREATE INDEX "cierre_caja_fecha_cierre_idx" ON "cierre_caja"("fecha_cierre");

-- CreateIndex
CREATE INDEX "movimientos_boveda_fecha_movimiento_idx" ON "movimientos_boveda"("fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_boveda_moneda_idx" ON "movimientos_boveda"("moneda");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_digitales_socio_id_key" ON "usuarios_digitales"("socio_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_digitales_username_key" ON "usuarios_digitales"("username");

-- CreateIndex
CREATE INDEX "pagos_web_usuario_digital_id_idx" ON "pagos_web"("usuario_digital_id");

-- CreateIndex
CREATE INDEX "pagos_web_estado_idx" ON "pagos_web"("estado");

-- CreateIndex
CREATE INDEX "pagos_web_fecha_pago_idx" ON "pagos_web"("fecha_pago");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_sistema_clave_key" ON "parametros_sistema"("clave");

-- CreateIndex
CREATE INDEX "historico_tasa_cambio_fecha_vigencia_idx" ON "historico_tasa_cambio"("fecha_vigencia");

-- CreateIndex
CREATE INDEX "audit_log_usuario_id_idx" ON "audit_log"("usuario_id");

-- CreateIndex
CREATE INDEX "audit_log_accion_idx" ON "audit_log"("accion");

-- CreateIndex
CREATE INDEX "audit_log_modulo_idx" ON "audit_log"("modulo");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socios" ADD CONSTRAINT "socios_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiarios" ADD CONSTRAINT "beneficiarios_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_ahorro" ADD CONSTRAINT "cuentas_ahorro_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_ahorro" ADD CONSTRAINT "cuentas_ahorro_tipo_cuenta_id_fkey" FOREIGN KEY ("tipo_cuenta_id") REFERENCES "tipos_cuenta_ahorro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_ahorro" ADD CONSTRAINT "movimientos_ahorro_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_ahorro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acuerdos_funeraria" ADD CONSTRAINT "acuerdos_funeraria_beneficiario_id_fkey" FOREIGN KEY ("beneficiario_id") REFERENCES "beneficiarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acuerdos_funeraria" ADD CONSTRAINT "acuerdos_funeraria_tipo_acuerdo_id_fkey" FOREIGN KEY ("tipo_acuerdo_id") REFERENCES "tipos_acuerdo_funeraria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_funeraria" ADD CONSTRAINT "movimientos_funeraria_acuerdo_id_fkey" FOREIGN KEY ("acuerdo_id") REFERENCES "acuerdos_funeraria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acuerdos_salud" ADD CONSTRAINT "acuerdos_salud_beneficiario_id_fkey" FOREIGN KEY ("beneficiario_id") REFERENCES "beneficiarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acuerdos_salud" ADD CONSTRAINT "acuerdos_salud_tipo_acuerdo_id_fkey" FOREIGN KEY ("tipo_acuerdo_id") REFERENCES "tipos_acuerdo_salud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_salud" ADD CONSTRAINT "movimientos_salud_acuerdo_id_fkey" FOREIGN KEY ("acuerdo_id") REFERENCES "acuerdos_salud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_tipo_prestamo_id_fkey" FOREIGN KEY ("tipo_prestamo_id") REFERENCES "tipos_prestamo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiadores" ADD CONSTRAINT "fiadores_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiadores" ADD CONSTRAINT "fiadores_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_pagos" ADD CONSTRAINT "plan_pagos_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonos_prestamo" ADD CONSTRAINT "abonos_prestamo_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colecta" ADD CONSTRAINT "colecta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_colecta" ADD CONSTRAINT "detalle_colecta_colecta_id_fkey" FOREIGN KEY ("colecta_id") REFERENCES "colecta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_caja" ADD CONSTRAINT "cierre_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_boveda" ADD CONSTRAINT "movimientos_boveda_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_digitales" ADD CONSTRAINT "usuarios_digitales_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_web" ADD CONSTRAINT "pagos_web_usuario_digital_id_fkey" FOREIGN KEY ("usuario_digital_id") REFERENCES "usuarios_digitales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
