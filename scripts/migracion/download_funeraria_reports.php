<?php
/**
 * Script para descargar reportes PDF de Funeraria del sistema viejo
 * Sistema: https://cooptriunfo.org/sistemas/administrativo/
 */

error_reporting(E_ALL & ~E_STRICT);

// Configuración
$baseUrl = 'https://cooptriunfo.org/sistemas/administrativo';
$username = 'caja1';
$password = '9277864';

// Directorio para guardar los reportes
$outputDir = __DIR__ . '/data/funeraria';
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0755, true);
}

/**
 * Realiza login y retorna el cookie handler
 */
function login($baseUrl, $username, $password) {
    $loginUrl = "$baseUrl/checklogin.php";
    
    $postData = http_build_query([
        'username' => $username,
        'password' => $password
    ]);
    
    $cookieFile = tempnam(sys_get_temp_dir(), 'cookie_');
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $loginUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    // curl_close($ch); // Comentado por deprecation en PHP 8.5
    
    $loginData = json_decode($response, true);
    
    if ($curlError) {
        echo "  CURL Error: $curlError\n";
        return false;
    }
    
    if ($httpCode === 200 && $loginData && !isset($loginData['errorMsg'])) {
        return $cookieFile;
    }
    
    if (isset($loginData['errorMsg'])) {
        echo "  Error: {$loginData['errorMsg']}\n";
    }
    
    return false;
}

/**
 * Descarga un reporte usando la sesión autenticada
 */
function downloadReport($url, $outputPath, $cookieFile) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    
    $data = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    // curl_close($ch); // Comentado por deprecation en PHP 8.5
    
    if ($httpCode === 200 && $data) {
        file_put_contents($outputPath, $data);
        return strlen($data);
    }
    
    return false;
}

echo "\n=== Descarga de Reportes de Funeraria ===\n\n";

// 1. Login
echo "1. Iniciando sesión...\n";
$cookieFile = login($baseUrl, $username, $password);

if (!$cookieFile) {
    echo "❌ Error en login: Desconocido\n";
    exit(1);
}

echo "✅ Login exitoso\n\n";

// 2. Intentar diferentes endpoints de reportes
echo "2. Buscando reportes de funeraria...\n";

$reportUrls = [
    // Ya descargamos suspendidos exitosamente
    [
        'url' => "$baseUrl/funeraria/reportes/rep_suspendidos.php",
        'filename' => 'acuerdos_suspendidos.pdf',
        'description' => 'Acuerdos Suspendidos'
    ],
    // Probar nombres más generales para TODOS los acuerdos
    [
        'url' => "$baseUrl/funeraria/reportes/rep_acuerdos_funeraria.php",
        'filename' => 'acuerdos_todos_v1.pdf',
        'description' => 'Todos Acuerdos v1'
    ],
    [
        'url' => "$baseUrl/funeraria/reportes/rep_listado.php",
        'filename' => 'listado_general.pdf',
        'description' => 'Listado General'
    ],
    [
        'url' => "$baseUrl/funeraria/reportes/rep_todos.php",
        'filename' => 'todos_acuerdos.pdf',
        'description' => 'Todos'
    ],
    [
        'url' => "$baseUrl/funeraria/reportes/rep_funeraria.php",
        'filename' => 'funeraria_general.pdf',
        'description' => 'Funeraria General'
    ],
    // Probar con parámetros como hicimos en ahorro
    [
        'url' => "$baseUrl/funeraria/reportes/rep_acuerdos.php?estado=activo",
        'filename' => 'acuerdos_activos_param.pdf',
        'description' => 'Activos con parámetro'
    ],
    [
        'url' => "$baseUrl/funeraria/reportes/rep_acuerdos.php?estado=todos",
        'filename' => 'acuerdos_todos_param.pdf',
        'description' => 'Todos con parámetro'
    ],
    // Probar xls
    [
        'url' => "$baseUrl/funeraria/reportes/rep_acuerdos_funeraria.xls",
        'filename' => 'acuerdos_funeraria.xls',
        'description' => 'Acuerdos XLS'
    ],
];

$downloaded = 0;
$totalSize = 0;

foreach ($reportUrls as $report) {
    echo "  - Descargando {$report['description']}... ";
    
    $outputPath = $outputDir . '/' . $report['filename'];
    $size = downloadReport($report['url'], $outputPath, $cookieFile);
    
    if ($size && $size > 1000) { // Si es mayor a 1KB, probablemente sea válido
        echo "✅ ($size bytes)\n";
        $downloaded++;
        $totalSize += $size;
    } else {
        echo "❌ (no disponible o vacío)\n";
        if (file_exists($outputPath)) {
            unlink($outputPath);
        }
    }
}

// 3. Resumen
echo "\n=== Resumen ===\n";
echo "Total descargados: $downloaded/" . count($reportUrls) . "\n";

if ($downloaded > 0) {
    echo "\n✅ Descarga completada!\n";
    echo "Archivos guardados en: $outputDir\n";
    echo "Tamaño total: " . round($totalSize / 1024 / 1024, 2) . " MB\n";
} else {
    echo "\n⚠️  No se pudo descargar ningún reporte.\n";
    echo "Esto puede indicar que:\n";
    echo "  1. Los reportes están en una ruta diferente\n";
    echo "  2. Se necesitan parámetros adicionales\n";
    echo "  3. El sistema usa AJAX para generar reportes\n";
    echo "\nRevisemos la interfaz web para encontrar la ruta correcta.\n";
}

// Limpiar
unlink($cookieFile);
