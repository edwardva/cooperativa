<?php
/**
 * Test simple del endpoint AJAX
 */

class SimpleHttpClient {
    private $cookies = [];
    
    public function post($url, $data) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
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
        
        curl_close($ch);
        return ['code' => $code, 'body' => $body];
    }
    
    public function get($url) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        if (!empty($this->cookies)) {
            curl_setopt($ch, CURLOPT_COOKIE, implode('; ', $this->cookies));
        }
        
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return ['code' => $code, 'body' => $body];
    }
}

$config = [
    'base_url' => 'https://cooptriunfo.org/sistemas/administrativo',
    'username' => 'caja1',
    'password' => '9277864',
];

$client = new SimpleHttpClient();

// Login
echo "Iniciando sesión...\n";
$loginUrl = $config['base_url'] . '/checklogin.php';
$response = $client->post($loginUrl, [
    'username' => $config['username'],
    'password' => $config['password'],
]);

$jsonData = json_decode($response['body'], true);
if (isset($jsonData['errorMsg'])) {
    die('Error: ' . $jsonData['errorMsg'] . "\n");
}
echo "✓ Login OK\n\n";

// Test 1: Página 1 con rows=100
echo "=== Test 1: page=1&rows=100 ===\n";
$url1 = $config['base_url'] . '/socios/get.php?page=1&rows=100';
$response1 = $client->get($url1);
$data1 = json_decode($response1['body'], true);

echo "Total: " . ($data1['total'] ?? 'N/A') . "\n";
echo "Rows devueltos: " . count($data1['rows'] ?? []) . "\n";
if (!empty($data1['rows'])) {
    echo "Primeros 3: ";
    for ($i = 0; $i < min(3, count($data1['rows'])); $i++) {
        echo $data1['rows'][$i]['expediente'] . " ";
    }
    echo "\n";
}
echo "\n";

// Test 2: Página 2 con rows=100  
echo "=== Test 2: page=2&rows=100 ===\n";
$url2 = $config['base_url'] . '/socios/get.php?page=2&rows=100';
$response2 = $client->get($url2);
$data2 = json_decode($response2['body'], true);

echo "Total: " . ($data2['total'] ?? 'N/A') . "\n";
echo "Rows devueltos: " . count($data2['rows'] ?? []) . "\n";
if (!empty($data2['rows'])) {
    echo "Primeros 3: ";
    for ($i = 0; $i < min(3, count($data2['rows'])); $i++) {
        echo $data2['rows'][$i]['expediente'] . " ";
    }
    echo "\n";
}
echo "\n";

// Test 3: Ver si los socios son diferentes
if (!empty($data1['rows']) && !empty($data2['rows'])) {
    $codigos1 = array_map(fn($s) => $s['expediente'], array_slice($data1['rows'], 0, 3));
    $codigos2 = array_map(fn($s) => $s['expediente'], array_slice($data2['rows'], 0, 3));
    
    if ($codigos1 === $codigos2) {
        echo "⚠️  PROBLEMA: Las páginas 1 y 2 tienen LOS MISMOS socios\n\n";
    } else {
        echo "✓ Las páginas tienen socios diferentes\n\n";
    }
}

// Mostrar sample del JSON
echo "=== JSON de página 1 (primeros 800 chars) ===\n";
echo substr($response1['body'], 0, 800) . "\n";
