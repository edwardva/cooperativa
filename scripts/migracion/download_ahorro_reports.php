<?php
/**
 * Script para descargar todos los reportes de ahorro del sistema viejo
 * Descarga PDF de saldos por tipo de cuenta
 */

error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);

// Configuración
$baseUrl = 'https://cooptriunfo.org/sistemas/administrativo';
$username = 'caja1';
$password = '9277864';
$outputDir = __DIR__ . '/data/ahorro';

// Crear directorio si no existe
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0755, true);
}

// Tipos de cuenta de ahorro (según lo visto en el menú)
$tiposCuenta = [
    '01' => 'CUENTA_A_LA_VISTA',
    '02' => 'CUENTA_INFANTIL',
    '03' => 'CUENTA_NAVIDENA',
    '04' => 'PLAZO_FIJO_60_DIAS',
    '05' => 'PLAZO_FIJO_90_DIAS',
    '06' => 'CUENTA_FIDEICOMISO',
    '07' => 'MULTAS',
    '08' => 'INSCRIP_CARNET',
    '09' => 'REINT_FUN',
    '10' => 'REINT_SALUD',
    '11' => 'APORTE_CICS',
    '12' => 'AHORRO_DIVISAS',
    '13' => 'FONDO_INTEGRADO',
];

echo "=== Descarga de Reportes de Ahorro ===\n\n";

// Iniciar sesión
echo "1. Iniciando sesión...\n";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "$baseUrl/checklogin.php");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'username' => $username,
    'password' => $password
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_COOKIEJAR, '/tmp/cookies_ahorro.txt');
curl_setopt($ch, CURLOPT_COOKIEFILE, '/tmp/cookies_ahorro.txt');
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$loginResponse = curl_exec($ch);
$loginData = json_decode($loginResponse, true);

if (!$loginData || isset($loginData['errorMsg'])) {
    die("❌ Error en login: " . ($loginData['errorMsg'] ?? 'Desconocido') . "\n");
}

echo "✅ Login exitoso\n\n";

// Descargar reportes por tipo de cuenta
echo "2. Descargando reportes de saldos de ahorro...\n";
$totalDescargados = 0;
$errores = [];

foreach ($tiposCuenta as $codigo => $nombre) {
    $reportUrl = "$baseUrl/rep_ahorro/rep_saldo_ahorros.php?COD=$codigo";
    $outputFile = "$outputDir/saldos_ahorro_$nombre.pdf";
    
    echo "  - Descargando $nombre (COD=$codigo)... ";
    
    curl_setopt($ch, CURLOPT_URL, $reportUrl);
    curl_setopt($ch, CURLOPT_POST, false);
    curl_setopt($ch, CURLOPT_HTTPGET, true);
    
    $pdfContent = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if ($httpCode == 200 && !empty($pdfContent)) {
        // Verificar que realmente es un PDF
        if (substr($pdfContent, 0, 4) === '%PDF') {
            file_put_contents($outputFile, $pdfContent);
            $fileSize = filesize($outputFile);
            echo "✅ ($fileSize bytes)\n";
            $totalDescargados++;
        } else {
            echo "⚠️  No es un PDF válido o sin datos\n";
            $errores[] = "$nombre: Respuesta no es PDF";
        }
    } else {
        echo "❌ Error HTTP $httpCode\n";
        $errores[] = "$nombre: HTTP $httpCode";
    }
    
    // Pequeña pausa para no saturar el servidor
    usleep(500000); // 0.5 segundos
}

// curl_close($ch);

echo "\n=== Resumen ===\n";
echo "Total descargados: $totalDescargados/" . count($tiposCuenta) . "\n";

if (!empty($errores)) {
    echo "\nErrores encontrados:\n";
    foreach ($errores as $error) {
        echo "  - $error\n";
    }
}

// Verificar también si hay un reporte consolidado
echo "\n3. Intentando descargar reporte consolidado (todos los tipos)...\n";
$reportConsolidado = "$baseUrl/rep_ahorro/rep_saldo_ahorros.php";
$outputConsolidado = "$outputDir/saldos_ahorro_TODOS.pdf";

curl_setopt($ch, CURLOPT_URL, $reportConsolidado);
$pdfContent = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($httpCode == 200 && !empty($pdfContent) && substr($pdfContent, 0, 4) === '%PDF') {
    file_put_contents($outputConsolidado, $pdfContent);
    $fileSize = filesize($outputConsolidado);
    echo "✅ Reporte consolidado descargado ($fileSize bytes)\n";
} else {
    echo "⚠️  No hay reporte consolidado disponible\n";
}

echo "\n✅ Descarga completada!\n";
echo "Archivos guardados en: $outputDir/\n";

// Mostrar tamaño total
$totalSize = 0;
$files = glob("$outputDir/*.pdf");
foreach ($files as $file) {
    $totalSize += filesize($file);
}
echo "Tamaño total: " . number_format($totalSize / 1024 / 1024, 2) . " MB\n";
