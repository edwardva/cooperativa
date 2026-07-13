<?php
/**
 * Descargar reportes de socios ACTIVOS e INACTIVOS del sistema viejo
 * Para obtener los 18,149 socios completos
 */

class HttpClient {
    private $cookies = [];
    
    public function post($url, $data) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        
        $response = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $headers = substr($response, 0, $headerSize);
        $body = substr($response, $headerSize);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        // Extraer cookies
        preg_match_all('/Set-Cookie:\s*([^;]+)/', $headers, $matches);
        foreach ($matches[1] as $cookie) {
            $this->cookies[] = $cookie;
        }
        
        return ['code' => $code, 'body' => $body, 'headers' => $headers];
    }
    
    public function get($url) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        
        if (!empty($this->cookies)) {
            curl_setopt($ch, CURLOPT_COOKIE, implode('; ', $this->cookies));
        }
        
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        return ['code' => $code, 'body' => $body];
    }
}

function login(HttpClient $client, $config) {
    echo "🔐 Iniciando sesión...\n";
    
    $loginUrl = $config['base_url'] . '/checklogin.php';
    $response = $client->post($loginUrl, [
        'username' => $config['username'],
        'password' => $config['password'],
    ]);
    
    $jsonData = json_decode($response['body'], true);
    if (isset($jsonData['errorMsg'])) {
        throw new Exception('Error en login: ' . $jsonData['errorMsg']);
    }
    
    echo "✓ Sesión iniciada correctamente\n\n";
}

function downloadReport(HttpClient $client, $config, $reportType, $outputFile) {
    echo "📥 Descargando reporte de socios $reportType...\n";
    
    // URLs de los diferentes reportes
    $reportUrls = [
        'activos' => '/rep_ahorro/rep_socios.php',
        'inactivos' => '/rep_ahorro/rep_socios_inactivos.php',
    ];
    
    if (!isset($reportUrls[$reportType])) {
        throw new Exception("Tipo de reporte desconocido: $reportType");
    }
    
    $reportUrl = $config['base_url'] . $reportUrls[$reportType] . '?excel=1';
    echo "  URL: $reportUrl\n";
    
    $response = $client->get($reportUrl);
    
    if ($response['code'] !== 200) {
        throw new Exception("Error HTTP {$response['code']} al descargar reporte");
    }
    
    // Guardar archivo
    $outputPath = $config['output_dir'] . '/' . $outputFile;
    file_put_contents($outputPath, $response['body']);
    
    $fileSize = filesize($outputPath);
    echo "✓ Descargado: $outputPath (" . round($fileSize / 1024, 2) . " KB)\n";
    
    // Verificar tipo de archivo
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $outputPath);
    finfo_close($finfo);
    
    if ($mimeType === 'application/pdf') {
        echo "  ℹ️  Nota: El archivo es un PDF (no Excel real)\n";
    }
    
    echo "\n";
    return $outputPath;
}

// ============================================
// CONFIGURACIÓN
// ============================================

$config = [
    'base_url' => 'https://cooptriunfo.org/sistemas/administrativo',
    'username' => 'caja1',
    'password' => '9277864',
    'output_dir' => __DIR__ . '/data',
];

// ============================================
// EJECUCIÓN
// ============================================

try {
    echo "════════════════════════════════════════════\n";
    echo "DESCARGA DE REPORTES DE SOCIOS\n";
    echo "════════════════════════════════════════════\n\n";
    
    // Crear directorio de salida si no existe
    if (!is_dir($config['output_dir'])) {
        mkdir($config['output_dir'], 0755, true);
    }
    
    $client = new HttpClient();
    
    // Login
    login($client, $config);
    
    // Descargar ambos reportes
    $timestamp = date('Y-m-d_His');
    
    $activosFile = "socios_activos_$timestamp.xls";
    $inactivosFile = "socios_inactivos_$timestamp.xls";
    
    $activosPath = downloadReport($client, $config, 'activos', $activosFile);
    $inactivosPath = downloadReport($client, $config, 'inactivos', $inactivosFile);
    
    echo "════════════════════════════════════════════\n";
    echo "✓ DESCARGA COMPLETADA\n";
    echo "════════════════════════════════════════════\n\n";
    echo "Archivos descargados:\n";
    echo "  1. $activosPath\n";
    echo "  2. $inactivosPath\n\n";
    echo "Próximos pasos:\n";
    echo "  1. Convertir PDFs a CSV (parse_fixed_width_csv.js)\n";
    echo "  2. Combinar ambos CSV\n";
    echo "  3. Importar con 2-import-socios.ts\n\n";
    
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
