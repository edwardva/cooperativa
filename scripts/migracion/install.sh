#!/bin/bash
# ============================================
# INSTALACIÓN RÁPIDA - Scripts de Migración
# ============================================
# Este script instala las dependencias necesarias
# para ejecutar los scripts de migración
# ============================================

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════"
echo "🔄 INSTALACIÓN: Scripts de Migración"
echo "════════════════════════════════════════════════════════════"
echo ""

# Verificar Node.js
echo "📦 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    echo "   Instalar desde: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION instalado"

# Verificar npm
echo "📦 Verificando npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✓ npm $NPM_VERSION instalado"

# Crear directorios si no existen
echo ""
echo "📁 Creando directorios..."
mkdir -p data logs
echo "✓ Directorios creados"

# Instalar dependencias
echo ""
echo "📦 Instalando dependencias..."
npm install

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ INSTALACIÓN COMPLETADA"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📚 Próximos pasos:"
echo ""
echo "1. Obtener archivos CSV del sistema viejo:"
echo "   - Opción A: Ejecutar 1-extract-socios.sql en BD vieja"
echo "   - Opción B: Ejecutar extract_from_old_system.php"
echo "   - Opción C: Exportación manual"
echo ""
echo "2. Copiar CSVs a data/"
echo "   cp /tmp/socios_export.csv data/"
echo ""
echo "3. Ejecutar migración:"
echo "   npm run migrate:socios"
echo ""
echo "4. Validar migración:"
echo "   npm run validate:socios"
echo ""
echo "5. Generar reporte:"
echo "   npm run migration:report"
echo ""
echo "📄 Ver guía completa en: GUIA-RAPIDA.md"
echo ""
