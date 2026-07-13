<?php
/**
 * Test del endpoint AJAX para entender su comportamiento
 */

require_once __DIR__ . '/extract_from_ajax.php';

$config = [
    'base_url' => 'https://cooptriunfo.org/sistemas/administrativo',
    'username' => 'caja1',
    'password' => '9277864',
    'rows_per_page' => 100,
];

$client = new HttpClient();

// Login
$loginUrl = $config['base_url'] . '/checklogin.php';
$loginData = [
    'username' => $config['username'],
    'password' => $config['password'],
];

$response = $client->post($loginUrl, $loginData);
$jsonData = json_decode($response['body'], true);

if (isset($jsonData['errorMsg'])) {
    die('Error en login: ' . $jsonData['errorMsg'] . "\n");
}

echo "✓ Login exitoso\n\n";

// Test página 1 con rows=100
echo "=== Test Página 1 con rows=100 ===\n";
$url1 = $config['base_url'] . '/socios/get.php?page=1&rows=100';
$response1 = $client->get($url1);
$data1 = json_decode($response1['body'], true);

echo "Total reportado: " . ($data1['total'] ?? 'N/A') . "\n";
echo "Socios en esta página: " . count($data1['rows'] ?? []) . "\n";
echo "Primeros 3 códigos: ";
for ($i = 0; $i < min(3, count($data1['rows'] ?? [])); $i++) {
    echo $data1['rows'][$i]['expediente'] . " ";
}
echo "\n\n";

// Test página 2 con rows=100
echo "=== Test Página 2 con rows=100 ===\n";
$url2 = $config['base_url'] . '/socios/get.php?page=2&rows=100';
$response2 = $client->get($url2);
$data2 = json_decode($response2['body'], true);

echo "Total reportado: " . ($data2['total'] ?? 'N/A') . "\n";
echo "Socios en esta página: " . count($data2['rows'] ?? []) . "\n";
echo "Primeros 3 códigos: ";
for ($i = 0; $i < min(3, count($data2['rows'] ?? [])); $i++) {
    echo $data2['rows'][$i]['expediente'] . " ";
}
echo "\n\n";

// Test sin parámetro rows (default del servidor)
echo "=== Test Página 1 SIN parámetro rows ===\n";
$url3 = $config['base_url'] . '/socios/get.php?page=1';
$response3 = $client->get($url3);
$data3 = json_decode($response3['body'], true);

echo "Total reportado: " . ($data3['total'] ?? 'N/A') . "\n";
echo "Socios en esta página: " . count($data3['rows'] ?? []) . "\n";
echo "Primeros 3 códigos: ";
for ($i = 0; $i < min(3, count($data3['rows'] ?? [])); $i++) {
    echo $data3['rows'][$i]['expediente'] . " ";
}
echo "\n\n";

// Mostrar JSON completo de la página 1 (primeros 500 caracteres)
echo "=== JSON Response (primeros 500 chars) ===\n";
echo substr($response1['body'], 0, 500) . "\n";
