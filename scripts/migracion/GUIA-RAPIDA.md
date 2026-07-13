# 🔄 Guía Rápida: Migración de Socios

**Objetivo:** Migrar los 9,585 socios del sistema PHP antiguo al nuevo sistema React + Node.js + PostgreSQL

---

## ✅ Prerequisitos

- [x] Acceso a la base de datos del sistema viejo (o acceso web)
- [x] Nuevo sistema instalado localmente
- [x] Node.js 20+ instalado
- [x] PostgreSQL 16+ corriendo (via Docker)

---

## 📦 Paso 1: Preparación

### 1.1. Instalar dependencias

```bash
cd scripts/migracion
npm install
```

### 1.2. Verificar estructura de directorios

```bash
ls -la
# Debe mostrar:
# - 1-extract-socios.sql
# - 2-import-socios.ts
# - 3-validate-socios.ts
# - 4-rollback-socios.ts
# - 5-import-beneficiarios.ts
# - generate-report.ts
# - data/ (vacío)
# - logs/ (vacío)
```

---

## 📤 Paso 2: Extracción de Datos

### Opción A: Exportación SQL (RECOMENDADO)

Si tienes acceso a la base de datos vieja:

```bash
# 1. Conectarse a la BD vieja
psql -h <host_viejo> -U <usuario_viejo> -d <database_vieja>

# 2. Ejecutar script de extracción
\i 1-extract-socios.sql

# 3. Los archivos CSV se generan en /tmp/
# Copiarlos a data/
cp /tmp/socios_export.csv data/
cp /tmp/beneficiarios_export.csv data/
cp /tmp/ubicaciones_export.csv data/
```

### Opción B: Web Scraping (si no hay acceso a BD)

Si solo tienes acceso al sistema PHP por web:

```bash
# 1. Editar credenciales en extract_from_old_system.php
nano extract_from_old_system.php

# Cambiar líneas 19-20:
# 'username' => 'TU_USUARIO_ADMIN',
# 'password' => 'TU_PASSWORD',

# 2. Ejecutar script
php extract_from_old_system.php

# 3. Los CSVs se generan en data/
```

### Opción C: Exportación Manual

Si prefieres exportar manualmente desde el sistema viejo:

1. Ver archivos de ejemplo:
   - `data/socios_export.example.csv`
   - `data/beneficiarios_export.example.csv`
   - `data/ubicaciones_export.example.csv`

2. Exportar datos con el mismo formato
3. Colocar archivos en `data/`

---

## 📥 Paso 3: Importación de Socios

### 3.1. Verificar datos

```bash
# Ver primeras 5 líneas del CSV
head -n 5 data/socios_export.csv

# Contar líneas (debe ser ~9,585)
wc -l data/socios_export.csv
```

### 3.2. Ejecutar importación (DRY RUN primero)

```bash
# Modo prueba (no inserta datos, solo valida)
# Editar 2-import-socios.ts línea 23:
# dryRun: true

npx tsx 2-import-socios.ts

# Revisar logs
tail -f logs/migration_*.log
```

### 3.3. Importación real

```bash
# Cambiar dryRun a false en 2-import-socios.ts
# dryRun: false

# Ejecutar importación
npm run migrate:socios

# IMPORTANTE: El script espera 5 segundos antes de insertar
# Presiona Ctrl+C si quieres cancelar
```

**Tiempo estimado:** 3-5 minutos para 9,585 socios

---

## ✅ Paso 4: Validación

```bash
# Ejecutar validaciones
npm run validate:socios
```

### Validaciones que se ejecutan:

1. ✓ Cantidad de socios (debe ser 9,585)
2. ✓ Cédulas únicas (sin duplicados)
3. ✓ Códigos de socio únicos
4. ✓ Ubicaciones asignadas (todos tienen ubicación)
5. ✓ Estados válidos (activo, suspendido, inactivo, retirado)
6. ✓ Fechas coherentes
7. ✓ Datos de contacto
8. ✓ Integridad referencial

