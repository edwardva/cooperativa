<?php
/**
 * Script mejorado para descargar TODOS los reportes posibles de funeraria
 * Intenta múltiples patrones de URL y parámetros
 */

// Configuración
$baseUrl = 'https://cooptriunfo.org/sistemas/administrativo';
$username = 'caja1';
$password = '9277864';
$outputDir = __DIR__ . '/data/funeraria/reportes_extras';

// Crear directorio de salida
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0755, true);
}

// Cookie temporal
$cookieFile = tempnam(sys_get_temp_dir(), 'cookie_');

echo "\n=== Intentando descargar TODOS los reportes de Funeraria ===\n\n";

/**
 * Login y obtener cookie de sesión
 */
function login($baseUrl, $username, $password, $cookieFile) {
    $loginUrl = "$baseUrl/checklogin.php";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $loginUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'username' => $username,
        'password' => $password
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    // curl_close($ch);
    
    if ($httpCode == 200) {
        echo "✅ Login exitoso\n\n";
        return true;
    } else {
        echo "❌ Login falló (HTTP $httpCode)\n";
        return false;
    }
}

/**
 * Descargar reporte
 */
function downloadReport($url, $outputPath, $cookieFile, $postData = null) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    
    if ($postData) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    }
    
    $content = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentLength = strlen($content);
    // curl_close($ch);
    
    if ($httpCode == 200 && $contentLength > 100) {
        file_put_contents($outputPath, $content);
        return [
            'success' => true,
            'size' => $contentLength,
            'code' => $httpCode
        ];
    }
    
    return [
        'success' => false,
        'size' => $contentLength,
        'code' => $httpCode
    ];
}

// Login
if (!login($baseUrl, $username, $password, $cookieFile)) {
    exit(1);
}

// Array EXPANDIDO de reportes a intentar
$reportesToTry = [
    // Reportes en /funeraria/reportes/
    'funeraria/reportes/rep_acuerdos.php' => 'acuerdos_todos.pdf',
    'funeraria/reportes/rep_acuerdos.xls' => 'acuerdos_todos.xls',
    'funeraria/reportes/rep_activos.php' => 'acuerdos_activos.pdf',
    'funeraria/reportes/rep_activos.xls' => 'acuerdos_activos.xls',
    'funeraria/reportes/rep_listado.php' => 'listado_acuerdos.pdf',
    'funeraria/reportes/rep_listado.xls' => 'listado_acuerdos.xls',
    'funeraria/reportes/rep_todos.php' => 'todos_acuerdos.pdf',
    'funeraria/reportes/rep_funeraria.php' => 'funeraria_general.pdf',
    'funeraria/reportes/rep_general.php' => 'general.pdf',
    'funeraria/reportes/rep_completo.php' => 'completo.pdf',
    
    // Reportes en /funeraria/
    'funeraria/rep_acuerdos.php' => 'acuerdos_root.pdf',
    'funeraria/reporte_acuerdos.php' => 'reporte_acuerdos.pdf',
    'funeraria/reportes.php' => 'reportes.pdf',
    
    // Reportes en /rep_funeraria/
    'rep_funeraria/rep_acuerdos.php' => 'rep_folder_acuerdos.pdf',
    'rep_funeraria/rep_activos.php' => 'rep_folder_activos.pdf',
    'rep_funeraria/rep_listado.php' => 'rep_folder_listado.pdf',
];

// Intentar con parámetros comunes
$parametrosComunes = [
    [],
    ['tipo' => 'activos'],
    ['tipo' => 'todos'],
    ['estado' => 'A'],
    ['estado' => 'ACTIVO'],
    ['retirado' => 'No'],
    ['suspendido' => 'No'],
];

$exitosos = 0;
$fallidos = 0;

echo "Intentando " . count($reportesToTry) . " URLs diferentes...\n\n";

foreach ($reportesToTry as $relativeUrl => $filename) {
    $fullUrl = "$baseUrl/$relativeUrl";
    $outputPath = "$outputDir/$filename";
    
    echo "Probando: $relativeUrl";
    
    // Probar sin parámetros primero
    $result = downloadReport($fullUrl, $outputPath, $cookieFile);
    
    if ($result['success']) {
        echo " ✅ ÉXITO! (" . round($result['size']/1024, 2) . " KB)\n";
        $exitosos++;
        continue;
    }
    
    // Si falla, probar con parámetros
    $parametroExitoso = false;
    foreach ($parametrosComunes as $parametros) {
        if (empty($parametros)) continue;
        
        $paramStr = http_build_query($parametros);
        $fullUrlParam = "$fullUrl?$paramStr";
        $result = downloadReport($fullUrlParam, $outputPath, $cookieFile);
        
        if ($result['success']) {
            echo " ✅ ÉXITO con parámetros! ($paramStr) (" . round($result['size']/1024, 2) . " KB)\n";
            $exitosos++;
            $parametroExitoso = true;
            break;
        }
    }
    
    if (!$parametroExitoso) {
        echo " ❌ Falló (HTTP {$result['code']}, {$result['size']} bytes)\n";
        $fallidos++;
    }
}

// Limpiar
unlink($cookieFile);

echo "\n=== Resumen ===\n";
echo "Exitosos: $exitosos\n";
echo "Fallidos: $fallidos\n";
echo "\nArchivos guardados en: $outputDir\n";

if ($exitosos > 0) {
    echo "\n✅ ¡Se encontraron $exitosos reportes adicionales!\n";
    echo "Ahora revisa los PDFs descargados para parsear los datos.\n";
} else {
    echo "\n⚠️  No se encontraron reportes adicionales.\n";
    echo "Puede que necesites acceso directo a la base de datos.\n";
}

?>
