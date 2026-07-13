#!/usr/bin/env node

/**
 * Parser para convertir PDFs de ahorro a CSV
 * Convierte los reportes de saldos de ahorro del sistema viejo a formato CSV
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'ahorro');
const OUTPUT_CSV = path.join(DATA_DIR, 'cuentas_ahorro_combinadas.csv');

// Tipos de cuenta que tienen datos significativos
const ARCHIVOS_A_PROCESAR = [
    { file: 'saldos_ahorro_CUENTA_A_LA_VISTA.pdf', tipo_codigo: '01', tipo_nombre: 'CUENTA A LA VISTA' },
    { file: 'saldos_ahorro_AHORRO_DIVISAS.pdf', tipo_codigo: '12', tipo_nombre: 'AHORRO DIVISAS' },
    { file: 'saldos_ahorro_CUENTA_INFANTIL.pdf', tipo_codigo: '02', tipo_nombre: 'CUENTA INFANTIL' },
    // Los demás son muy pequeños (5-6KB) pero los incluimos por completitud
    { file: 'saldos_ahorro_CUENTA_NAVIDENA.pdf', tipo_codigo: '03', tipo_nombre: 'CUENTA NAVIDEÑA' },
    { file: 'saldos_ahorro_PLAZO_FIJO_60_DIAS.pdf', tipo_codigo: '04', tipo_nombre: 'PLAZO FIJO 60 DIAS' },
    { file: 'saldos_ahorro_PLAZO_FIJO_90_DIAS.pdf', tipo_codigo: '05', tipo_nombre: 'PLAZO FIJO 90 DIAS' },
    { file: 'saldos_ahorro_CUENTA_FIDEICOMISO.pdf', tipo_codigo: '06', tipo_nombre: 'CUENTA FIDEICOMISO' },
    { file: 'saldos_ahorro_MULTAS.pdf', tipo_codigo: '07', tipo_nombre: 'MULTAS' },
    { file: 'saldos_ahorro_INSCRIP_CARNET.pdf', tipo_codigo: '08', tipo_nombre: 'INSCRIP - CARNET' },
    { file: 'saldos_ahorro_REINT_FUN.pdf', tipo_codigo: '09', tipo_nombre: 'REINT - FUN' },
    { file: 'saldos_ahorro_REINT_SALUD.pdf', tipo_codigo: '10', tipo_nombre: 'REINT - SALUD' },
    { file: 'saldos_ahorro_APORTE_CICS.pdf', tipo_codigo: '11', tipo_nombre: 'APORTE - CICS' },
    { file: 'saldos_ahorro_FONDO_INTEGRADO.pdf', tipo_codigo: '13', tipo_nombre: 'FONDO INTEGRADO' },
];

/**
 * Convierte un PDF a texto usando pdftotext con layout preservado
 */
function pdfToText(pdfPath) {
    try {
        const text = execSync(`pdftotext -layout "${pdfPath}" -`, { 
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024 // 50MB buffer
        });
        return text;
    } catch (error) {
        console.error(`Error convirtiendo ${pdfPath}:`, error.message);
        return '';
    }
}

/**
 * Parsea una línea de datos de cuenta de ahorro
 */
function parsearLineaCuenta(linea, tipoInfo) {
    // Formato esperado (con espacios como separadores):
    // 01-01-00-100040   T.DE CARUCI RAMONA                 2530615     0.00     0.00
    
    // Remover espacios extras al inicio y fin
    linea = linea.trim();
    
    // Verificar que la línea empiece con el formato de número de cuenta
    if (!/^\d{2}-\d{2}-\d{2}-\d{6}/.test(linea)) {
        return null;
    }
    
    // Extraer número de cuenta (primeros 17 caracteres: XX-XX-XX-XXXXXX)
    const numeroCuenta = linea.substring(0, 17).trim();
    
    // El resto de la línea después del número de cuenta
    const resto = linea.substring(17).trim();
    
    // Buscar los últimos 3 campos numéricos: cedula, saldo_bs, saldo_usd
    // Usando regex para capturar los últimos números
    const match = resto.match(/^(.+?)\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)$/);
    
    if (!match) {
        // Intentar formato alternativo si el nombre tiene más de una línea o caracteres especiales
        return null;
    }
    
    const [_, nombre, cedula, saldoBs, saldoUsd] = match;
    
    return {
        numero_cuenta: numeroCuenta,
        tipo_cuenta_codigo: tipoInfo.tipo_codigo,
        tipo_cuenta_nombre: tipoInfo.tipo_nombre,
        nombre_completo: nombre.trim(),
        cedula: cedula.trim().replace(/[,\.]/g, ''), // Remover puntos y comas
        saldo_bs: parseFloat(saldoBs.replace(/,/g, '')) || 0,
        saldo_usd: parseFloat(saldoUsd.replace(/,/g, '')) || 0,
    };
}

