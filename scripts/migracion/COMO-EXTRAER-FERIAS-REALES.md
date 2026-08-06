# 🎯 Guía Rápida: Extracción de Ferias del Sistema Viejo

## ❓ ¿Por qué necesitamos esto?

Los CSVs exportados de socios **NO incluyen el código de ubicación**. Necesitamos:
1. Extraer las ferias del sistema viejo
2. Migrarlas a la nueva base de datos
3. Asignar cada socio a su feria correspondiente

---

## 📋 Método 1: Desde la Consola del Navegador (RÁPIDO)

### Paso 1: Abrir el sistema viejo

1. Abre el sistema viejo en Chrome/Firefox
2. Inicia sesión
3. Ve a: **Asociados → Modificar** (cualquier socio)

### Paso 2: Ejecutar el script extractor

1. Presiona **F12** para abrir DevTools
2. Ve a la pestaña **Console**
3. Copia y pega el contenido de: `extract-ubicaciones-desde-web.js`
4. Presiona **Enter**

El script:
- ✅ Buscará el dropdown de ubicaciones automáticamente
- ✅ Extraerá todas las opciones
- ✅ Generará el CSV
- ✅ Lo copiará al portapapeles
- ✅ Lo descargará como archivo

### Paso 3: Guardar el CSV

Guarda el archivo descargado como:
```
scripts/migracion/data/ubicaciones_reales_extraidas.csv
```

---

## 📋 Método 2: Extracción Manual (SEGURO)

Si el script automático no funciona:

### Paso 1: Ver las ferias disponibles

En el sistema viejo, busca el módulo de ferias en:
- **Asociados → Ferias**
- **Maestros → Ubicaciones**  
- **Catálogos → Sucursales**
- **Asociados → Modificar** (campo "Ubicación")

### Paso 2: Anotar todas las ferias

Anota en un papel:
- Código de la feria (ej: `FER-01`, `CENTRO`, `001`)
- Nombre de la feria (ej: `Feria Central`)

### Paso 3: Crear el CSV

Ejecuta en la terminal:
```bash
cd /Users/new/DesarrollosLocal/cooperativa/scripts/migracion/data
nano ubicaciones_reales_extraidas.csv
```

Escribe en este formato:
```csv
codigo,nombre,direccion,telefono,email,estado
FER-01,Feria Central,Calle Principal 123,0212-1234567,feria.centro@coop.org,1
FER-02,Feria Este,Av. Este 456,0212-7654321,feria.este@coop.org,1
FER-03,Feria Oeste,Sector Oeste,0212-9999999,feria.oeste@coop.org,1
```

**Importante:**
- **codigo**: Máximo 10 caracteres
- **estado**: 1 = activa, 0 = inactiva
- Si no tienes dirección/teléfono/email, deja vacío: `,,`

---

## 🚀 Migración de las Ferias

Una vez tengas el CSV con las ferias reales:

### Opción A: Ya tienes el CSV

```bash
cd /Users/new/DesarrollosLocal/cooperativa/scripts/migracion

# Renombrar el archivo
mv data/ubicaciones_reales_extraidas.csv data/ubicaciones_export.csv

# Migrar a la base de datos
npm run migrate:ubicaciones
```

### Opción B: Dame las ferias y yo creo el archivo

Responde con una lista como esta:

```
Código: FER-CENT | Nombre: Feria Central
Código: FER-ESTE | Nombre: Feria Este  
Código: FER-OSTE | Nombre: Feria Oeste
Código: FER-NORT | Nombre: Feria Norte
Código: FER-SUR | Nombre: Feria Sur
```

Y yo crearé el CSV y lo migraré automáticamente.

---

## 🔗 Asignar Ferias a Socios

Después de migrar las ferias, necesitamos asignar cada socio a su feria.

### Opción 1: Asignar una feria por defecto a todos

```sql
-- Asignar todos los socios a la feria principal
UPDATE socios 
SET ubicacion_id = (SELECT id FROM ubicaciones WHERE codigo = 'FER-PRIN' LIMIT 1)
WHERE ubicacion_id IS NULL;
```

### Opción 2: Asignar ferias según criterio

Si en el sistema viejo hay una forma de saber a qué feria pertenece cada socio:

**Ejemplo: Por código de socio**
```sql
-- Si el código empieza con 01 → Feria Centro
UPDATE socios SET ubicacion_id = 1 WHERE codigo_socio LIKE '01-%';
-- Si el código empieza con 02 → Feria Este  
UPDATE socios SET ubicacion_id = 2 WHERE codigo_socio LIKE '02-%';
```

**Ejemplo: Por rango de cédula**
```sql
-- Cédulas < 10M → Feria Central
UPDATE socios SET ubicacion_id = 1 WHERE CAST(cedula AS BIGINT) < 10000000;
```

### Opción 3: Importar desde archivo adicional

Si puedes exportar del sistema viejo un CSV con:
```csv
cedula,ubicacion_codigo
12345678,FER-CENT
87654321,FER-ESTE
```

Crearemos un script para actualizar masivamente.

---

## ❓ ¿Qué método prefieres?

1. **Ejecutar script en navegador** (extract-ubicaciones-desde-web.js)
2. **Darme la lista de ferias** y yo creo todo
3. **Crear el CSV manualmente** y luego migrar

¿Cuál método quieres usar? 🎯