**Resultado esperado:**

```
📋 REPORTE DE VALIDACIÓN
════════════════════════════════════════════
✅ OK: 9 | ⚠️  WARNINGS: 0 | ❌ ERRORS: 0
════════════════════════════════════════════
```

---

## 👥 Paso 5: Importación de Beneficiarios

```bash
# Verificar CSV
head -n 5 data/beneficiarios_export.csv

# Importar beneficiarios
npm run migrate:beneficiarios

# Validar nuevamente
npm run validate:socios
```

---

## 📊 Paso 6: Generar Reporte

```bash
# Generar reporte HTML visual
npm run migration:report
```

Se abre automáticamente en el navegador mostrando:
- Total de socios migrados
- Total de beneficiarios
- Distribución por estado
- Distribución por ubicación
- Validaciones completas

---

## 🚨 En Caso de Error: Rollback

Si algo sale mal durante la migración:

```bash
npm run migrate:rollback
```

**⚠️ ADVERTENCIA:** Esto elimina TODOS los socios y beneficiarios migrados.

El script pide 2 confirmaciones:
1. Escribir "SI" para confirmar
2. Ingresar un número aleatorio de confirmación

---

## 📝 Logs Generados

Todos los logs se guardan en `logs/`:

- `migration_YYYY-MM-DD.log` - Log general
- `migration_beneficiarios_YYYY-MM-DD.log` - Log de beneficiarios
- `errors.log` - Errores críticos
- `migration_report.json` - Reporte en JSON
- `validation_report.json` - Validaciones en JSON
- `migration_report.html` - Reporte visual HTML

---

## ✅ Checklist Final

Antes de dar por completada la migración:

- [ ] **9,585 socios** migrados correctamente
- [ ] **Sin cédulas duplicadas**
- [ ] **Sin códigos de socio duplicados**
- [ ] **Todos tienen ubicación asignada**
- [ ] **Beneficiarios migrados** (máximo 9 por socio)
- [ ] **Fechas coherentes**
- [ ] **Estados válidos**
- [ ] **Reporte HTML generado**
- [ ] **Respaldo de logs guardado**

---

## 🆘 Resolución de Problemas

### Error: "Archivo no encontrado: socios_export.csv"

```bash
# Verificar que el archivo existe
ls -la data/

# Copiar archivo de ejemplo si es primera prueba
cp data/socios_export.example.csv data/socios_export.csv
```

### Error: "Ubicación no encontrada"

```bash
# Primero migrar ubicaciones (si no existen)
# Crear ubicaciones manualmente en sistema nuevo o:
# Ejecutar seed de ubicaciones desde backend:
cd ../../backend
npx prisma db seed
```

### Error: "Cédula duplicada"

El script automáticamente omite cédulas duplicadas y las registra en `logs/errors.log`

```bash
# Ver cédulas duplicadas
grep "Cédula duplicada" logs/migration_*.log
```

### Migración muy lenta (>10 min)

```bash
# Aumentar batch size en 2-import-socios.ts línea 22:
batchSize: 500, // Cambiar de 100 a 500
```

---

## 📞 Contacto

En caso de problemas:
- **PO:** Ing. Katherine Martínez (Cooperativa el Triunfo, R.L)
- **Dev Team:** Revisar logs en `scripts/migracion/logs/`
- **Documentación completa:** [GUIA-MIGRACION.md](../../GUIA-MIGRACION.md)

---

## 🎯 Próximos Pasos

Después de migrar socios exitosamente:

1. ✅ Migrar acuerdos de **Funeraria** (9,282 registros)
2. ✅ Migrar acuerdos de **Salud** (5,614 registros)
3. ✅ Migrar cuentas de **Ahorro** (histórico)
4. ✅ Migrar **Préstamos** ($145K activos)
5. ✅ Migrar **Movimientos de Colecta** (histórico)

Ver [GUIA-MIGRACION.md](../../GUIA-MIGRACION.md) para plan completo de 5 etapas.
