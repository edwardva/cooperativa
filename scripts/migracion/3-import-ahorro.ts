/**
 * Script para importar cuentas de ahorro desde CSV a PostgreSQL
 * 
 * Proceso:
 * 1. Insertar tipos de cuenta de ahorro
 * 2. Leer CSV de cuentas combinadas
 * 3. Buscar socio por cédula
 * 4. Importar cuenta con relación a socio y tipo de cuenta
 * 5. Generar reporte de resultados
 */

// Importar desde el backend directamente
import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

const CSV_FILE = path.join(__dirname, 'data', 'ahorro', 'cuentas_ahorro_combinadas.csv');

// Tipos de cuenta que encontramos en el sistema viejo
const TIPOS_CUENTA = [
    { codigo: '01', nombre: 'CUENTA A LA VISTA', descripcion: 'Cuenta de ahorro estándar con retiros ilimitados' },
    { codigo: '02', nombre: 'CUENTA INFANTIL', descripcion: 'Cuenta de ahorro para menores de edad' },
    { codigo: '03', nombre: 'CUENTA NAVIDEÑA', descripcion: 'Cuenta de ahorro programado para gastos navideños' },
    { codigo: '04', nombre: 'PLAZO FIJO 60 DIAS', descripcion: 'Cuenta de ahorro a plazo fijo de 60 días' },
    { codigo: '05', nombre: 'PLAZO FIJO 90 DIAS', descripcion: 'Cuenta de ahorro a plazo fijo de 90 días' },
    { codigo: '06', nombre: 'CUENTA FIDEICOMISO', descripcion: 'Cuenta de ahorro en fideicomiso' },
    { codigo: '07', nombre: 'MULTAS', descripcion: 'Cuenta especial para pago y control de multas' },
    { codigo: '08', nombre: 'INSCRIP - CARNET', descripcion: 'Cuenta para pagos de inscripción y carnets' },
    { codigo: '09', nombre: 'REINT - FUN', descripcion: 'Cuenta para reintegros de funeraria' },
    { codigo: '10', nombre: 'REINT - SALUD', descripcion: 'Cuenta para reintegros de salud' },
    { codigo: '11', nombre: 'APORTE - CICS', descripcion: 'Cuenta para aportes CICS' },
    { codigo: '12', nombre: 'AHORRO DIVISAS', descripcion: 'Cuenta de ahorro en dólares estadounidenses' },
    { codigo: '13', nombre: 'FONDO INTEGRADO', descripcion: 'Fondo colectivo integrado' },
];

interface CuentaCSV {
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
    insertadas: number;
    errores: number;
    duplicadas: number;
    socio_no_encontrado: number;
    tipo_no_encontrado: number;
    cuentas_con_saldo: number;
    total_saldo_usd: number;
    total_saldo_bs: number;
}

/**
 * Inserta los tipos de cuenta de ahorro
 */
async function insertarTiposCuenta() {
    console.log('\n📋 Insertando tipos de cuenta de ahorro...');
    
    let insertados = 0;
    let existentes = 0;
    
    for (const tipo of TIPOS_CUENTA) {
        try {
            await prisma.tipoCuentaAhorro.upsert({
                where: { codigo: tipo.codigo },
                update: {
                    nombre: tipo.nombre,
                    descripcion: tipo.descripcion,
                    estado: true,
                },
                create: {
                    codigo: tipo.codigo,
                    nombre: tipo.nombre,
                    descripcion: tipo.descripcion,
                    estado: true,
                },
            });
            insertados++;
        } catch (error) {
            console.error(`  ❌ Error insertando tipo ${tipo.codigo}:`, error);
            existentes++;
        }
    }
    
    console.log(`  ✅ ${insertados} tipos de cuenta procesados`);
    
    // Obtener todos los tipos para mapeo posterior
    const tipos = await prisma.tipoCuentaAhorro.findMany();
    const tiposPorCodigo = new Map(tipos.map(t => [t.codigo, t]));
    
    return tiposPorCodigo;
}

/**
 * Lee el archivo CSV de cuentas
 */
