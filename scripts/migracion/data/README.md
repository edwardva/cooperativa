# Scripts de Migración

Este directorio contiene los datos exportados del sistema antiguo.

## Archivos Esperados

- `socios_export.csv` - Datos de socios (9,585 registros)
- `beneficiarios_export.csv` - Datos de beneficiarios
- `ubicaciones_export.csv` - Datos de ubicaciones/ferias

## Formato CSV Esperado

### socios_export.csv
```csv
codigo_socio,cedula,apellido,nombre,fecha_ingreso,fecha_nacimiento,direccion,telefono,email,estado,autorizado_nombre,autorizado_cedula,ubicacion_codigo,es_delegado,notas,fecha_retiro,motivo_retiro
```

### beneficiarios_export.csv
```csv
socio_codigo_socio,cedula,nombre,apellido,fecha_nacimiento,parentesco,telefono,direccion,porcentaje,estado
```

### ubicaciones_export.csv
```csv
codigo,nombre,direccion,telefono,email,estado
```

## Cómo Obtener los Archivos

1. **Opción A:** Ejecutar `1-extract-socios.sql` en la base de datos vieja
2. **Opción B:** Ejecutar `extract_from_old_system.php` (web scraping)
3. **Opción C:** Exportación manual desde el sistema viejo

## Notas

- Los archivos deben tener cabecera (header row)
- Usar encoding UTF-8
- Fechas en formato: YYYY-MM-DD
- No incluir este directorio en git (está en .gitignore)
