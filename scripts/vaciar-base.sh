#!/usr/bin/env bash
# ============================================
# VACIAR LA BASE ANTES DE LA MIGRACIÓN DEFINITIVA
# ============================================
#
# El día antes de la puesta en marcha la base se vacía y se vuelve a migrar
# entera desde el sistema anterior. Todo lo que se registró en las pruebas
# (socios PRUEBA, cobros, préstamos, movimientos) se va.
#
# Se CONSERVA la configuración: roles, usuarios con sus claves, parámetros,
# tipos de cuenta, de acuerdo y de préstamo, el calendario de semanas, los
# períodos de salud, el histórico de la tasa BCV y las ferias (menos la de
# prueba). Se VACÍA todo lo que es dato de socios u operación.
#
# Protecciones:
#   - Sin --aplicar sólo muestra qué haría, con la cantidad de filas de cada tabla.
#   - Para aplicar hay que escribir además la palabra de confirmación.
#   - Antes de tocar nada saca un respaldo completo y verifica que no esté vacío.
#   - Si aparece una tabla que no está en ninguna de las dos listas (porque se
#     agregó después), se detiene: nada se vacía por descuido.
#   - Si una tabla que se conserva apunta a una que se vacía, se detiene.
#   - Todo va en una transacción, sin CASCADE: si algo no cuadra, no cambia nada.
#
# Uso, en el servidor:
#   bash scripts/vaciar-base.sh                                   (muestra qué haría)
#   bash scripts/vaciar-base.sh --aplicar --confirmo-vaciar-cooperativa
#   bash scripts/vaciar-base.sh ... --incluir-ferias              (vacía también las ferias)
#
# En otra máquina, PSQL indica cómo conectarse:
#   PSQL="psql postgresql://usuario:clave@localhost/cooperativa" bash scripts/vaciar-base.sh

set -euo pipefail

BASE="${BASE:-cooperativa}"
PSQL="${PSQL:-sudo -u postgres psql -d $BASE}"
PG_DUMP="${PG_DUMP:-sudo -u postgres pg_dump -d $BASE}"
RESPALDOS="${RESPALDOS:-$HOME/respaldos}"

APLICAR=0
CONFIRMA=0
INCLUIR_FERIAS=0
for arg in "$@"; do
  case "$arg" in
    --aplicar) APLICAR=1 ;;
    --confirmo-vaciar-cooperativa) CONFIRMA=1 ;;
    --incluir-ferias) INCLUIR_FERIAS=1 ;;
    *) echo "Opción desconocida: $arg"; exit 1 ;;
  esac
done

# Configuración: no se toca
CONSERVAR=(
  _prisma_migrations
  roles
  usuarios
  parametros_sistema
  tipos_cuenta_ahorro
  tipos_acuerdo_funeraria
  tipos_acuerdo_salud
  tipos_prestamo
  semanas_colecta
  periodos_salud
  historico_tasa_cambio
  ubicaciones
)

# Datos de socios y operación: se vacía
VACIAR=(
  socios
  beneficiarios
  historial_estado_socio
  personas
  socios_trabajadores
  trabajador_feria
  pagos_salud_feria
  pagos_salud_trabajador
  cuentas_ahorro
  movimientos_ahorro
  acuerdos_funeraria
  movimientos_funeraria
  acuerdos_salud
  movimientos_salud
  prestamos
  fiadores
  plan_pagos
  abonos_prestamo
  colecta
  detalle_colecta
  cierre_caja
  movimientos_boveda
  usuarios_digitales
  pagos_web
  asambleas
  asistencias_asamblea
  audit_log
)

if [ "$INCLUIR_FERIAS" = 1 ]; then
  CONSERVAR=("${CONSERVAR[@]/ubicaciones}")
  VACIAR+=(ubicaciones)
fi

sql() { $PSQL -v ON_ERROR_STOP=1 -Atq -c "$1"; }
existe() { [ "$(sql "select to_regclass('public.\"$1\"') is not null")" = "t" ]; }
lista_sql() { local IFS=,; local a=("$@"); printf "'%s'" "${a[0]}"; for t in "${a[@]:1}"; do [ -n "$t" ] && printf ",'%s'" "$t"; done; }

echo "=== Base: $BASE"

