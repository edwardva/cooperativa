<?php
/**
 * ============================================
 * SCRIPT DE DESCARGA DE REPORTE
 * ============================================
 * Automatiza la descarga del reporte de socios
 * desde el sistema viejo
 * 
 * EJECUCIÓN:
 * php download_report.php
 * ============================================
 */

// ============================================
// CONFIGURACIÓN
// ============================================

$config = [
    'base_url' => 'https://cooptriunfo.org/sistemas/administrativo',
    'username' => 'caja1', // Cambiar si es necesario
    'password' => '9277864', // Cambiar si es necesario
    'output_dir' => __DIR__ . '/data',
    'timeout' => 30,
];

// ============================================
// CLASE HTTP CLIENT
// ============================================

class HttpClient {
    private $cookieFile;
    private $timeout;
    
    public function __construct($timeout = 30) {
        $this->cookieFile = tempnam(sys_get_temp_dir(), 'cookies');
        $this->timeout = $timeout;
    }
    
    public function post($url, $data) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($data),
            CURLOPT_COOKIEFILE => $this->cookieFile,
            CURLOPT_COOKIEJAR => $this->cookieFile,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        // curl_close($ch); // Deprecated en PHP 8.5
        
        return ['body' => $response, 'code' => $httpCode];
    }
    
    public function download($url, $outputPath) {
        $ch = curl_init($url);
        $fp = fopen($outputPath, 'w+');
        
        curl_setopt_array($ch, [
            CURLOPT_FILE => $fp,
            CURLOPT_COOKIEFILE => $this->cookieFile,
            CURLOPT_COOKIEJAR => $this->cookieFile,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        
        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        // curl_close($ch); // Deprecated en PHP 8.5
        fclose($fp);
        
        return ['code' => $httpCode];
    }
    
    public function __destruct() {
        if (file_exists($this->cookieFile)) {
            unlink($this->cookieFile);
        }
    }
}

// ============================================
// FUNCIONES
// ============================================

function login(HttpClient $client, $config) {
    echo "🔐 Iniciando sesión...\n";
    
    $response = $client->post(
        $config['base_url'] . '/checklogin.php',
        [
            'username' => $config['username'],
            'password' => $config['password'],
        ]
    );
    
    if ($response['code'] !== 200) {
        throw new Exception('Error en login: Servidor retornó ' . $response['code']);
    }
    
    $jsonData = json_decode($response['body'], true);
    if (isset($jsonData['errorMsg'])) {
        throw new Exception('Error en login: ' . $jsonData['errorMsg']);
    }
    
    echo "✓ Sesión iniciada correctamente\n";
}

function downloadReport(HttpClient $client, $config) {
    echo "📥 Descargando reporte de socios...\n";
    
    if (!is_dir($config['output_dir'])) {
        mkdir($config['output_dir'], 0755, true);
    }
    
    // Intenta descargar el reporte
    $outputPath = $config['output_dir'] . '/socios_report_' . date('Y-m-d_His') . '.xls';
    
    $response = $client->download(
        $config['base_url'] . '/rep_ahorro/rep_socios.php',
        $outputPath
    );
    
    if ($response['code'] === 200 && file_exists($outputPath) && filesize($outputPath) > 0) {
        echo "✓ Reporte descargado: $outputPath\n";
        echo "  Tamaño: " . number_format(filesize($outputPath) / 1024, 2) . " KB\n";
        return $outputPath;
    } else {
        throw new Exception('Error al descargar el reporte');
    }
}

// ============================================
// EJECUCIÓN
// ============================================

try {
    echo "════════════════════════════════════════════\n";
    echo "DESCARGA DE REPORTE DEL SISTEMA VIEJO\n";
    echo "════════════════════════════════════════════\n\n";
    
    $client = new HttpClient($config['timeout']);
    
    // Login
    login($client, $config);
    
    // Descargar reporte
    $reportPath = downloadReport($client, $config);
    
    echo "\n════════════════════════════════════════════\n";
    echo "✓ DESCARGA COMPLETADA\n";
    echo "════════════════════════════════════════════\n";
    echo "\nPróximos pasos:\n";
    echo "1. Abrir archivo: $reportPath\n";
    echo "2. Convertir a CSV si es Excel\n";
    echo "3. Copiar a: data/socios_export.csv\n";
    echo "4. Ejecutar: npm run migrate:socios\n\n";
    
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n\n";
    exit(1);
}
