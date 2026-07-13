<?php
/**
 * ============================================
 * SCRIPT DE EXTRACCIÓN VÍA WEB SCRAPING
 * ============================================
 * ⚠️  RECOMENDACIÓN: USAR MEJOR LA OPCIÓN A o C
 * 
 * El sistema viejo usa EasyUI DataGrid con AJAX,
 * lo que hace el scraping complejo y poco confiable.
 * 
 * MEJOR OPCIÓN:
 * 1. Ir a: Ahorro → Listado de Asociados
 * 2. Descargar el reporte Excel/CSV que genera
 * 3. Convertir a CSV si es necesario
 * 4. Usar el script de importación
 * 
 * Este script se deja como referencia pero NO
 * se recomienda para uso en producción.
 * 
 * PREREQUISITOS:
 * - PHP 7.4+
 * - Extensión cURL habilitada
 * - Credenciales de acceso al sistema viejo
 * 
 * EJECUCIÓN:
 * php extract_from_old_system.php
 * ============================================
 */

// ============================================
// CONFIGURACIÓN
// ============================================

$config = [
    'base_url' => 'https://cooptriunfo.org/sistemas/administrativo',
    'username' => 'caja1', // Cambiar
    'password' => '9277864', // Cambiar
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
        // curl_close($ch); // Deprecated en PHP 8.5, no necesario
        
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
        // curl_close($ch); // Deprecated en PHP 8.5, no necesario
        
        return ['body' => $response, 'code' => $httpCode];
    }
    
    public function __destruct() {
        if (file_exists($this->cookieFile)) {
            unlink($this->cookieFile);
        }
    }
}

// ============================================
// FUNCIONES DE EXTRACCIÓN
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
    
    // Verificar si hay error en la respuesta JSON
    $jsonData = json_decode($response['body'], true);
    if (isset($jsonData['errorMsg'])) {
        throw new Exception('Error en login: ' . $jsonData['errorMsg']);
    }
    
    // Verificar acceso a menu.php
    $menuResponse = $client->get($config['base_url'] . '/menu.php');
    if ($menuResponse['code'] !== 200 || strpos($menuResponse['body'], 'Usuario:') === false) {
        throw new Exception('Error en login: No se pudo acceder al menú principal.');
    }
    
    echo "✓ Sesión iniciada correctamente\n";
}

function extraerSocios(HttpClient $client, $config) {
    echo "📊 Extrayendo socios...\n";
    
    $socios = [];
    $page = 1;
    $hasMore = true;
    
    while ($hasMore) {
        echo "  Página $page...\n";
        
        $response = $client->get(
            $config['base_url'] . '/socios/listar.php?page=' . $page
        );
        
        if ($response['code'] !== 200) {
            echo "  ⚠️  Error en página $page\n";
            break;
        }
        
        // Parsear HTML (ajustar según estructura real)
        $dom = new DOMDocument();
        @$dom->loadHTML($response['body']);
        $xpath = new DOMXPath($dom);
        
        // Buscar tabla de socios (ajustar selector)
        $rows = $xpath->query('//table[@class="socios"]//tr');
        
        if ($rows->length <= 1) {
            $hasMore = false;
            break;
        }
        
        foreach ($rows as $i => $row) {
            if ($i === 0) continue; // Skip header
            
            $cells = $xpath->query('.//td', $row);
            
            if ($cells->length >= 8) {
                $socios[] = [
                    'codigo_socio' => trim($cells->item(0)->textContent),
                    'cedula' => trim($cells->item(1)->textContent),
                    'apellido' => trim($cells->item(2)->textContent),
                    'nombre' => trim($cells->item(3)->textContent),
                    'telefono' => trim($cells->item(4)->textContent),
                    'ubicacion_codigo' => trim($cells->item(5)->textContent),
                    'estado' => trim($cells->item(6)->textContent),
                    'fecha_ingreso' => trim($cells->item(7)->textContent),
                ];
            }
        }
        
        $page++;
        usleep(500000); // Sleep 0.5s para no sobrecargar servidor
    }
    
    echo "✓ " . count($socios) . " socios extraídos\n";
    return $socios;
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

function guardarJSON($datos, $filename, $outputDir) {
    if (!is_dir($outputDir)) {
        mkdir($outputDir, 0755, true);
    }
    
    $filepath = $outputDir . '/' . $filename;
    file_put_contents(
        $filepath,
        json_encode($datos, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
    );
    
    echo "✓ Guardado en: $filepath\n";
}

// ============================================
// EJECUCIÓN
// ============================================

try {
    echo "════════════════════════════════════════════\n";
    echo "EXTRACCIÓN DE DATOS DEL SISTEMA VIEJO\n";
    echo "════════════════════════════════════════════\n\n";
    
    // Validar configuración
    if ($config['username'] === 'USUARIO_ADMIN' || $config['password'] === 'PASSWORD') {
        throw new Exception('ERROR: Debe configurar usuario y password en el script');
    }
    
    $client = new HttpClient($config['timeout']);
    
    // Login
    login($client, $config);
    
    // Extraer socios
    $socios = extraerSocios($client, $config);
    
    // Guardar datos
    echo "\n💾 Guardando datos...\n";
    guardarCSV($socios, 'socios_export.csv', $config['output_dir']);
    guardarJSON($socios, 'socios_export.json', $config['output_dir']);
    
    echo "\n════════════════════════════════════════════\n";
    echo "✓ EXTRACCIÓN COMPLETADA\n";
    echo "════════════════════════════════════════════\n";
    echo "\nPróximos pasos:\n";
    echo "1. Revisar archivos en: {$config['output_dir']}/\n";
    echo "2. Ejecutar script de importación: npm run migrate:socios\n\n";
    
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n\n";
    exit(1);
}
