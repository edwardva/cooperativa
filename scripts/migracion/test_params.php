<?php
/**
 * Test con diferentes combinaciones de parámetros
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
        
        preg_match_all('/Set-Cookie:\s*([^;]+)/', $headers, $matches);
        foreach ($matches[1] as $cookie) {
            $this->cookies[] = $cookie;
        }
        
        return ['body' => $body];
    }
    
    public function get($url) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        if (!empty($this->cookies)) {
            curl_setopt($ch, CURLOPT_COOKIE, implode('; ', $this->cookies));
        }
        
        $body = curl_exec($ch);
        return ['body' => $body];
    }
}

$client = new SimpleHttpClient();

// Login
$client->post('https://cooptriunfo.org/sistemas/administrativo/checklogin.php', [
    'username' => 'caja1',
    'password' => '9277864',
]);

echo "Testing different parameter combinations...\n\n";

// Test diferentes combinaciones
$tests = [
    'page=1&rows=100' => 'page=1&rows=100',
    'page=1&rows=100&sort=expediente&order=asc' => 'page=1&rows=100&sort=expediente&order=asc',
    'page=2&rows=100&sort=expediente&order=asc' => 'page=2&rows=100&sort=expediente&order=asc',
    'page=1&rows=50' => 'page=1&rows=50',
    'page=2&rows=50' => 'page=2&rows=50',
];

$prevCodigos = null;

foreach ($tests as $label => $params) {
    $url = 'https://cooptriunfo.org/sistemas/administrativo/socios/get.php?' . $params;
    $response = $client->get($url);
    $data = json_decode($response['body'], true);
    
    $count = count($data['rows'] ?? []);
    $codigos = array_map(fn($s) => $s['expediente'], array_slice($data['rows'] ?? [], 0, 3));
    
    echo "$label:\n";
    echo "  Rows: $count\n";
    echo "  Primeros 3: " . implode(', ', $codigos) . "\n";
    
    if ($prevCodigos !== null && $prevCodigos !== $codigos) {
        echo "  ✓ DIFERENTES a la prueba anterior\n";
    } elseif ($prevCodigos !== null) {
        echo "  ⚠️  IGUALES a la prueba anterior\n";
    }
    
    $prevCodigos = $codigos;
    echo "\n";
    
    usleep(200000); // 0.2s delay
}
