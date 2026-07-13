#!/usr/bin/env node

/**
 * Script para analizar las 52 cuentas de ahorro que no se migraron
 * porque el socio no fue encontrado en la tabla socios
 * 
 * Objetivo: Determinar si vale la pena recuperarlas
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuración
const CSV_FILE = path.join(__dirname, 'data', 'ahorro', 'cuentas_ahorro_combinadas.csv');
const OUTPUT_FILE = path.join(__dirname, 'data', 'ahorro', 'cuentas_faltantes_analisis.csv');

// Cédulas de los 52 socios no encontrados (ejemplos del informe)
// NOTA: Completar con las 52 cédulas reales desde logs de importación
const CEDULAS_FALTANTES = [
  '7386550',
  '3965722',
  '10801',
  // ... agregar las 49 restantes desde logs
];

interface CuentaAhorro {
  numero_cuenta: string;
  tipo_cuenta_codigo: string;
  tipo_cuenta_nombre: string;
  nombre_completo: string;
  cedula: string;
  saldo_bs: number;
  saldo_usd: number;
}

interface Estadisticas {
  total: number;
  con_saldo: number;
  saldo_total_usd: number;
  saldo_total_bs: number;
  saldo_max_usd: number;
  saldo_max_bs: number;
}

async function analizarCuentasFaltantes() {
  console.log('🔍 Analizando cuentas de ahorro no migradas...\n');

  const cuentasFaltantes: CuentaAhorro[] = [];
  const stats: Estadisticas = {
    total: 0,
    con_saldo: 0,
    saldo_total_usd: 0,
    saldo_total_bs: 0,
    saldo_max_usd: 0,
    saldo_max_bs: 0,
  };

  // Leer CSV
  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (row: any) => {
        const cedula = row.cedula?.trim();
        
        if (CEDULAS_FALTANTES.includes(cedula)) {
          const cuenta: CuentaAhorro = {
            numero_cuenta: row.numero_cuenta,
            tipo_cuenta_codigo: row.tipo_cuenta_codigo,
            tipo_cuenta_nombre: row.tipo_cuenta_nombre,
            nombre_completo: row.nombre_completo,
            cedula: cedula,
            saldo_bs: parseFloat(row.saldo_bs) || 0,
            saldo_usd: parseFloat(row.saldo_usd) || 0,
          };

          cuentasFaltantes.push(cuenta);
          stats.total++;

          if (cuenta.saldo_bs > 0 || cuenta.saldo_usd > 0) {
            stats.con_saldo++;
            stats.saldo_total_bs += cuenta.saldo_bs;
            stats.saldo_total_usd += cuenta.saldo_usd;
            
            if (cuenta.saldo_usd > stats.saldo_max_usd) {
              stats.saldo_max_usd = cuenta.saldo_usd;
            }
            if (cuenta.saldo_bs > stats.saldo_max_bs) {
              stats.saldo_max_bs = cuenta.saldo_bs;
            }
          }
        }
      })
      .on('end', () => {
        mostrarResultados(cuentasFaltantes, stats);
        generarCSV(cuentasFaltantes);
        generarRecomendaciones(stats);
        resolve();
      })
      .on('error', reject);
  });
}

function mostrarResultados(cuentas: CuentaAhorro[], stats: Estadisticas) {
  console.log('📊 RESULTADOS DEL ANÁLISIS\n');
  console.log('═'.repeat(70));
  console.log(`Total cuentas encontradas:  ${stats.total}`);
  console.log(`Cuentas con saldo:          ${stats.con_saldo} (${((stats.con_saldo / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Cuentas sin saldo:          ${stats.total - stats.con_saldo}`);
  console.log('═'.repeat(70));
  console.log(`\n💰 SALDOS TOTALES:`);
  console.log(`   USD:  $${stats.saldo_total_usd.toFixed(2)}`);
  console.log(`   Bs:   ${stats.saldo_total_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`);
  console.log(`\n📈 SALDOS MÁXIMOS:`);
  console.log(`   USD:  $${stats.saldo_max_usd.toFixed(2)}`);
  console.log(`   Bs:   ${stats.saldo_max_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`);
  console.log('═'.repeat(70));

  if (stats.con_saldo > 0) {
    console.log(`\n🔝 TOP 10 CUENTAS CON MAYOR SALDO:\n`);
    
    const top10 = cuentas
      .filter(c => c.saldo_usd > 0 || c.saldo_bs > 0)
      .sort((a, b) => (b.saldo_usd + b.saldo_bs / 7) - (a.saldo_usd + a.saldo_bs / 7))
      .slice(0, 10);

    top10.forEach((cuenta, index) => {
      console.log(`${index + 1}. ${cuenta.nombre_completo}`);
      console.log(`   Cédula: ${cuenta.cedula}`);
      console.log(`   Cuenta: ${cuenta.numero_cuenta}`);
      console.log(`   Saldo:  $${cuenta.saldo_usd.toFixed(2)} USD + ${cuenta.saldo_bs.toLocaleString('es-VE')} Bs`);
      console.log('');
    });
  }
}

function generarCSV(cuentas: CuentaAhorro[]) {
  const headers = 'cedula,nombre_completo,numero_cuenta,tipo_cuenta,saldo_usd,saldo_bs,total_aprox_usd\n';
  
  const rows = cuentas.map(c => {
    const totalAproxUSD = c.saldo_usd + (c.saldo_bs / 7); // Aproximado con tasa 7 Bs/USD
    return `${c.cedula},"${c.nombre_completo}",${c.numero_cuenta},${c.tipo_cuenta_nombre},${c.saldo_usd},${c.saldo_bs},${totalAproxUSD.toFixed(2)}`;
  }).join('\n');

  fs.writeFileSync(OUTPUT_FILE, headers + rows);
  console.log(`\n✅ CSV generado: ${OUTPUT_FILE}\n`);
}

function generarRecomendaciones(stats: Estadisticas) {
  console.log('═'.repeat(70));
  console.log('🎯 RECOMENDACIONES\n');

  if (stats.saldo_total_usd === 0 && stats.saldo_total_bs === 0) {
    console.log('✅ CERRAR - Todas las cuentas tienen saldo $0');
    console.log('   No es necesario recuperar estos registros');
    console.log('   Probabilidad: Socios retirados con cuentas cerradas');
  } else if (stats.saldo_total_usd < 100 && stats.saldo_total_bs < 1000) {
    console.log('🟢 BAJA PRIORIDAD - Saldos insignificantes');
    console.log('   Puede omitirse la recuperación');
    console.log('   Costo/beneficio no justifica el esfuerzo');
  } else if (stats.saldo_total_usd < 1000) {
    console.log('🟡 MEDIA PRIORIDAD - Saldos moderados');
    console.log('   Considerar recuperar solo cuentas con saldo > $50 USD');
    console.log('   Esfuerzo estimado: 2-4 horas');
  } else {
    console.log('🔴 ALTA PRIORIDAD - Saldos significativos');
    console.log('   ⚠️  RECUPERAR URGENTE - Hay dinero importante en juego');
    console.log('   Proceso:');
    console.log('   1. Verificar en sistema viejo si socios son inactivos');
    console.log('   2. Modificar schema para agregar estado "inactivo"');
    console.log('   3. Migrar estos socios con estado=inactivo');
    console.log('   4. Reimportar cuentas de ahorro');
    console.log(`   5. Validar que los $${stats.saldo_total_usd.toFixed(2)} USD estén correctos`);
  }

  console.log('\n📋 PRÓXIMOS PASOS:\n');
  console.log('1. Revisar archivo generado: data/ahorro/cuentas_faltantes_analisis.csv');
  console.log('2. Buscar manualmente las cédulas en sistema viejo');
  console.log('3. Verificar si están como "inactivos" o "retirados"');
  console.log('4. Si tienen saldo significativo, ejecutar migración de socios inactivos');
  console.log('5. Documentar decisión en PLAN-DE-DESARROLLO.md');
  
  console.log('═'.repeat(70));
}

// Ejecutar
analizarCuentasFaltantes()
  .then(() => {
    console.log('\n✅ Análisis completado\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
