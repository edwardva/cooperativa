/**
 * Script 16: Comparar extracción completa con extracciones anteriores
 * - Compara con extract-socios-corregidos
 * - Verifica consistencia de datos
 * - Identifica discrepancias
 */

import fs from 'fs';
import path from 'path';

interface SocioCompleto {
  apellidos: string;
  nombres: string;
  cedula: string;
  fecha_ing: string;
  fecha_nac: string;
  codigo: string;
  expediente: string;
  retirado: string;
  tipo_socio: string;
}

interface SocioAnterior {
  cedula: string;
  nombre: string;
  apellido: string;
  // otros campos...
}

const sociosCompletosPath = path.join(__dirname, 'data', 'socios_completo_ajax.json');
const sociosAnterioresPath = path.join(__dirname, 'data', 'socios_corregidos.json');

console.log('🔍 COMPARACIÓN DE EXTRACCIONES');
console.log('='.repeat(80));

// Cargar datos
let sociosCompletos: SocioCompleto[] = [];
let sociosAnteriores: any[] = [];

try {
  sociosCompletos = JSON.parse(fs.readFileSync(sociosCompletosPath, 'utf-8'));
  console.log(`✅ Cargados ${sociosCompletos.length.toLocaleString()} socios de extracción completa`);
} catch (error) {
  console.error('❌ Error cargando extracción completa:', error);
  process.exit(1);
}

try {
  sociosAnteriores = JSON.parse(fs.readFileSync(sociosAnterioresPath, 'utf-8'));
  console.log(`✅ Cargados ${sociosAnteriores.length.toLocaleString()} socios de extracción anterior\n`);
} catch (error) {
  console.log('⚠️  No se encontró extracción anterior para comparar\n');
}

// Crear índices por cédula
const indexCompleto = new Map<string, SocioCompleto>();
sociosCompletos.forEach((s) => {
  const cedula = s.cedula?.trim();
  if (cedula && cedula !== '0') {
    indexCompleto.set(cedula, s);
  }
});

const indexAnterior = new Map<string, any>();
sociosAnteriores.forEach((s) => {
  const cedula = s.cedula?.trim();
  if (cedula && cedula !== '0') {
    indexAnterior.set(cedula, s);
  }
});

console.log('📊 ESTADÍSTICAS GENERALES');
console.log('─'.repeat(80));
console.log(`Extracción completa: ${sociosCompletos.length.toLocaleString()} registros`);
console.log(`  - Con cédula válida: ${indexCompleto.size.toLocaleString()}`);
console.log(`  - Sin cédula/inválida: ${(sociosCompletos.length - indexCompleto.size).toLocaleString()}`);

