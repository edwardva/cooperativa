/**
 * Script 17: Importar socios completos a PostgreSQL
 * - Mapea 25 campos del sistema viejo al nuevo schema
 * - Valida cédulas, fechas, teléfonos
 * - Maneja duplicados y datos inválidos
 * - Genera reporte de importación
 */

import { PrismaClient, Sexo, EstadoSocio } from '../../backend/node_modules/@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface SocioViejo {
  apellidos: string;
  nombres: string;
  sexo: string;
  cedula: string;
  direccion: string;
  fecha_ing: string; // Fecha inscripción
  fecha_nac: string; // Fecha nacimiento
  codigo: string; // Código socio
  telefono: string;
  cod_profesion: string;
  conyugue: string;
  con_cedula: string; // Cédula del cónyuge
  autorizado: string;
  autorizado_cedula: string;
  observacion: string;
  expediente: string; // Número de expediente
  nacionalidad: string;
  telefono_movil: string;
  correo: string;
  fecha_ret: string; // Fecha retiro
  delegado: string;
  retirado: string; // "SI" o "NO"
  tipo_socio: string;
  motivo: string; // Motivo de retiro
  asistio: string;
}

// ============================================
// FUNCIONES DE VALIDACIÓN Y LIMPIEZA
// ============================================

function limpiarTexto(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const limpio = texto.trim();
  if (
    limpio === '' ||
    limpio === '0' ||
    limpio === 'null' ||
    limpio.toLowerCase() === 'p/n' ||
    limpio.toLowerCase() === 'notiene' ||
    limpio.toLowerCase() === 'no tiene'
  ) {
    return null;
  }
  return limpio;
}

function validarCedula(cedula: string | null): string | null {
  if (!cedula) return null;
  const limpia = cedula.trim().replace(/[^\d]/g, ''); // Solo dígitos
  if (limpia.length < 6 || limpia.length > 10) return null;
  if (/^0+$/.test(limpia)) return null; // Solo ceros
  return limpia;
}

function parsearFecha(fechaStr: string | null): Date | null {
  if (!fechaStr) return null;
  const limpia = limpiarTexto(fechaStr);
  if (!limpia) return null;

  // Validar formatos inválidos
  if (limpia === '01/01/1900' || limpia === '00/00/0000' || limpia === '01/01/0001') {
    return null;
  }

  // Intentar parsear formato DD/MM/YYYY
  const partes = limpia.split('/');
  if (partes.length !== 3) return null;

  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1; // Mes en JS es 0-indexed
  let anio = parseInt(partes[2], 10);

  // AUTO-CORRECCIÓN DE AÑOS MAL ESCRITOS
  // Años de 4 dígitos comenzando con 0 (0XXX)
  if (anio >= 100 && anio <= 999) {
    // Caso: 0201 → probablemente 2001 (se escribió un 0 de más)
    // Convertir a string, quitar el 0 inicial y volver a parsear
    const anioStr = String(anio);
    const anioSinCero = parseInt(anioStr, 10); // Ya es el mismo número
    // Pero lo que queremos es interpretar "0201" como "2" + "01" = 2001
    // O "0214" como "2" + "14" = 2014
    const primerDigito = parseInt(anioStr[0], 10);
    const restante = anioStr.slice(1);
    anio = parseInt(`20${restante}`, 10); // 0201 → 2001, 0214 → 2014
  }
  // Años de 1-2 dígitos (01-99) → 2001-2099
  else if (anio >= 1 && anio <= 99) {
    anio = 2000 + anio;
  }
  // Años 1800-1899 → probablemente 1900-1999 o 2000-2099
  else if (anio >= 1800 && anio <= 1899) {
    // Si es muy antiguo para una cooperativa fundada ~2000, corregir
    // 1897 → 1997 (100 años después)
    anio = anio + 100;
  }

  // Validar rangos finales
  if (dia < 1 || dia > 31 || mes < 0 || mes > 11 || anio < 1900 || anio > 2030) {
    return null;
  }

  const fecha = new Date(anio, mes, dia);
  if (isNaN(fecha.getTime())) return null;

  return fecha;
}

function parsearFechaConCorreccion(
  fechaStr: string | null,
  stats: any
): { fecha: Date | null; corregida: boolean } {
  if (!fechaStr) return { fecha: null, corregida: false };

  const limpia = limpiarTexto(fechaStr);
  if (!limpia) return { fecha: null, corregida: false };

  // Detectar si necesita corrección
  const partes = limpia.split('/');
  if (partes.length === 3) {
    const anioOriginal = parseInt(partes[2], 10);
    const necesitaCorreccion =
      (anioOriginal >= 1 && anioOriginal <= 999) || (anioOriginal >= 1800 && anioOriginal <= 1899);

    const fecha = parsearFecha(fechaStr);

    if (fecha && necesitaCorreccion) {
      stats.fechasCorregidas++;
      return { fecha, corregida: true };
    }

    return { fecha, corregida: false };
  }

  return { fecha: parsearFecha(fechaStr), corregida: false };
}