/**
 * Procesa un archivo PDF y extrae las cuentas
 */
function procesarArchivoPDF(archivo, tipoInfo) {
    console.log(`\n📄 Procesando ${archivo}...`);
    
    const pdfPath = path.join(DATA_DIR, archivo);
    if (!fs.existsSync(pdfPath)) {
        console.log(`  ⚠️  Archivo no encontrado: ${archivo}`);
        return [];
    }
    
    const texto = pdfToText(pdfPath);
    if (!texto) {
        console.log(`  ❌ Error convirtiendo PDF a texto`);
        return [];
    }
    
    const lineas = texto.split('\n');
    const cuentas = [];
    let errores = 0;
    let lineasProcesadas = 0;
    let lineaIncompleta = null; // Para manejar nombres largos en múltiples líneas
    
    for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];
        
        // Saltar líneas vacías, encabezados y separadores
        if (!linea.trim() || 
            linea.includes('Listado de Ahorros') ||
            linea.includes('No. Cuenta') ||
            linea.includes('Apellidos y Nombres') ||
            linea.includes('Pagina') ||
            linea.includes('Total:') ||
            linea.trim() === '') {
            continue;
        }
        
        // Si hay una línea incompleta previa, intentar combinarla con la actual
        if (lineaIncompleta) {
            const lineaCombinada = lineaIncompleta + ' ' + linea.trim();
            const cuenta = parsearLineaCuenta(lineaCombinada, tipoInfo);
            
            if (cuenta) {
                cuentas.push(cuenta);
                lineaIncompleta = null;
                continue;
            } else {
                // Si aún no se puede parsear, seguir acumulando
                lineaIncompleta = lineaCombinada;
                // Pero si ya tiene más de 200 caracteres, descartar y empezar de nuevo
                if (lineaIncompleta.length > 200) {
                    errores++;
                    if (errores <= 5) {
                        console.log(`  ⚠️  Error parseando línea combinada: ${lineaIncompleta.substring(0, 80)}...`);
                    }
                    lineaIncompleta = null;
                }
            }
        }
        
        lineasProcesadas++;
        
        // Intentar parsear la línea actual
        const cuenta = parsearLineaCuenta(linea, tipoInfo);
        
        if (cuenta) {
            cuentas.push(cuenta);
            lineaIncompleta = null;
        } else {
            // Si la línea empieza con número de cuenta pero no se puede parsear,
            // probablemente el nombre está truncado
            if (/^\d{2}-\d{2}-\d{2}-\d{6}/.test(linea.trim())) {
                lineaIncompleta = linea;
            } else {
                // Solo contar como error si la línea parece tener datos
                if (linea.length > 20 && /\d/.test(linea) && !linea.includes('Total:')) {
                    errores++;
                    if (errores <= 5) {
                        console.log(`  ⚠️  Error parseando línea: ${linea.substring(0, 80)}...`);
                    }
                }
            }
        }
    }
    
    console.log(`  ✅ ${cuentas.length} cuentas extraídas`);
    console.log(`  📊 ${lineasProcesadas} líneas procesadas, ${errores} errores`);
    
    return cuentas;
}

/**
 * Genera CSV con todas las cuentas
 */