if (sociosAnteriores.length > 0) {
  console.log(`\nExtracción anterior: ${sociosAnteriores.length.toLocaleString()} registros`);
  console.log(`  - Con cédula válida: ${indexAnterior.size.toLocaleString()}`);
  console.log(`  - Sin cédula/inválida: ${(sociosAnteriores.length - indexAnterior.size).toLocaleString()}`);

  // Comparar conjuntos
  const soloEnCompleta: string[] = [];
  const soloEnAnterior: string[] = [];
  const enAmbas: string[] = [];

  indexCompleto.forEach((_, cedula) => {
    if (indexAnterior.has(cedula)) {
      enAmbas.push(cedula);
    } else {
      soloEnCompleta.push(cedula);
    }
  });

  indexAnterior.forEach((_, cedula) => {
    if (!indexCompleto.has(cedula)) {
      soloEnAnterior.push(cedula);
    }
  });

  console.log('\n\n🔄 COMPARACIÓN DE CONJUNTOS');
  console.log('─'.repeat(80));
  console.log(`Cédulas en ambas extracciones: ${enAmbas.length.toLocaleString()}`);
  console.log(`Solo en extracción completa: ${soloEnCompleta.length.toLocaleString()}`);
  console.log(`Solo en extracción anterior: ${soloEnAnterior.length.toLocaleString()}`);

  if (soloEnCompleta.length > 0) {
    console.log(`\n📝 Ejemplos solo en completa (primeros 10):`);
    soloEnCompleta.slice(0, 10).forEach((cedula) => {
      const socio = indexCompleto.get(cedula)!;
      console.log(`  ${cedula}: ${socio.nombres} ${socio.apellidos}`);
    });
  }

  if (soloEnAnterior.length > 0) {
    console.log(`\n📝 Ejemplos solo en anterior (primeros 10):`);
    soloEnAnterior.slice(0, 10).forEach((cedula) => {
      const socio = indexAnterior.get(cedula)!;
      console.log(`  ${cedula}: ${socio.nombre || ''} ${socio.apellido || ''}`);
    });
  }

  // Verificar consistencia de nombres en socios comunes
  console.log('\n\n🔍 VERIFICACIÓN DE CONSISTENCIA');
  console.log('─'.repeat(80));

  let nombresDiferentes = 0;
  const ejemplosDiferencias: Array<{
    cedula: string;
    nombreCompleto: string;
    nombreAnterior: string;
  }> = [];

  enAmbas.slice(0, 100).forEach((cedula) => {
    const completo = indexCompleto.get(cedula)!;
    const anterior = indexAnterior.get(cedula)!;

    const nombreCompletoNuevo = `${completo.nombres} ${completo.apellidos}`.trim().toLowerCase();
    const nombreCompletoAnterior = `${anterior.nombre || ''} ${anterior.apellido || ''}`.trim().toLowerCase();

    if (nombreCompletoNuevo !== nombreCompletoAnterior) {
      nombresDiferentes++;
      if (ejemplosDiferencias.length < 5) {
        ejemplosDiferencias.push({
          cedula,
          nombreCompleto: `${completo.nombres} ${completo.apellidos}`,
          nombreAnterior: `${anterior.nombre || ''} ${anterior.apellido || ''}`,
        });
      }
    }
  });

  console.log(`Nombres diferentes (muestra de 100): ${nombresDiferentes}`);
  if (ejemplosDiferencias.length > 0) {
    console.log(`\nEjemplos de diferencias:`);
    ejemplosDiferencias.forEach((ej) => {
      console.log(`  Cédula ${ej.cedula}:`);
      console.log(`    Completa: "${ej.nombreCompleto}"`);
      console.log(`    Anterior: "${ej.nombreAnterior}"`);
    });
  }
}

// Análisis de calidad de datos en extracción completa
console.log('\n\n📊 CALIDAD DE DATOS - EXTRACCIÓN COMPLETA');
console.log('─'.repeat(80));

// Socios activos vs retirados
const activos = sociosCompletos.filter((s) => s.retirado?.trim().toLowerCase() === 'no');
const retirados = sociosCompletos.filter((s) => s.retirado?.trim().toLowerCase() === 'si');

console.log(`\n👥 Estado:`);
console.log(`  Activos: ${activos.length.toLocaleString()}`);
console.log(`  Retirados: ${retirados.length.toLocaleString()}`);
console.log(`  Sin definir: ${(sociosCompletos.length - activos.length - retirados.length).toLocaleString()}`);

// Códigos únicos
const codigos = new Set(sociosCompletos.map((s) => s.codigo?.trim()).filter(Boolean));
console.log(`\n🔢 Códigos únicos: ${codigos.size.toLocaleString()}`);

// Expedientes únicos
const expedientes = new Set(sociosCompletos.map((s) => s.expediente?.trim()).filter(Boolean));
console.log(`📋 Expedientes únicos: ${expedientes.size.toLocaleString()}`);

// Guardar reporte
const reportePath = path.join(__dirname, 'data', 'comparacion_extracciones.json');
fs.writeFileSync(
  reportePath,
  JSON.stringify(
    {
      fecha: new Date().toISOString(),
      extraccionCompleta: {
        total: sociosCompletos.length,
        conCedulaValida: indexCompleto.size,
        activos: activos.length,
        retirados: retirados.length,
      },
      extraccionAnterior: {
        total: sociosAnteriores.length,
        conCedulaValida: indexAnterior.size,
      },
      comparacion:
        sociosAnteriores.length > 0
          ? {
              enAmbas: indexCompleto.size,
              soloEnCompleta: Array.from(indexCompleto.keys()).filter((c) => !indexAnterior.has(c))
                .length,
              soloEnAnterior: Array.from(indexAnterior.keys()).filter((c) => !indexCompleto.has(c))
                .length,
            }
          : null,
    },
    null,
    2
  )
);

console.log(`\n\n✅ Reporte guardado: ${reportePath}`);