function leerCSV(): CuentaCSV[] {
    console.log('\n📂 Leyendo CSV de cuentas de ahorro...');
    console.log(`   Archivo: ${CSV_FILE}`);
    
    if (!fs.existsSync(CSV_FILE)) {
        throw new Error(`Archivo CSV no encontrado: ${CSV_FILE}`);
    }
    
    const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });
    
    console.log(`  ✅ ${records.length} registros leídos del CSV`);
    
    // Convertir a tipo correcto
    return records.map((r: any) => ({
        numero_cuenta: r.numero_cuenta,
        tipo_cuenta_codigo: r.tipo_cuenta_codigo,
        tipo_cuenta_nombre: r.tipo_cuenta_nombre,
        nombre_completo: r.nombre_completo,
        cedula: r.cedula,
        saldo_bs: parseFloat(r.saldo_bs) || 0,
        saldo_usd: parseFloat(r.saldo_usd) || 0,
    }));
}

/**
 * Importa las cuentas de ahorro
 */
async function importarCuentas(cuentasCSV: CuentaCSV[], tiposPorCodigo: Map<string, any>) {
    console.log('\n💾 Importando cuentas de ahorro...');
    
    const stats: Estadisticas = {
        total: cuentasCSV.length,
        insertadas: 0,
        errores: 0,
        duplicadas: 0,
        socio_no_encontrado: 0,
        tipo_no_encontrado: 0,
        cuentas_con_saldo: 0,
        total_saldo_usd: 0,
        total_saldo_bs: 0,
    };
    
    const erroresDetallados: string[] = [];
    
    for (let i = 0; i < cuentasCSV.length; i++) {
        const cuenta = cuentasCSV[i];
        
        // Progreso cada 500 registros
        if ((i + 1) % 500 === 0) {
            console.log(`  📊 Progreso: ${i + 1}/${cuentasCSV.length} (${((i + 1) / cuentasCSV.length * 100).toFixed(1)}%)`);
        }
        
        try {
            // 1. Buscar tipo de cuenta
            const tipoCuenta = tiposPorCodigo.get(cuenta.tipo_cuenta_codigo);
            if (!tipoCuenta) {
                stats.tipo_no_encontrado++;
                erroresDetallados.push(`Tipo de cuenta no encontrado: ${cuenta.tipo_cuenta_codigo} - ${cuenta.numero_cuenta}`);
                stats.errores++;
                continue;
            }
            
            // 2. Buscar socio por cédula
            const socio = await prisma.socio.findUnique({
                where: { cedula: cuenta.cedula },
            });
            
            if (!socio) {
                stats.socio_no_encontrado++;
                if (stats.socio_no_encontrado <= 10) {
                    erroresDetallados.push(`Socio no encontrado: ${cuenta.cedula} - ${cuenta.nombre_completo} - ${cuenta.numero_cuenta}`);
                }
                stats.errores++;
                continue;
            }
            
            // 3. Verificar si la cuenta ya existe
            const cuentaExistente = await prisma.cuentaAhorro.findUnique({
                where: { numero_cuenta: cuenta.numero_cuenta },
            });
            
            if (cuentaExistente) {
                stats.duplicadas++;
                continue;
            }
            
            // 4. Insertar cuenta de ahorro
            await prisma.cuentaAhorro.create({
                data: {
                    socio_id: socio.id,
                    tipo_cuenta_id: tipoCuenta.id,
                    numero_cuenta: cuenta.numero_cuenta,
                    saldo_usd: cuenta.saldo_usd,
                    saldo_bs: cuenta.saldo_bs,
                    monto_bloqueado_usd: 0,
                    monto_bloqueado_bs: 0,
                    estado: true,
                    fecha_apertura: new Date(), // No tenemos fecha real, usar actual
                },
            });
            
            stats.insertadas++;
            
            // Estadísticas de saldos
            if (cuenta.saldo_bs > 0 || cuenta.saldo_usd > 0) {
                stats.cuentas_con_saldo++;
                stats.total_saldo_bs += cuenta.saldo_bs;
                stats.total_saldo_usd += cuenta.saldo_usd;
            }
            
        } catch (error: any) {
            stats.errores++;
            if (erroresDetallados.length < 20) {
                erroresDetallados.push(`Error insertando ${cuenta.numero_cuenta}: ${error.message}`);
            }
        }
    }
    
    return { stats, erroresDetallados };
}

/**
 * Genera reporte de resultados
 */
