#!/bin/bash
# Script para descargar el HTML de la página de acuerdos de funeraria

curl -s \
  -H "Cookie: $(php -r "
    \$ch = curl_init();
    curl_setopt(\$ch, CURLOPT_URL, 'https://cooptriunfo.org/sistemas/administrativo/checklogin.php');
    curl_setopt(\$ch, CURLOPT_POST, true);
    curl_setopt(\$ch, CURLOPT_POSTFIELDS, 'username=caja1&password=9277864');
    curl_setopt(\$ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt(\$ch, CURLOPT_HEADER, true);
    \$response = curl_exec(\$ch);
    preg_match_all('/Set-Cookie: ([^;]+)/', \$response, \$matches);
    echo implode('; ', \$matches[1]);
  ")" \
  'https://cooptriunfo.org/sistemas/administrativo/funeraria/acuerdos.php' \
  > data/funeraria/acuerdos_page.html

echo "HTML descargado. Buscando endpoint AJAX..."

# Buscar scripts que contengan URLs de AJAX
grep -i "url\|ajax\|datagrid\|load" data/funeraria/acuerdos_page.html | grep -E "php|js" | head -20