function normalizarTelefono(telefono: string | null): string | null {
  if (!telefono) return null;
  const limpio = telefono.trim().replace(/[^\d]/g, ''); // Solo dígitos
  if (limpio.length < 7) return null;
  return limpio;
}

function combinarTelefonos(fijo: string | null, movil: string | null): string | null {
  const fijoLimpio = normalizarTelefono(fijo);
  const movilLimpio = normalizarTelefono(movil);

  if (fijoLimpio && movilLimpio && fijoLimpio !== movilLimpio) {
    return `${fijoLimpio} | ${movilLimpio}`;
  }
  return fijoLimpio || movilLimpio;
}

function normalizarEmail(email: string | null): string | null {
  if (!email) return null;
  const limpio = limpiarTexto(email)?.toLowerCase();
  if (!limpio || !limpio.includes('@')) return null;
  return limpio;
}

function parsearSexo(sexo: string | null): Sexo | null {
  if (!sexo) return null;
  const limpio = sexo.trim().toUpperCase();
  if (limpio === 'M' || limpio === 'MASCULINO') return Sexo.M;
  if (limpio === 'F' || limpio === 'FEMENINO') return Sexo.F;
  return null;
}

function determinarEstado(retirado: string | null, fechaRet: string | null): EstadoSocio {
  const esRetirado = retirado?.trim().toLowerCase() === 'si';
  const tieneFechaRetiro = parsearFecha(fechaRet) !== null;
  return esRetirado || tieneFechaRetiro ? EstadoSocio.retirado : EstadoSocio.activo;
}

function generarCodigoSocio(expediente: string | null, codigo: string | null, indice: number): string {
  // Prioridad: expediente > codigo > índice
  const exp = limpiarTexto(expediente);
  if (exp && exp !== '0') return exp;

  const cod = limpiarTexto(codigo);
  if (cod && cod !== '0') return cod;

  // Generar código único basado en índice
  return `SOC${String(indice).padStart(6, '0')}`;
}

// ============================================
// FUNCIÓN PRINCIPAL DE IMPORTACIÓN
// ============================================

