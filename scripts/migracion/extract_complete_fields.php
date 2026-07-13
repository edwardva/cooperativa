<?php
/**
 * Extraer TODOS los campos de los 10 socios disponibles
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
        $body = substr($response, $headerSize);
        $headers = substr($response, 0, $headerSize);
        
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
        
        return ['body' => curl_exec($ch)];
    }
}

$client = new SimpleHttpClient();

// Login
echo "Login...\n";
$client->post('https://cooptriunfo.org/sistemas/administrativo/checklogin.php', [
    'username' => 'caja1',
    'password' => '9277864',
]);

// Obtener los 10 socios
echo "Obteniendo datos...\n";
$url = 'https://cooptriunfo.org/sistemas/administrativo/socios/get.php?page=1&rows=100';
$response = $client->get($url);
$data = json_decode($response['body'], true);

if (empty($data['rows'])) {
    die("No se obtuvieron datos\n");
}

// Guardar JSON completo
$jsonFile = __DIR__ . '/data/socios_ajax_sample.json';
file_put_contents($jsonFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "✓ JSON guardado en: $jsonFile\n";

// Guardar CSV con TODOS los campos
$csvFile = __DIR__ . '/data/socios_ajax_complete.csv';
$fp = fopen($csvFile, 'w');

// Header - usar todas las keys del primer socio
$headers = array_keys($data['rows'][0]);
fputcsv($fp, $headers, ',', '"', "\\");

// Data
foreach ($data['rows'] as $row) {
    fputcsv($fp, $row, ',', '"', "\\");
}

fclose($fp);
echo "✓ CSV guardado en: $csvFile\n";
echo "✓ Total socios: " . count($data['rows']) . "\n";

// Mostrar campos disponibles
echo "\nCampos disponibles en el JSON:\n";
foreach ($headers as $i => $header) {
    $sample = $data['rows'][0][$header];
    if (strlen($sample) > 50) {
        $sample = substr($sample, 0, 50) . '...';
    }
    printf("  %2d. %-20s : %s\n", $i+1, $header, $sample);
}
