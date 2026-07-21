/**
 * ============================================
 * IMPORTAR CAMPOS ADICIONALES DE SOCIOS
 * ============================================
 * 
 * Actualiza los siguientes campos desde socios_completo_ajax.csv:
 * - fecha_nacimiento
 * - sexo
 * - autorizado_nombre
 * - autorizado_cedula
 * 
 * Basado en el expediente (codigo_socio) para hacer match
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cargar variables de entorno del backend
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') })

import { PrismaClient } from '../../backend/node_modules/@prisma/client/index.js'
import fs from 'fs'

const prisma = new PrismaClient()

interface SocioCSV {
  expediente: string
  sexo: string
  fecha_nac: string
  autorizado: string
  autorizado_cedula: string
}

/**
 * Parsear fecha del formato dd/mm/aaaa a YYYY-MM-DD
 */
function parsearFecha(fechaStr: string): Date | null {
  if (!fechaStr || fechaStr.trim() === '' || fechaStr === '01/01/1900') {
    return null
  }
  
  const partes = fechaStr.trim().split('/')
  if (partes.length !== 3) {
    return null
  }
  
  const [dia, mes, anio] = partes
  const fecha = new Date(`${anio}-${mes}-${dia}`)
  
  // Validar que la fecha es válida
  if (isNaN(fecha.getTime())) {
    return null
  }
  
  // Validar que el año esté en un rango razonable
  const anioNum = parseInt(anio)
  if (anioNum < 1900 || anioNum > 2026) {
    return null
  }
  
  return fecha
}

/**
 * Normalizar sexo
 */
function normalizarSexo(sexo: string): 'M' | 'F' | null {
  if (!sexo) return null
  
  const sexoLimpio = sexo.trim().toUpperCase()
  
  if (sexoLimpio.startsWith('M') || sexoLimpio.includes('MASCULINO')) {
    return 'M'
  }
  
  if (sexoLimpio.startsWith('F') || sexoLimpio.includes('FEMENINO')) {
    return 'F'
  }
  
  return null
}

/**
 * Limpiar texto
 */
function limpiarTexto(texto: string): string | null {
  if (!texto) return null
  
  const limpio = texto.trim()
  
  // Considerar como null si está vacío o tiene solo espacios/ceros
  if (limpio === '' || limpio === '0' || /^0+$/.test(limpio)) {
    return null
  }
  
  return limpio
}

/**
 * Limpiar cédula
 */
function limpiarCedula(cedula: string): string | null {
  if (!cedula) return null
  
  const limpia = cedula.trim().replace(/\D/g, '')
  
  if (limpia === '' || limpia === '0' || /^0+$/.test(limpia)) {
    return null
  }
  
  return limpia
}

/**
 * Leer CSV manualmente (más robusto que csv-parser para datos con saltos de línea)
 */
function leerCSV(rutaArchivo: string): SocioCSV[] {
  const contenido = fs.readFileSync(rutaArchivo, 'utf-8')
  const lineas = contenido.split('\n')
  
  if (lineas.length < 2) {
    throw new Error('CSV vacío o sin datos')
  }
  
  // Parsear header
  const header = lineas[0].split(',')
  const indexExpediente = header.indexOf('expediente')
  const indexSexo = header.indexOf('sexo')
  const indexFechaNac = header.indexOf('fecha_nac')
  const indexAutorizado = header.indexOf('autorizado')
  const indexAutorizadoCedula = header.indexOf('autorizado_cedula')
  
  if (indexExpediente === -1) {
    throw new Error('No se encontró la columna "expediente" en el CSV')
  }
  
  console.log(`\n📋 Índices de columnas:`)
  console.log(`   expediente: ${indexExpediente}`)
  console.log(`   sexo: ${indexSexo}`)
  console.log(`   fecha_nac: ${indexFechaNac}`)
  console.log(`   autorizado: ${indexAutorizado}`)
  console.log(`   autorizado_cedula: ${indexAutorizadoCedula}\n`)
  
  const socios: SocioCSV[] = []
  
  // Parsear datos (empezar desde línea 1, saltando header)
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    if (linea === '') continue
    
    // Split por coma (simple, puede fallar si hay comas dentro de campos)
    const campos = linea.split(',')
    
    if (campos.length < Math.max(indexExpediente, indexSexo, indexFechaNac, indexAutorizado, indexAutorizadoCedula) + 1) {
      console.warn(`⚠️  Línea ${i + 1} tiene menos campos de los esperados, saltando...`)
      continue
    }
    
    const expediente = campos[indexExpediente]?.trim()
    
    if (!expediente) {
      console.warn(`⚠️  Línea ${i + 1} sin expediente, saltando...`)
      continue
    }
    
    socios.push({
      expediente,
      sexo: campos[indexSexo]?.trim() || '',
      fecha_nac: campos[indexFechaNac]?.trim() || '',
      autorizado: campos[indexAutorizado]?.trim() || '',
      autorizado_cedula: campos[indexAutorizadoCedula]?.trim() || '',
    })
  }
  
  return socios
}

/**
 * Importar socios
 */
