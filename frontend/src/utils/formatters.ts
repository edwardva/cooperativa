/**
 * Formatea una fecha de formato ISO (YYYY-MM-DD) a formato legible (dd/mm/aaaa)
 * @param fechaISO Fecha en formato YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss
 * @returns Fecha formateada como dd/mm/aaaa o cadena vacía si es inválida
 */
export function formatearFecha(fechaISO: string | null | undefined): string {
  if (!fechaISO) return ''
  
  try {
    // Extraer solo la parte de la fecha si viene con hora
    const soloFecha = fechaISO.split('T')[0] ?? ''

    // Validar formato YYYY-MM-DD
    const regex = /^(\d{4})-(\d{2})-(\d{2})$/
    const match = soloFecha.match(regex)
    
    if (!match) return ''
    
    const [, anio, mes, dia] = match as unknown as [string, string, string, string]

    // Validar que sean números válidos
    const diaNum = parseInt(dia, 10)
    const mesNum = parseInt(mes, 10)
    const anioNum = parseInt(anio, 10)
    
    if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12 || anioNum < 1900) {
      return ''
    }
    
    return `${dia}/${mes}/${anio}`
  } catch (error) {
    console.error('Error al formatear fecha:', error)
    return ''
  }
}

/**
 * Convierte una fecha de formato dd/mm/aaaa a formato ISO (YYYY-MM-DD)
 * @param fechaDDMMYYYY Fecha en formato dd/mm/aaaa
 * @returns Fecha en formato YYYY-MM-DD o cadena vacía si es inválida
 */
export function parsearFecha(fechaDDMMYYYY: string): string {
  if (!fechaDDMMYYYY) return ''
  
  try {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/
    const match = fechaDDMMYYYY.match(regex)
    
    if (!match) return ''
    
    const [, dia, mes, anio] = match
    
    return `${anio}-${mes}-${dia}`
  } catch (error) {
    console.error('Error al parsear fecha:', error)
    return ''
  }
}

/**
 * Calcula la edad en años a partir de una fecha de nacimiento
 * @param fechaNacimiento Fecha en formato ISO (YYYY-MM-DD o con hora)
 * @returns Edad en años, o null si la fecha es inválida
 */
export function calcularEdad(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null

  const nacimiento = new Date(fechaNacimiento)
  if (isNaN(nacimiento.getTime())) return null

  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mesDiff = hoy.getMonth() - nacimiento.getMonth()

  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--
  }

  return edad >= 0 ? edad : null
}

/**
 * Normaliza una fecha para inputs type="date"
 * Extrae solo la parte YYYY-MM-DD de cualquier formato ISO
 * @param fechaISO Fecha en formato YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss.sssZ
 * @returns Fecha en formato YYYY-MM-DD o cadena vacía si es inválida
 */
export function normalizarFechaParaInput(fechaISO: string | null | undefined): string {
  if (!fechaISO) return ''
  
  try {
    // Si viene con timestamp, extraer solo la parte de fecha
    const soloFecha = fechaISO.split('T')[0] ?? ''

    // Validar formato YYYY-MM-DD
    const regex = /^(\d{4})-(\d{2})-(\d{2})$/
    if (regex.test(soloFecha)) {
      return soloFecha
    }
    
    return ''
  } catch (error) {
    console.error('Error al normalizar fecha:', error)
    return ''
  }
}
