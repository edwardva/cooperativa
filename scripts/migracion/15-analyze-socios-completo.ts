/**
 * Script 15: Análisis completo de los 18,167 socios extraídos
 * - Analiza todos los 25 campos
 * - Identifica campos útiles vs vacíos/inútiles
 * - Genera estadísticas de calidad de datos
 */

import fs from 'fs';
import path from 'path';

interface Socio {
  apellidos: string;
  nombres: string;
  sexo: string;
  cedula: string;
  direccion: string;
  fecha_ing: string;
  fecha_nac: string;
  codigo: string;
  telefono: string;
  cod_profesion: string;
  conyugue: string;
  con_cedula: string;
  autorizado: string;
  autorizado_cedula: string;
  observacion: string;
  expediente: string;
  nacionalidad: string;
  telefono_movil: string;
  correo: string;
  fecha_ret: string;
  delegado: string;
  retirado: string;
  tipo_socio: string;
  motivo: string;
  asistio: string;
}

const dataPath = path.join(__dirname, 'data', 'socios_completo_ajax.json');
const socios: Socio[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

console.log('📊 ANÁLISIS DE DATOS - SOCIOS COMPLETO');
console.log('=' .repeat(80));
console.log(`Total de registros: ${socios.length.toLocaleString()}\n`);

// Función para determinar si un valor está "vacío"
function isEmpty(value: string): boolean {
  if (!value) return true;
  const cleaned = value.trim().toLowerCase();
  return (
    cleaned === '' ||
    cleaned === '0' ||
    cleaned === 'null' ||
    cleaned === 'p/n' ||
    cleaned === 'notiene' ||
    cleaned === 'no tiene' ||
    cleaned === '01/01/1900' ||
    cleaned === '00/00/0000' ||
    /^0+$/.test(cleaned)
  );
}

// Analizar cada campo
const campos = Object.keys(socios[0]) as (keyof Socio)[];
const analisis: Record<string, any> = {};

console.log('🔍 ANÁLISIS POR CAMPO');
console.log('─'.repeat(80));

campos.forEach((campo) => {
  const valores = socios.map((s) => s[campo]);
  const noVacios = valores.filter((v) => !isEmpty(v));
  const unicos = new Set(noVacios);

  const porcentajeLleno = (noVacios.length / socios.length) * 100;
  const ejemplos = Array.from(unicos).slice(0, 5);

  analisis[campo] = {
    total: socios.length,
    conDatos: noVacios.length,
    vacios: socios.length - noVacios.length,
    porcentajeLleno: porcentajeLleno.toFixed(2),
    valoresUnicos: unicos.size,
    ejemplos,
  };

  // Determinar utilidad del campo
  let utilidad = '🔴 INÚTIL';
  if (porcentajeLleno > 80) utilidad = '🟢 MUY ÚTIL';
  else if (porcentajeLleno > 50) utilidad = '🟡 ÚTIL';
  else if (porcentajeLleno > 20) utilidad = '🟠 POCO ÚTIL';

  console.log(`\n${utilidad} ${campo}`);
  console.log(`  Con datos: ${noVacios.length.toLocaleString()} (${porcentajeLleno.toFixed(1)}%)`);
  console.log(`  Valores únicos: ${unicos.size.toLocaleString()}`);
  if (ejemplos.length > 0) {
    console.log(`  Ejemplos: ${ejemplos.map((e) => `"${e}"`).join(', ')}`);
  }
});

// Resumen de campos por utilidad
console.log('\n\n📈 RESUMEN POR UTILIDAD');
console.log('─'.repeat(80));

const camposMuyUtiles = campos.filter((c) => parseFloat(analisis[c].porcentajeLleno) > 80);
const camposUtiles = campos.filter(
  (c) =>
    parseFloat(analisis[c].porcentajeLleno) > 50 &&
    parseFloat(analisis[c].porcentajeLleno) <= 80
);
const camposPocoUtiles = campos.filter(
  (c) =>
    parseFloat(analisis[c].porcentajeLleno) > 20 &&
    parseFloat(analisis[c].porcentajeLleno) <= 50
);
const camposInutiles = campos.filter((c) => parseFloat(analisis[c].porcentajeLleno) <= 20);

console.log(`\n🟢 MUY ÚTILES (>80%): ${camposMuyUtiles.length} campos`);
camposMuyUtiles.forEach((c) => console.log(`   - ${c} (${analisis[c].porcentajeLleno}%)`));

console.log(`\n🟡 ÚTILES (50-80%): ${camposUtiles.length} campos`);
camposUtiles.forEach((c) => console.log(`   - ${c} (${analisis[c].porcentajeLleno}%)`));

console.log(`\n🟠 POCO ÚTILES (20-50%): ${camposPocoUtiles.length} campos`);
camposPocoUtiles.forEach((c) => console.log(`   - ${c} (${analisis[c].porcentajeLleno}%)`));

console.log(`\n🔴 INÚTILES (<20%): ${camposInutiles.length} campos`);
camposInutiles.forEach((c) => console.log(`   - ${c} (${analisis[c].porcentajeLleno}%)`));

// Validaciones específicas
console.log('\n\n🔍 VALIDACIONES ESPECÍFICAS');
console.log('─'.repeat(80));

// Validar cédulas
const cedulasInvalidas = socios.filter((s) => {
  const cedula = s.cedula?.trim();
  return !cedula || cedula === '0' || cedula.length < 6 || cedula.length > 10;
});
console.log(`\n📋 Cédulas:`);
console.log(`  Válidas: ${(socios.length - cedulasInvalidas.length).toLocaleString()}`);
console.log(`  Inválidas: ${cedulasInvalidas.length.toLocaleString()}`);

// Validar fechas de ingreso
const fechasIngInvalidas = socios.filter((s) => {
  const fecha = s.fecha_ing?.trim();
  return !fecha || fecha === '01/01/1900' || fecha === '00/00/0000';
});
console.log(`\n📅 Fechas de ingreso:`);
console.log(`  Válidas: ${(socios.length - fechasIngInvalidas.length).toLocaleString()}`);
console.log(`  Inválidas: ${fechasIngInvalidas.length.toLocaleString()}`);

// Validar fechas de nacimiento
const fechasNacInvalidas = socios.filter((s) => {
  const fecha = s.fecha_nac?.trim();
  return !fecha || fecha === '01/01/1900' || fecha === '00/00/0000';
});
console.log(`\n🎂 Fechas de nacimiento:`);
console.log(`  Válidas: ${(socios.length - fechasNacInvalidas.length).toLocaleString()}`);
console.log(`  Inválidas: ${fechasNacInvalidas.length.toLocaleString()}`);

// Validar teléfonos
const conTelefonoFijo = socios.filter(
  (s) => s.telefono && !isEmpty(s.telefono) && s.telefono.trim().length >= 7
);
const conTelefonoMovil = socios.filter(
  (s) => s.telefono_movil && !isEmpty(s.telefono_movil) && s.telefono_movil.trim().length >= 10
);
console.log(`\n📞 Teléfonos:`);
console.log(`  Con teléfono fijo: ${conTelefonoFijo.length.toLocaleString()}`);
console.log(`  Con teléfono móvil: ${conTelefonoMovil.length.toLocaleString()}`);
console.log(`  Sin ningún teléfono: ${
  socios.length - new Set([...conTelefonoFijo, ...conTelefonoMovil]).size
}`);

// Validar correos
const conCorreoValido = socios.filter((s) => {
  const correo = s.correo?.trim().toLowerCase();
  return correo && !isEmpty(correo) && correo.includes('@');
});
console.log(`\n📧 Correos electrónicos:`);
console.log(`  Con correo válido: ${conCorreoValido.length.toLocaleString()}`);
console.log(
  `  Sin correo: ${(socios.length - conCorreoValido.length).toLocaleString()}`
);

// Validar estado de socios
const activos = socios.filter((s) => s.retirado?.trim().toLowerCase() === 'no');
const retirados = socios.filter((s) => s.retirado?.trim().toLowerCase() === 'si');
console.log(`\n👥 Estado de socios:`);
console.log(`  Activos: ${activos.length.toLocaleString()}`);
console.log(`  Retirados: ${retirados.length.toLocaleString()}`);
console.log(`  Sin definir: ${(socios.length - activos.length - retirados.length).toLocaleString()}`);

// Analizar tipos de socio
const tiposSocio = new Map<string, number>();
socios.forEach((s) => {
  const tipo = s.tipo_socio?.trim() || 'Sin definir';
  tiposSocio.set(tipo, (tiposSocio.get(tipo) || 0) + 1);
});
console.log(`\n📊 Tipos de socio:`);
Array.from(tiposSocio.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([tipo, count]) => {
    console.log(`  ${tipo}: ${count.toLocaleString()}`);
  });

// Guardar reporte JSON
const reportePath = path.join(__dirname, 'data', 'analisis_socios_completo.json');
fs.writeFileSync(
  reportePath,
  JSON.stringify(
    {
      fecha: new Date().toISOString(),
      totalRegistros: socios.length,
      analisisPorCampo: analisis,
      resumen: {
        camposMuyUtiles,
        camposUtiles,
        camposPocoUtiles,
        camposInutiles,
      },
      validaciones: {
        cedulas: {
          validas: socios.length - cedulasInvalidas.length,
          invalidas: cedulasInvalidas.length,
        },
        fechasIngreso: {
          validas: socios.length - fechasIngInvalidas.length,
          invalidas: fechasIngInvalidas.length,
        },
        fechasNacimiento: {
          validas: socios.length - fechasNacInvalidas.length,
          invalidas: fechasNacInvalidas.length,
        },
        telefonos: {
          conFijo: conTelefonoFijo.length,
          conMovil: conTelefonoMovil.length,
        },
        correos: {
          validos: conCorreoValido.length,
        },
        estado: {
          activos: activos.length,
          retirados: retirados.length,
        },
      },
    },
    null,
    2
  )
);

console.log(`\n\n✅ Reporte guardado: ${reportePath}`);
