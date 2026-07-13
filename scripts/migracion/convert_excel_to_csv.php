<?php
/**
 * ============================================
 * CONVERTIR EXCEL A CSV
 * ============================================
 * Convierte el reporte Excel descargado a CSV
 * para poder importarlo con el script TypeScript
 * 
 * PREREQUISITO:
 * composer require phpoffice/phpspreadsheet
 * 
 * O instalar manualmente:
 * https://github.com/PHPOffice/PhpSpreadsheet
 * 
 * EJECUCIÓN:
 * php convert_excel_to_csv.php socios_report_2026-07-12_051111.xls
 * ============================================
 */

// Verificar que se pasó el archivo
if ($argc < 2) {
    echo "❌ Error: Debe especificar el archivo Excel\n\n";
    echo "Uso: php convert_excel_to_csv.php <archivo.xls>\n\n";
    echo "Ejemplo:\n";
    echo "  php convert_excel_to_csv.php data/socios_report_2026-07-12_051111.xls\n\n";
    exit(1);
}

$inputFile = $argv[1];

// Verificar que el archivo existe
if (!file_exists($inputFile)) {
    echo "❌ Error: Archivo no encontrado: $inputFile\n\n";
    exit(1);
}

// Verificar si PhpSpreadsheet está instalado
if (!class_exists('PhpOffice\PhpSpreadsheet\IOFactory')) {
    echo "════════════════════════════════════════════\n";
    echo "⚠️  PhpSpreadsheet NO está instalado\n";
    echo "════════════════════════════════════════════\n\n";
    echo "OPCIÓN 1: Instalar con Composer\n";
    echo "  composer require phpoffice/phpspreadsheet\n\n";
    echo "OPCIÓN 2: Manual (más fácil)\n";
    echo "  1. Abrir el archivo Excel en LibreOffice/Excel\n";
    echo "  2. Guardar como CSV (UTF-8)\n";
    echo "  3. Copiar a: data/socios_export.csv\n\n";
    echo "OPCIÓN 3: Usar 'ssconvert' (si está instalado)\n";
    echo "  ssconvert $inputFile data/socios_export.csv\n\n";
    exit(1);
}

echo "════════════════════════════════════════════\n";
echo "CONVERSIÓN EXCEL → CSV\n";
echo "════════════════════════════════════════════\n\n";

try {
    require 'vendor/autoload.php';
    
    use PhpOffice\PhpSpreadsheet\IOFactory;
    
    echo "📂 Leyendo archivo: $inputFile\n";
    
    $spreadsheet = IOFactory::load($inputFile);
    $worksheet = $spreadsheet->getActiveSheet();
    
    $outputFile = dirname($inputFile) . '/socios_export.csv';
    
    echo "💾 Guardando como CSV: $outputFile\n";
    
    $writer = IOFactory::createWriter($spreadsheet, 'Csv');
    $writer->setDelimiter(',');
    $writer->setEnclosure('"');
    $writer->setLineEnding("\n");
    $writer->setSheetIndex(0);
    $writer->save($outputFile);
    
    echo "✓ Conversión completada\n\n";
    
    echo "════════════════════════════════════════════\n";
    echo "✓ ÉXITO\n";
    echo "════════════════════════════════════════════\n";
    echo "\nPróximo paso:\n";
    echo "  npm run migrate:socios\n\n";
    
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n\n";
    exit(1);
}
