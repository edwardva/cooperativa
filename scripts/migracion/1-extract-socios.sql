-- ============================================
-- SCRIPT DE EXTRACCIÓN: SOCIOS
-- ============================================
-- Este script debe ejecutarse en la BASE DE DATOS VIEJA
-- para exportar los socios al sistema nuevo
--
-- IMPORTANTE: Ajustar nombres de tablas y campos según
-- la estructura real de la BD antigua
-- ============================================

-- 1. EXPORTAR UBICACIONES/FERIAS
-- ============================================
\copy (
  SELECT 
    codigo,
    nombre,
    direccion,
    telefono,
    email,
    activo AS estado
  FROM ubicaciones
  WHERE activo = TRUE
  ORDER BY codigo
) TO '/tmp/ubicaciones_export.csv' WITH CSV HEADER;


-- 2. EXPORTAR SOCIOS PRINCIPALES
-- ============================================
\copy (
  SELECT 
    expediente AS codigo_socio,
    cedula,
    TRIM(apellido) AS apellido,
    TRIM(nombre) AS nombre,
    fecha_ingreso,
    fecha_nacimiento,
    direccion,
    telefono,
    email,
    CASE 
      WHEN estado = 'activo' THEN 'activo'
      WHEN estado = 'suspendido' THEN 'suspendido'
      WHEN estado = 'inactivo' THEN 'inactivo'
      WHEN estado = 'retirado' THEN 'retirado'
      ELSE 'activo'
    END AS estado,
    autorizado_nombre,
    autorizado_cedula,
    ubicacion_codigo,
    es_delegado,
    notas,
    fecha_retiro,
    motivo_retiro
  FROM socios
  WHERE eliminado = FALSE OR eliminado IS NULL
  ORDER BY expediente
) TO '/tmp/socios_export.csv' WITH CSV HEADER;


-- 3. EXPORTAR BENEFICIARIOS
-- ============================================
\copy (
  SELECT 
    socio_expediente AS socio_codigo_socio,
    cedula,
    TRIM(nombre) AS nombre,
    TRIM(apellido) AS apellido,
    fecha_nacimiento,
    parentesco,
    telefono,
    direccion,
    porcentaje,
    activo AS estado
  FROM beneficiarios
  WHERE activo = TRUE OR activo IS NULL
  ORDER BY socio_expediente, nombre
) TO '/tmp/beneficiarios_export.csv' WITH CSV HEADER;


-- ============================================
-- VALIDACIONES ANTES DE EXPORTAR
-- ============================================

-- Contar registros a exportar
SELECT 'Total Ubicaciones' AS tabla, COUNT(*) AS total FROM ubicaciones WHERE activo = TRUE
UNION ALL
SELECT 'Total Socios', COUNT(*) FROM socios WHERE eliminado = FALSE OR eliminado IS NULL
UNION ALL
SELECT 'Total Beneficiarios', COUNT(*) FROM beneficiarios WHERE activo = TRUE OR activo IS NULL;


-- Detectar cédulas duplicadas en socios
SELECT 
  'ADVERTENCIA: Cédulas duplicadas en socios' AS alerta,
  cedula,
  COUNT(*) AS cantidad
FROM socios
WHERE eliminado = FALSE OR eliminado IS NULL
GROUP BY cedula
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;


-- Detectar códigos de expediente duplicados
SELECT 
  'ADVERTENCIA: Códigos de expediente duplicados' AS alerta,
  expediente,
  COUNT(*) AS cantidad
FROM socios
WHERE eliminado = FALSE OR eliminado IS NULL
GROUP BY expediente
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;


-- Socios sin ubicación
SELECT 
  'ADVERTENCIA: Socios sin ubicación asignada' AS alerta,
  COUNT(*) AS cantidad
FROM socios
WHERE (ubicacion_codigo IS NULL OR ubicacion_codigo = '')
  AND (eliminado = FALSE OR eliminado IS NULL);


-- Socios con más de 9 beneficiarios
SELECT 
  'ADVERTENCIA: Socios con más de 9 beneficiarios' AS alerta,
  socio_expediente,
  COUNT(*) AS cantidad_beneficiarios
FROM beneficiarios
WHERE activo = TRUE OR activo IS NULL
GROUP BY socio_expediente
HAVING COUNT(*) > 9
ORDER BY cantidad_beneficiarios DESC;


-- ============================================
-- NOTAS:
-- ============================================
-- 1. Los archivos CSV se generan en /tmp/
-- 2. Copiar estos archivos a: scripts/migracion/data/
-- 3. Ejecutar el script de importación en el nuevo sistema
-- 4. Revisar advertencias antes de migrar
-- ============================================
