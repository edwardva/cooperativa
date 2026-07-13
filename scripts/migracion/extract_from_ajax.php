<?php
/**
 * ============================================
 * EXTRACCIÓN VÍA AJAX ENDPOINT
 * ============================================
 * Extrae datos directamente del endpoint AJAX
 * del DataGrid de EasyUI
 * 
 * EJECUCIÓN:
 * php extract_from_ajax.php
 * ============================================
 */

// ============================================
// CONFIGURACIÓN
// ============================================

$config = [
    'base_url' => 'https://cooptriunfo.org/sistemas/administrativo',
    'username' => 'caja1',
    'password' => '9277864',
    'output_dir' => __DIR__ . '/data',
    'timeout' => 30,
    'rows_per_page' => 100, // Pedir 100 registros por página
    'max_pages' => 200, // Límite de seguridad para evitar loops infinitos
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
        
        return ['body' => $response, 'code' => $httpCode];
    }
    
    public function get($url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_COOKIEFILE => $this->cookieFile,
            CURLOPT_COOKIEJAR => $this->cookieFile,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        return ['body' => $response, 'code' => $httpCode];
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

function extractFromAjax(HttpClient $client, $config) {
    echo "📊 Extrayendo datos desde AJAX endpoint...\n";
    
    $allSocios = [];
    $page = 1;
    $totalPages = null;
    
    while (true) {
        echo "  Página $page...\n";
        
        // Construir URL del endpoint
        $url = $config['base_url'] . '/socios/get.php?' . http_build_query([
            'page' => $page,
            'rows' => $config['rows_per_page'],
        ]);
        
        $response = $client->get($url);
        
        if ($response['code'] !== 200) {
            echo "  ⚠️  Error HTTP {$response['code']} en página $page\n";
            break;
        }
        
        // Parsear JSON response
        $data = json_decode($response['body'], true);
        
        if (!$data || !isset($data['rows'])) {
            echo "  ⚠️  Sin datos en página $page\n";
            break;
        }
        
        $socios = $data['rows'];
        $total = $data['total'] ?? 0;
        
        if (empty($socios)) {
            break;
        }
        
        echo "    ✓ " . count($socios) . " socios obtenidos\n";
        
        // Agregar a la lista
        foreach ($socios as $socio) {
            $allSocios[] = [
                'codigo_socio' => $socio['expediente'] ?? '',
                'cedula' => $socio['cedula'] ?? '',
                'apellido' => $socio['apellidos'] ?? '',
                'nombre' => $socio['nombres'] ?? '',
                'fecha_ingreso' => $socio['fechaing'] ?? '',
                'retirado' => ($socio['retirado'] ?? 'No') === 'Si' ? '1' : '0',
                // Agregar más campos según estén disponibles
            ];
        }
        
        // Calcular total de páginas
        if ($totalPages === null && $total > 0) {
            $totalPages = ceil($total / $config['rows_per_page']);
            echo "  📄 Total estimado: $total socios ($totalPages páginas)\n";
        }
        
        // Si ya tenemos todos los registros
        if ($total > 0 && count($allSocios) >= $total) {
            break;
        }
        
        // Límite de seguridad
        if ($page >= $config['max_pages']) {
            echo "  ⚠️  Alcanzado límite de páginas ({$config['max_pages']})\n";
            break;
        }
        
        $page++;
        
        // Sleep para no sobrecargar
        usleep(300000); // 0.3s
    }
    
    echo "\n✓ Total extraídos: " . count($allSocios) . " socios\n";
    return $allSocios;
}

function guardarCSV($datos, $filename, $outputDir) {
    if (!is_dir($outputDir)) {
        mkdir($outputDir, 0755, true);
    }
    
    $filepath = $outputDir . '/' . $filename;
    $fp = fopen($filepath, 'w');
    
    if (empty($datos)) {
        fclose($fp);
        return;
    }
    
    // Header
    fputcsv($fp, array_keys($datos[0]));
    
    // Datos
    foreach ($datos as $row) {
        fputcsv($fp, $row);
    }
    
    fclose($fp);
    echo "✓ Guardado en: $filepath\n";
}

// ============================================
// EJECUCIÓN
// ============================================

try {
    echo "════════════════════════════════════════════\n";
    echo "EXTRACCIÓN VÍA AJAX ENDPOINT\n";
    echo "════════════════════════════════════════════\n\n";
    
    $client = new HttpClient($config['timeout']);
    
    // Login
    login($client, $config);
    
    // Extraer desde AJAX
    $socios = extractFromAjax($client, $config);
    
    // Guardar datos
    echo "\n💾 Guardando datos...\n";
    guardarCSV($socios, 'socios_export.csv', $config['output_dir']);
    
    echo "\n════════════════════════════════════════════\n";
    echo "✓ EXTRACCIÓN COMPLETADA\n";
    echo "════════════════════════════════════════════\n";
    echo "\nPróximo paso:\n";
    echo "  npm run migrate:socios\n\n";
    
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n\n";
    exit(1);
}