async function importarSocios() {
  console.log('🚀 IMPORTACIÓN DE SOCIOS - EXTRACCIÓN COMPLETA');
  console.log('='.repeat(80));

  // Cargar datos
  const dataPath = path.join(__dirname, 'data', 'socios_completo_ajax.json');
  const sociosViejos: SocioViejo[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`📂 Cargados ${sociosViejos.length.toLocaleString()} registros\n`);

  // Estadísticas
  const stats = {
    total: sociosViejos.length,
    importados: 0,
    omitidos: 0,
    errores: 0,
    activos: 0,
    retirados: 0,
    sinCedula: 0,
    sinFechaInscripcion: 0,
    fechasCorregidas: 0,
  };

  const erroresDetallados: Array<{ indice: number; error: string; datos?: any }> = [];
  const omitidos: Array<{ indice: number; razon: string; datos: any }> = [];
  const codigosVistas = new Set<string>(); // Solo para códigos de socio (expediente)

  console.log('⚙️  Procesando socios...\n');

  for (let i = 0; i < sociosViejos.length; i++) {
    const viejo = sociosViejos[i];

    try {
      // Validar cédula (puede ser null, se generará temporal)
      let cedula = validarCedula(viejo.cedula);
      if (!cedula) {
        // Generar cédula temporal única para registros sin cédula válida
        cedula = `TEMP${String(i + 1).padStart(6, '0')}`;
        stats.sinCedula++;
      }

      // Generar código único
      let codigoSocio = generarCodigoSocio(viejo.expediente, viejo.codigo, i + 1);
      let intentos = 0;
      while (codigosVistas.has(codigoSocio) && intentos < 10) {
        codigoSocio = `SOC${String(i + 1).padStart(6, '0')}-${intentos}`;
        intentos++;
      }
      codigosVistas.add(codigoSocio);

      // Mapear campos (usar placeholders si están vacíos)
      const nombre = limpiarTexto(viejo.nombres) || 'SIN NOMBRE';
      const apellido = limpiarTexto(viejo.apellidos) || 'SIN APELLIDO';

      const resultadoFecha = parsearFechaConCorreccion(viejo.fecha_ing, stats);
      const fechaInscripcion = resultadoFecha.fecha;
      
      if (!fechaInscripcion) {
        stats.sinFechaInscripcion++;
        omitidos.push({
          indice: i + 1,
          razon: 'Fecha de inscripción inválida',
          datos: { cedula, expediente: viejo.expediente, fecha_ing: viejo.fecha_ing },
        });
        stats.omitidos++;
        continue;
      }

      const estado = determinarEstado(viejo.retirado, viejo.fecha_ret);
      if (estado === EstadoSocio.activo) stats.activos++;
      else stats.retirados++;

      // Combinar observaciones y motivo
      let notas = limpiarTexto(viejo.observacion);
      const motivo = limpiarTexto(viejo.motivo);
      if (motivo) {
        notas = notas ? `${notas}\n\nMotivo retiro: ${motivo}` : `Motivo retiro: ${motivo}`;
      }
      const fechaRet = parsearFecha(viejo.fecha_ret);
      if (fechaRet) {
        const fechaStr = fechaRet.toISOString().split('T')[0];
        notas = notas
          ? `${notas}\n\nFecha retiro: ${fechaStr}`
          : `Fecha retiro: ${fechaStr}`;
      }

      // Crear socio
      await prisma.socio.create({
        data: {
          codigo_socio: codigoSocio,
          cedula,
          nombre: nombre!,
          apellido: apellido!,
          sexo: parsearSexo(viejo.sexo),
          fecha_nacimiento: parsearFecha(viejo.fecha_nac),
          direccion: limpiarTexto(viejo.direccion),
          telefono: combinarTelefonos(viejo.telefono, viejo.telefono_movil),
          email: normalizarEmail(viejo.correo),
          fecha_inscripcion: fechaInscripcion,
          estado,
          es_delegado: viejo.delegado?.trim().toLowerCase() === 'si',
          autorizado_nombre: limpiarTexto(viejo.autorizado),
          autorizado_cedula: validarCedula(viejo.autorizado_cedula),
          notas,
        },
      });

      stats.importados++;

      // Progreso cada 1000 registros
      if ((i + 1) % 1000 === 0) {
        console.log(`  ✓ Procesados ${(i + 1).toLocaleString()} / ${stats.total.toLocaleString()}`);
      }
    } catch (error: any) {
      stats.errores++;
      erroresDetallados.push({
        indice: i + 1,
        error: error.message,
        datos: {
          cedula: viejo.cedula,
          nombre: viejo.nombres,
          apellido: viejo.apellidos,
        },
      });
    }
  }

  // ============================================
  // REPORTE FINAL
  // ============================================

  console.log('\n\n📊 REPORTE DE IMPORTACIÓN');
  console.log('='.repeat(80));
  console.log(`Total de registros: ${stats.total.toLocaleString()}`);
  console.log(`✅ Importados exitosamente: ${stats.importados.toLocaleString()}`);
  console.log(`   - Activos: ${stats.activos.toLocaleString()}`);
  console.log(`   - Retirados: ${stats.retirados.toLocaleString()}`);
  console.log(`⚠️  Omitidos: ${stats.omitidos.toLocaleString()}`);
  if (stats.sinCedula > 0) {
    console.log(`   - Generadas ${stats.sinCedula} cédulas temporales (TEMP######)`);
  }
  if (stats.fechasCorregidas > 0) {
    console.log(`🔧 Fechas auto-corregidas: ${stats.fechasCorregidas.toLocaleString()} (años 18XX→19XX, 0XXX→20XX)`);
  }
  if (stats.sinFechaInscripcion > 0) {
    console.log(`   - Sin fecha inscripción válida: ${stats.sinFechaInscripcion.toLocaleString()}`);
  }
  console.log(`❌ Errores: ${stats.errores.toLocaleString()}`);

  if (omitidos.length > 0) {
    console.log(`\n📋 Primeros 10 registros omitidos:`);
    omitidos.slice(0, 10).forEach((o) => {
      console.log(`  #${o.indice}: ${o.razon} - ${JSON.stringify(o.datos)}`);
    });
  }

  if (erroresDetallados.length > 0) {
    console.log(`\n❌ Primeros 10 errores:`);
    erroresDetallados.slice(0, 10).forEach((e) => {
      console.log(`  #${e.indice}: ${e.error} - ${JSON.stringify(e.datos)}`);
    });
  }

  // Guardar reporte completo
  const reportePath = path.join(__dirname, 'data', 'reporte_importacion_socios.json');
  fs.writeFileSync(
    reportePath,
    JSON.stringify(
      {
        fecha: new Date().toISOString(),
        estadisticas: stats,
        omitidos,
        errores: erroresDetallados,
      },
      null,
      2
    )
  );

  console.log(`\n✅ Reporte completo guardado: ${reportePath}`);
}

// ============================================
// EJECUTAR
// ============================================

importarSocios()
  .catch((error) => {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