function generarReporte(stats: Estadisticas, erroresDetallados: string[]) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN DE IMPORTACIÓN DE CUENTAS DE AHORRO');
    console.log('='.repeat(70));
    console.log(`\nTotal de registros en CSV:      ${stats.total}`);
    console.log(`Cuentas insertadas:             ${stats.insertadas} (${(stats.insertadas / stats.total * 100).toFixed(1)}%)`);
    console.log(`Cuentas duplicadas:             ${stats.duplicadas}`);
    console.log(`Errores total:                  ${stats.errores}`);
    console.log(`  - Socio no encontrado:        ${stats.socio_no_encontrado}`);
    console.log(`  - Tipo cuenta no encontrado:  ${stats.tipo_no_encontrado}`);
    console.log(`  - Otros errores:              ${stats.errores - stats.socio_no_encontrado - stats.tipo_no_encontrado}`);
    
    console.log(`\n💰 ESTADÍSTICAS DE SALDOS:`);
    console.log(`Cuentas con saldo:              ${stats.cuentas_con_saldo} (${(stats.cuentas_con_saldo / stats.insertadas * 100).toFixed(1)}%)`);
    console.log(`Saldo total Bs:                 ${stats.total_saldo_bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`Saldo total USD:                ${stats.total_saldo_usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`);
    
    if (erroresDetallados.length > 0) {
        console.log(`\n❌ ERRORES DETALLADOS (primeros ${erroresDetallados.length}):`);
        erroresDetallados.forEach(error => {
            console.log(`   - ${error}`);
        });
    }
    
    console.log('\n' + '='.repeat(70));
    
    // Guardar reporte en archivo
    const reportePath = path.join(__dirname, 'RESULTADO-MIGRACION-AHORRO.md');
    const reporteContent = `
# Resultado de Migración de Cuentas de Ahorro

**Fecha:** ${new Date().toLocaleString('es-VE')}

## Resumen

- **Total registros CSV:** ${stats.total}
- **Cuentas insertadas:** ${stats.insertadas} (${(stats.insertadas / stats.total * 100).toFixed(1)}%)
- **Cuentas duplicadas:** ${stats.duplicadas}
- **Errores:** ${stats.errores}
  - Socio no encontrado: ${stats.socio_no_encontrado}
  - Tipo cuenta no encontrado: ${stats.tipo_no_encontrado}
  - Otros: ${stats.errores - stats.socio_no_encontrado - stats.tipo_no_encontrado}

## Estadísticas de Saldos

- **Cuentas con saldo:** ${stats.cuentas_con_saldo} (${(stats.cuentas_con_saldo / stats.insertadas * 100).toFixed(1)}%)
- **Saldo total Bs:** ${stats.total_saldo_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
- **Saldo total USD:** ${stats.total_saldo_usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}

${erroresDetallados.length > 0 ? `
## Errores Detallados (primeros ${erroresDetallados.length})

${erroresDetallados.map(e => `- ${e}`).join('\n')}
` : ''}

## Recomendaciones

${stats.socio_no_encontrado > 0 ? `
⚠️  **${stats.socio_no_encontrado} cuentas sin socio asociado**
- Revisar si estos socios están inactivos o retirados
- Verificar si las cédulas tienen formato diferente
- Considerar migrar socios inactivos primero
` : ''}

${stats.duplicadas > 0 ? `
ℹ️  **${stats.duplicadas} cuentas ya existían en la BD**
- Esto es normal si ya se había ejecutado el script antes
` : ''}

✅ Migración completada exitosamente
`;
    
    fs.writeFileSync(reportePath, reporteContent, 'utf-8');
    console.log(`\n📄 Reporte guardado en: ${reportePath}`);
}

/**
 * Función principal
 */
async function main() {
    console.log('=== Importación de Cuentas de Ahorro ===');
    console.log('Base de datos:', process.env.DATABASE_URL?.split('@')[1] || 'N/A');
    
    try {
        // 1. Insertar tipos de cuenta
        const tiposPorCodigo = await insertarTiposCuenta();
        
        // 2. Leer CSV
        const cuentasCSV = leerCSV();
        
        // 3. Importar cuentas
        const { stats, erroresDetallados } = await importarCuentas(cuentasCSV, tiposPorCodigo);
        
        // 4. Generar reporte
        generarReporte(stats, erroresDetallados);
        
        console.log('\n✅ Proceso completado exitosamente!');
        
    } catch (error) {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Ejecutar
main();
