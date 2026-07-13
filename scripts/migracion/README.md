# Scripts de Migración - Cooperativa el Triunfo

**Objetivo:** Migrar 9,585 socios del sistema PHP antiguo al nuevo sistema React + Node.js + PostgreSQL

---

## 📋 Índice

1. [Preparación](#preparación)
2. [Orden de Ejecución](#orden-de-ejecución)
3. [Scripts Disponibles](#scripts-disponibles)
4. [Validación](#validación)

---

## 🎯 Preparación

### 1. Acceso a Base de Datos Antigua

**Opción A: Exportación SQL**
```bash
# Desde el servidor viejo, exportar socios
pg_dump -h localhost -U usuario -d cooperativa_vieja \
  -t socios -t beneficiarios -t ubicaciones \
  --data-only --column-inserts \
  > export_socios.sql
```

**Opción B: Exportación a CSV**
```bash
# En el servidor viejo
psql -h localhost -U usuario -d cooperativa_vieja -c \
  "COPY (SELECT * FROM socios) TO STDOUT CSV HEADER" \
  > socios.csv
```

**Opción C: Script de Extracción PHP** (si no hay acceso directo a BD)
- Ver `extract_from_old_system.php`
- Genera JSON con los datos

### 2. Colocar Archivos en `/scripts/migracion/data/`

```
scripts/migracion/data/
  ├── socios.csv          # Datos de socios
  ├── beneficiarios.csv   # Datos de beneficiarios
  └── ubicaciones.csv     # Datos de ubicaciones/ferias
```

---

## 🔄 Orden de Ejecución

### Fase 1: Migración de Catálogos
```bash
# 1. Ubicaciones/Ferias (si no existen)
npm run migrate:ubicaciones

# 2. Validar ubicaciones
npm run validate:ubicaciones
```

### Fase 2: Migración de Socios
```bash
# 1. Migrar socios principales
npm run migrate:socios

# 2. Validar socios
npm run validate:socios

# 3. Migrar beneficiarios
npm run migrate:beneficiarios

# 4. Validar beneficiarios
npm run validate:beneficiarios
```

### Fase 3: Verificación Final
```bash
# Reporte completo de migración
npm run migration:report
```

---

## 📂 Scripts Disponibles

### `1-extract-socios.sql`
Extrae socios del sistema viejo (para ejecutar en BD antigua)

### `2-import-socios.ts`
Importa socios desde CSV/JSON al nuevo sistema

### `3-validate-socios.ts`
Valida integridad de datos migrados

### `4-rollback-socios.ts`
Rollback en caso de error (elimina datos migrados)

### `extract_from_old_system.php`
Extrae datos del sistema viejo vía web scraping (última opción)

---

## ✅ Validación

### Checklist de Validación

- [ ] **Cantidad de socios:** 9,585 en sistema viejo = 9,585 en sistema nuevo
- [ ] **Cédulas únicas:** Sin duplicados
- [ ] **Códigos de socio únicos:** Sin duplicados
- [ ] **Ubicaciones válidas:** Todos los socios tienen ubicación asignada
- [ ] **Beneficiarios:** Máximo 9 por socio
- [ ] **Fechas válidas:** fecha_ingreso, fecha_nacimiento coherentes
- [ ] **Estados válidos:** activo, suspendido, inactivo, retirado
- [ ] **Teléfonos/emails:** Formatos válidos

### Reportes Generados

1. `migration_report.json` - Resumen general
2. `errors.log` - Errores durante migración
3. `warnings.log` - Advertencias (datos opcionales faltantes)
4. `duplicates.csv` - Cédulas/códigos duplicados detectados

---

## 🚨 Rollback

Si algo sale mal:

```bash
# Rollback completo (elimina todos los datos migrados)
npm run migrate:rollback

# O manualmente:
cd backend
npx prisma db seed  # Restaurar datos de prueba
```

---

## 📞 Contacto

En caso de problemas durante la migración:
- **PO:** Ing. Katherine Martínez (Cooperativa el Triunfo)
- **Dev Team:** Revisar logs en `scripts/migracion/logs/`
