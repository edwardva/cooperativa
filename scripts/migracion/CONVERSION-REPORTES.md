# Conversión de Reportes

## 🎯 Problema
El sistema viejo genera reportes en formato Excel (.xls). Necesitamos convertirlos a CSV para importarlos.

## 💡 Soluciones

### Opción 1: Manual (MÁS FÁCIL) ⭐

1. Abrir el archivo `.xls` en LibreOffice Calc o Microsoft Excel
2. Ir a **Archivo → Guardar Como**
3. Seleccionar formato: **CSV (UTF-8)**
4. Guardar como: `socios_export.csv`
5. Copiar a la carpeta `data/`

### Opción 2: Línea de Comandos (si tienes LibreOffice)

```bash
# macOS/Linux
libreoffice --headless --convert-to csv:"Text - txt - csv (StarCalc)":44,34,76 --outdir data data/socios_report_*.xls

# O con ssconvert (si está instalado)
ssconvert data/socios_report_*.xls data/socios_export.csv
```

### Opción 3: Script PHP (requiere librerías)

```bash
# Instalar PhpSpreadsheet (si tienes composer)
composer require phpoffice/phpspreadsheet

# Ejecutar conversión
php convert_excel_to_csv.php data/socios_report_2026-07-12_051111.xls
```

## 📊 Estructura Esperada del CSV

El CSV debe tener las siguientes columnas (revisar con los archivos `.example.csv`):

```csv
codigo_socio,cedula,apellido,nombre,fecha_ingreso,ubicacion_codigo,estado,telefono,email,delegado,autorizado_nombre,autorizado_cedula
```

## 🔄 Una vez convertido

```bash
# Verificar que el archivo está en data/
ls -lh data/socios_export.csv

# Ejecutar importación
npm run migrate:socios
```

## 🆘 Problemas Comunes

### "El CSV tiene columnas incorrectas"
→ Revisar que el Excel tiene los headers correctos
→ Comparar con `data/socios_export.example.csv`

### "Encoding incorrecto (caracteres raros)"
→ Al guardar CSV, seleccionar **UTF-8**
→ No usar "CSV Windows" (usa Windows-1252)

### "Fechas en formato incorrecto"
→ Formato esperado: `DD/MM/YYYY`
→ Ejemplo: `22/09/2000`

---

**Recomendación:** La **Opción 1 (Manual)** es la más confiable y rápida. Toma menos de 2 minutos.