function generarCSV(todasLasCuentas) {
    console.log(`\n📝 Generando CSV...`);
    
    // Encabezado CSV
    const encabezado = 'numero_cuenta,tipo_cuenta_codigo,tipo_cuenta_nombre,nombre_completo,cedula,saldo_bs,saldo_usd\n';
    
    // Convertir a CSV
    const lineasCSV = todasLasCuentas.map(cuenta => {
        // Escapar comillas en el nombre
        const nombreEscapado = cuenta.nombre_completo.replace(/"/g, '""');
        const tipoEscapado = cuenta.tipo_cuenta_nombre.replace(/"/g, '""');
        
        return `"${cuenta.numero_cuenta}","${cuenta.tipo_cuenta_codigo}","${tipoEscapado}","${nombreEscapado}","${cuenta.cedula}",${cuenta.saldo_bs},${cuenta.saldo_usd}`;
    }).join('\n');
    
    // Guardar archivo
    fs.writeFileSync(OUTPUT_CSV, encabezado + lineasCSV, 'utf-8');
    
    console.log(`✅ CSV generado: ${OUTPUT_CSV}`);
    console.log(`📊 Total de cuentas: ${todasLasCuentas.length}`);
}

/**
 * Genera estadísticas de las cuentas
 */
function generarEstadisticas(cuentas) {
    console.log(`\n📊 === ESTADÍSTICAS ===`);
    
    // Por tipo de cuenta
    const porTipo = {};
    let totalSaldoBs = 0;
    let totalSaldoUsd = 0;
    let cuentasConSaldo = 0;
    
    for (const cuenta of cuentas) {
        // Contar por tipo
        if (!porTipo[cuenta.tipo_cuenta_nombre]) {
            porTipo[cuenta.tipo_cuenta_nombre] = {
                cantidad: 0,
                saldo_bs: 0,
                saldo_usd: 0,
                con_saldo: 0
            };
        }
        
        porTipo[cuenta.tipo_cuenta_nombre].cantidad++;
        porTipo[cuenta.tipo_cuenta_nombre].saldo_bs += cuenta.saldo_bs;
        porTipo[cuenta.tipo_cuenta_nombre].saldo_usd += cuenta.saldo_usd;
        
        if (cuenta.saldo_bs > 0 || cuenta.saldo_usd > 0) {
            porTipo[cuenta.tipo_cuenta_nombre].con_saldo++;
            cuentasConSaldo++;
        }
        
        totalSaldoBs += cuenta.saldo_bs;
        totalSaldoUsd += cuenta.saldo_usd;
    }
    
    console.log(`\nTotal de cuentas: ${cuentas.length}`);
    console.log(`Cuentas con saldo: ${cuentasConSaldo} (${(cuentasConSaldo / cuentas.length * 100).toFixed(1)}%)`);
    console.log(`Cuentas sin saldo: ${cuentas.length - cuentasConSaldo} (${((cuentas.length - cuentasConSaldo) / cuentas.length * 100).toFixed(1)}%)`);
    console.log(`\nSaldos totales:`);
    console.log(`  Bs: ${totalSaldoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  USD: ${totalSaldoUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`);
    
    console.log(`\nPor tipo de cuenta:`);
    for (const [tipo, stats] of Object.entries(porTipo)) {
        console.log(`\n  ${tipo}:`);
        console.log(`    Cuentas: ${stats.cantidad}`);
        console.log(`    Con saldo: ${stats.con_saldo} (${(stats.con_saldo / stats.cantidad * 100).toFixed(1)}%)`);
        console.log(`    Saldo Bs: ${stats.saldo_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`);
        console.log(`    Saldo USD: ${stats.saldo_usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`);
    }
}

// ===== EJECUCIÓN PRINCIPAL =====

console.log('=== Parser de Cuentas de Ahorro ===\n');

const todasLasCuentas = [];

// Procesar cada archivo PDF
for (const archivoInfo of ARCHIVOS_A_PROCESAR) {
    const cuentas = procesarArchivoPDF(archivoInfo.file, archivoInfo);
    todasLasCuentas.push(...cuentas);
}

// Generar CSV combinado
if (todasLasCuentas.length > 0) {
    generarCSV(todasLasCuentas);
    generarEstadisticas(todasLasCuentas);
} else {
    console.log('\n❌ No se encontraron cuentas para procesar');
    process.exit(1);
}

console.log('\n✅ Proceso completado!');