async function importarCamposAdicionales() {
  console.log('\n=== Importación de Campos Adicionales de Socios ===\n')
  
  const csvPath = path.join(__dirname, 'data', 'socios_completo_ajax.csv')
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ No se encontró el archivo: ${csvPath}`)
    console.error('   Ejecutar primero: node 14-extract-socios-completo-ajax.js')
    process.exit(1)
  }
  
  // Leer CSV
  console.log(`📂 Leyendo archivo: ${csvPath}`)
  const sociosCSV = leerCSV(csvPath)
  console.log(`   ✓ Leídos ${sociosCSV.length} registros del CSV\n`)
  
  // Estadísticas
  let actualizados = 0
  let noEncontrados = 0
  let sinCambios = 0
  let errores = 0
  
  const stats = {
    conFechaNac: 0,
    conSexo: 0,
    conAutorizado: 0,
    conAutorizadoCedula: 0,
  }
  
  // Procesar cada socio
  for (const socioCSV of sociosCSV) {
    try {
      // Buscar socio por código
      const socioExistente = await prisma.socio.findUnique({
        where: { codigo_socio: socioCSV.expediente },
      })
      
      if (!socioExistente) {
        console.log(`⚠️  Socio no encontrado: ${socioCSV.expediente}`)
        noEncontrados++
        continue
      }
      
      // Preparar datos para actualizar
      const datosActualizar: any = {}
      let hayCAmbios = false
      
      // Fecha de nacimiento
      const fechaNac = parsearFecha(socioCSV.fecha_nac)
      if (fechaNac && !socioExistente.fecha_nacimiento) {
        datosActualizar.fecha_nacimiento = fechaNac
        hayCAmbios = true
        stats.conFechaNac++
      }
      
      // Sexo
      const sexo = normalizarSexo(socioCSV.sexo)
      if (sexo && !socioExistente.sexo) {
        datosActualizar.sexo = sexo
        hayCAmbios = true
        stats.conSexo++
      }
      
      // Autorizado nombre
      const autorizadoNombre = limpiarTexto(socioCSV.autorizado)
      if (autorizadoNombre && !socioExistente.autorizado_nombre) {
        datosActualizar.autorizado_nombre = autorizadoNombre
        hayCAmbios = true
        stats.conAutorizado++
      }
      
      // Autorizado cédula
      const autorizadoCedula = limpiarCedula(socioCSV.autorizado_cedula)
      if (autorizadoCedula && !socioExistente.autorizado_cedula) {
        datosActualizar.autorizado_cedula = autorizadoCedula
        hayCAmbios = true
        stats.conAutorizadoCedula++
      }
      
      // Actualizar si hay cambios
      if (hayCAmbios) {
        await prisma.socio.update({
          where: { id: socioExistente.id },
          data: datosActualizar,
        })
        
        actualizados++
        
        // Log cada 10 actualizaciones
        if (actualizados % 10 === 0) {
          console.log(`✓ ${actualizados} socios actualizados...`)
        }
      } else {
        sinCambios++
      }
      
    } catch (error) {
      console.error(`❌ Error al procesar ${socioCSV.expediente}:`, error)
      errores++
    }
  }
  
  // Reporte final
  console.log(`\n=== Resumen de Importación ===\n`)
  console.log(`Total procesados:     ${sociosCSV.length}`)
  console.log(`✅ Actualizados:      ${actualizados}`)
  console.log(`⚠️  No encontrados:    ${noEncontrados}`)
  console.log(`⏭️  Sin cambios:       ${sinCambios}`)
  console.log(`❌ Errores:           ${errores}`)
  console.log(`\n=== Campos Actualizados ===\n`)
  console.log(`📅 Fechas nacimiento: ${stats.conFechaNac}`)
  console.log(`👤 Sexo:              ${stats.conSexo}`)
  console.log(`✍️  Autorizado:        ${stats.conAutorizado}`)
  console.log(`🆔 Cédula autorizado: ${stats.conAutorizadoCedula}`)
  
  // Verificar estado final en la BD
  console.log(`\n=== Verificación Final en BD ===\n`)
  
  const [
    totalSocios,
    conFechaNac,
    conSexo,
    conAutorizado,
    conAutorizadoCedula,
  ] = await Promise.all([
    prisma.socio.count(),
    prisma.socio.count({ where: { fecha_nacimiento: { not: null } } }),
    prisma.socio.count({ where: { sexo: { not: null } } }),
    prisma.socio.count({ where: { autorizado_nombre: { not: null } } }),
    prisma.socio.count({ where: { autorizado_cedula: { not: null } } }),
  ])
  
  console.log(`Total socios en BD:           ${totalSocios}`)
  console.log(`Con fecha_nacimiento:         ${conFechaNac} (${((conFechaNac / totalSocios) * 100).toFixed(2)}%)`)
  console.log(`Con sexo:                     ${conSexo} (${((conSexo / totalSocios) * 100).toFixed(2)}%)`)
  console.log(`Con autorizado_nombre:        ${conAutorizado} (${((conAutorizado / totalSocios) * 100).toFixed(2)}%)`)
  console.log(`Con autorizado_cedula:        ${conAutorizadoCedula} (${((conAutorizadoCedula / totalSocios) * 100).toFixed(2)}%)`)
  
  console.log(`\n✅ Importación completada\n`)
}

// Ejecutar
importarCamposAdicionales()
  .catch((error) => {
    console.error('Error fatal:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