# 1. Toda tabla tiene que estar clasificada
sin_clasificar=$(sql "select tablename from pg_tables where schemaname='public'
  and tablename not in ($(lista_sql "${CONSERVAR[@]}"))
  and tablename not in ($(lista_sql "${VACIAR[@]}")) order by 1")
if [ -n "$sin_clasificar" ]; then
  echo "ALTO: estas tablas no están en ninguna lista. Clasifíquelas en el script antes de seguir:"
  echo "$sin_clasificar" | sed 's/^/  - /'
  exit 1
fi

# 2. Ninguna tabla que se conserva puede apuntar a una que se vacía
cruzadas=$(sql "select c.conrelid::regclass || ' -> ' || c.confrelid::regclass
  from pg_constraint c
  where c.contype = 'f'
    and c.conrelid::regclass::text in ($(lista_sql "${CONSERVAR[@]}"))
    and c.confrelid::regclass::text in ($(lista_sql "${VACIAR[@]}"))")
if [ -n "$cruzadas" ]; then
  echo "ALTO: tablas que se conservan apuntan a tablas que se vacían:"
  echo "$cruzadas" | sed 's/^/  - /'
  exit 1
fi

# Las tablas de la lista que no existen en esta base (una base local sin
# historial de migraciones, por ejemplo) se saltean en vez de fallar a mitad
existentes=()
for t in "${VACIAR[@]}"; do
  if existe "$t"; then existentes+=("$t"); else echo "  (no existe $t: se saltea)"; fi
done
VACIAR=("${existentes[@]}")

# 3. Qué hay hoy
contar() { if existe "$1"; then sql "select count(*) from \"$1\""; else echo "no existe"; fi; }
echo
echo "Se VACÍAN:"
total=0
for t in "${VACIAR[@]}"; do
  n=$(contar "$t"); total=$((total + n))
  printf "  %-26s %10s filas\n" "$t" "$n"
done
echo "  ---------------------------------------"
printf "  %-26s %10s filas\n" "total" "$total"
echo
echo "Se CONSERVAN:"
for t in "${CONSERVAR[@]}"; do
  [ -z "$t" ] && continue
  printf "  %-26s %10s\n" "$t" "$(contar "$t")"
done
if [ "$INCLUIR_FERIAS" = 0 ]; then
  echo "  (de ubicaciones se borra sólo la FERIA DE PRUEBA, código PRB)"
fi

if [ "$APLICAR" = 0 ]; then
  echo
  echo "No se cambió nada. Para vaciar: --aplicar --confirmo-vaciar-cooperativa"
  exit 0
fi
if [ "$CONFIRMA" = 0 ]; then
  echo
  echo "ALTO: falta --confirmo-vaciar-cooperativa. No se cambió nada."
  exit 1
fi

# 4. Respaldo completo antes de tocar nada
mkdir -p "$RESPALDOS"
respaldo="$RESPALDOS/antes-de-vaciar-$(date +%Y-%m-%d_%H%M%S).dump"
echo
echo "=== Respaldo en $respaldo"
$PG_DUMP -Fc > "$respaldo"
tamano=$(stat -c %s "$respaldo" 2>/dev/null || stat -f %z "$respaldo")
if [ "$tamano" -lt 1024 ]; then
  echo "ALTO: el respaldo pesa $tamano bytes; algo falló. No se cambió nada."
  exit 1
fi
echo "Respaldo listo ($(( tamano / 1024 )) KB). Para volver atrás:"
echo "  sudo -u postgres pg_restore --clean --if-exists -d $BASE $respaldo"

# 5. Vaciar, todo junto y en una transacción. Sin CASCADE: si alguna tabla
#    fuera de la lista dependiera de estas, falla y no cambia nada.
echo
echo "=== Vaciando"
tablas=$(printf '"%s", ' "${VACIAR[@]}"); tablas="${tablas%, }"
ferias_prueba=""
[ "$INCLUIR_FERIAS" = 0 ] && ferias_prueba="DELETE FROM \"ubicaciones\" WHERE codigo = 'PRB';"
$PSQL -v ON_ERROR_STOP=1 -q <<SQL
BEGIN;
TRUNCATE $tablas RESTART IDENTITY;
$ferias_prueba
COMMIT;
SQL

# 6. Cómo quedó
echo
restantes=0
for t in "${VACIAR[@]}"; do
  n=$(contar "$t")
  if [ "$n" != 0 ]; then echo "  AVISO: $t todavía tiene $n filas"; restantes=$((restantes + n)); fi
done
if [ "$restantes" = 0 ]; then
  echo "Base vacía: las ${#VACIAR[@]} tablas de datos quedaron en cero y sus numeradores vuelven a 1."
  echo "La configuración quedó intacta. Ya se puede correr la migración."
fi
