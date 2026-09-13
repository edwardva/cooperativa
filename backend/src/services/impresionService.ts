// ============================================
// COOPERATIVA EL TRIUNFO - SERVICE
// Motor de Impresión (Tickets y Documentos)
// ============================================

import { PrismaClient } from '@prisma/client';
import { registrarAuditoria } from './auditoriaService';

const prisma = new PrismaClient();

// ============================================
// TIPOS Y CONFIGURACIONES
// ============================================

export interface TicketColecta {
  numero_ticket: string;
  fecha: Date;
  socio: {
    cedula: string;
    nombre: string;
    codigo: string;
  };
  conceptos: {
    tipo: string;
    descripcion: string;
    monto_usd: number;
    monto_bs: number;
  }[];
  total_usd: number;
  total_bs: number;
  tasa_cambio: number;
  cajero: string;
  ubicacion: string;
}

export interface NotaOperacion {
  numero_nota: string;
  fecha: Date;
  tipo_operacion: string;
  socio?: {
    cedula: string;
    nombre: string;
  };
  detalles: string;
  monto?: number;
  moneda?: string;
  usuario: string;
}

export interface CarnetSocio {
  codigo: string;
  cedula: string;
  nombre: string;
  foto_url?: string;
  fecha_ingreso: Date;
  ubicacion: string;
  tipo_socio: string;
  qr_data?: string; // Para futuro: datos del QR
}

export interface FichaAcuerdoBeneficios {
  numero_acuerdo: string;
  numero_contrato?: string;
  fecha_inicio: Date;
  socio: {
    codigo: string;
    cedula: string;
    nombre: string;
    direccion?: string;
    telefono?: string;
  };
  beneficiarios: {
    id: number;
    nombre: string;
    cedula: string;
    parentesco: string;
    fecha_ingreso: Date;
    fecha_nacimiento?: Date;
    edad?: number;
    estado?: string;
  }[];
}

// Alias histórico: la ficha de Funeraria fue la primera en usar este shape.
export type FichaAcuerdoFuneraria = FichaAcuerdoBeneficios;
export type FichaAcuerdoSalud = FichaAcuerdoBeneficios;

// ============================================
// CONSTANTES DE FORMATO
// ============================================

const ANCHO_TICKET_80MM = 48; // Caracteres en 80mm
const SEPARADOR = '='.repeat(ANCHO_TICKET_80MM);
const SEPARADOR_LIGERO = '-'.repeat(ANCHO_TICKET_80MM);

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Centra texto en el ancho del ticket
 */
function centrarTexto(texto: string, ancho: number = ANCHO_TICKET_80MM): string {
  if (texto.length >= ancho) return texto;
  const espacios = Math.floor((ancho - texto.length) / 2);
  return ' '.repeat(espacios) + texto;
}

/**
 * Formatea línea con concepto y monto
 */
function formatearLineaConcepto(concepto: string, monto: string, ancho: number = ANCHO_TICKET_80MM): string {
  const espaciosDisponibles = ancho - concepto.length - monto.length;
  if (espaciosDisponibles > 0) {
    return concepto + ' '.repeat(espaciosDisponibles) + monto;
  }
  // Si no cabe, truncar concepto
  const conceptoTruncado = concepto.substring(0, ancho - monto.length - 3) + '...';
  return conceptoTruncado + monto;
}

/**
 * Formatea monto con separador de miles y decimales
 */
function formatearMonto(monto: number, decimales: number = 2): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  }).format(monto);
}

/**
 * Formatea fecha y hora
 */
function formatearFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(fecha);
}

// ============================================
// GENERADORES DE TICKETS
// ============================================

/**
 * Genera ticket térmico de colecta (80mm)
 */
export function generarTicketColecta(data: TicketColecta): string {
  const lineas: string[] = [];

  // Header
  lineas.push('');
  lineas.push(centrarTexto('COOPERATIVA EL TRIUNFO, R.L.'));
  lineas.push(centrarTexto('RIF: J-00000000-0'));
  lineas.push(centrarTexto(data.ubicacion));
  lineas.push('');
  lineas.push(SEPARADOR);
  lineas.push(centrarTexto('COMPROBANTE DE COLECTA'));
  lineas.push(SEPARADOR);
  lineas.push('');

  // Información del ticket
  lineas.push(`Ticket: ${data.numero_ticket}`);
  lineas.push(`Fecha:  ${formatearFechaHora(data.fecha)}`);
  lineas.push('');
  lineas.push(SEPARADOR_LIGERO);

  // Información del socio
  lineas.push(`Socio:  ${data.socio.codigo}`);
  lineas.push(`Cedula: ${data.socio.cedula}`);
  lineas.push(`Nombre: ${data.socio.nombre}`);
  lineas.push('');
  lineas.push(SEPARADOR_LIGERO);

  // Conceptos
  lineas.push('CONCEPTOS:');
  lineas.push('');
  
  data.conceptos.forEach(concepto => {
    lineas.push(concepto.descripcion);
    lineas.push(formatearLineaConcepto(
      `  USD:`,
      `$${formatearMonto(concepto.monto_usd)}`
    ));
    lineas.push(formatearLineaConcepto(
      `  Bs:`,
      `${formatearMonto(concepto.monto_bs)} Bs`
    ));
    lineas.push('');
  });

  lineas.push(SEPARADOR_LIGERO);

  // Totales
  lineas.push(formatearLineaConcepto(
    'TOTAL USD:',
    `$${formatearMonto(data.total_usd)}`
  ));
  lineas.push(formatearLineaConcepto(
    'TOTAL Bs:',
    `${formatearMonto(data.total_bs)} Bs`
  ));
  lineas.push('');
  lineas.push(formatearLineaConcepto(
    'Tasa del dia:',
    `${formatearMonto(data.tasa_cambio, 4)} Bs/$`
  ));
  lineas.push('');
  lineas.push(SEPARADOR);

  // Footer
  lineas.push('');
  lineas.push(centrarTexto('Gracias por su preferencia'));
  lineas.push(centrarTexto('www.cooptriunfo.org'));
  lineas.push('');
  lineas.push(`Cajero: ${data.cajero}`);
  lineas.push('');
  lineas.push('');
  lineas.push('');

  return lineas.join('\n');
}

/**
 * Genera nota de operación (formato estándar)
 */
export function generarNotaOperacion(data: NotaOperacion): string {
  const lineas: string[] = [];

  // Header
  lineas.push('');
  lineas.push(centrarTexto('COOPERATIVA EL TRIUNFO, R.L.'));
  lineas.push(centrarTexto('RIF: J-00000000-0'));
  lineas.push('');
  lineas.push(SEPARADOR);
  lineas.push(centrarTexto('NOTA DE OPERACIÓN'));
  lineas.push(SEPARADOR);
  lineas.push('');

  // Información
  lineas.push(`Nota No:    ${data.numero_nota}`);
  lineas.push(`Fecha:      ${formatearFechaHora(data.fecha)}`);
  lineas.push(`Operación:  ${data.tipo_operacion}`);
  lineas.push('');

  if (data.socio) {
    lineas.push(SEPARADOR_LIGERO);
    lineas.push(`Socio:      ${data.socio.nombre}`);
    lineas.push(`Cédula:     ${data.socio.cedula}`);
    lineas.push('');
  }

  lineas.push(SEPARADOR_LIGERO);
  lineas.push('DETALLES:');
  lineas.push('');
  lineas.push(data.detalles);
  lineas.push('');

  if (data.monto && data.moneda) {
    lineas.push(SEPARADOR_LIGERO);
    lineas.push(formatearLineaConcepto(
      'MONTO:',
      `${formatearMonto(data.monto)} ${data.moneda}`
    ));
    lineas.push('');
  }

  lineas.push(SEPARADOR);
  lineas.push('');
  lineas.push(`Usuario: ${data.usuario}`);
  lineas.push('');
  lineas.push('');
  lineas.push('_____________________    _____________________');
  lineas.push('     Recibido                 Autorizado');
  lineas.push('');
  lineas.push('');

  return lineas.join('\n');
}

/**
 * Genera plantilla de carnet de socio (texto)
 */
export function generarCarnetSocio(data: CarnetSocio): string {
  const lineas: string[] = [];

  lineas.push('');
  lineas.push(SEPARADOR);
  lineas.push(centrarTexto('COOPERATIVA EL TRIUNFO, R.L.'));
  lineas.push(centrarTexto('CARNET DE SOCIO'));
  lineas.push(SEPARADOR);
  lineas.push('');
  lineas.push(`Código:        ${data.codigo}`);
  lineas.push(`Cédula:        ${data.cedula}`);
  lineas.push(`Nombre:        ${data.nombre}`);
  lineas.push(`Tipo:          ${data.tipo_socio}`);
  lineas.push(`Ubicación:     ${data.ubicacion}`);
  lineas.push(`Fecha Ingreso: ${formatearFechaHora(data.fecha_ingreso)}`);
  lineas.push('');
  
  if (data.qr_data) {
    lineas.push(centrarTexto('[CÓDIGO QR]'));
    lineas.push(centrarTexto(data.qr_data));
    lineas.push('');
  }

  lineas.push(SEPARADOR);
  lineas.push(centrarTexto('www.cooptriunfo.org'));
  lineas.push('');

  return lineas.join('\n');
}

/**
 * Genera ficha imprimible de un acuerdo (socio/titular + beneficiarios
 * cubiertos), compartida entre Funeraria y Salud.
 */
export function generarFichaAcuerdoBeneficios(data: FichaAcuerdoBeneficios, tituloServicio: 'FUNERARIA' | 'SALUD'): string {
  const lineas: string[] = [];

  lineas.push('');
  lineas.push(centrarTexto('COOPERATIVA EL TRIUNFO, R.L.'));
  lineas.push(centrarTexto('RIF: J-00000000-0'));
  lineas.push('');
  lineas.push(SEPARADOR);
  lineas.push(centrarTexto(`FICHA DE ACUERDO - ${tituloServicio}`));
  lineas.push(SEPARADOR);
  lineas.push('');

  lineas.push(`N. Acuerdo:  ${data.numero_acuerdo}`);
  if (data.numero_contrato) {
    lineas.push(`N. Contrato: ${data.numero_contrato}`);
  }
  lineas.push(`Fecha Inicio: ${formatearFechaHora(data.fecha_inicio)}`);
  lineas.push('');
  lineas.push(SEPARADOR_LIGERO);

  lineas.push('DATOS DEL TITULAR');
  lineas.push(`Expediente: ${data.socio.codigo}`);
  lineas.push(`Cédula:     ${data.socio.cedula}`);
  lineas.push(`Nombre:     ${data.socio.nombre}`);
  if (data.socio.direccion) {
    lineas.push(`Dirección:  ${data.socio.direccion}`);
  }
  if (data.socio.telefono) {
    lineas.push(`Teléfono:   ${data.socio.telefono}`);
  }
  lineas.push('');
  lineas.push(SEPARADOR_LIGERO);

  lineas.push('BENEFICIARIOS CON DERECHO AL SERVICIO');
  lineas.push('');

  data.beneficiarios.forEach((beneficiario) => {
    lineas.push(`[${beneficiario.id}] ${beneficiario.nombre}`);
    lineas.push(`    Cédula: ${beneficiario.cedula}   Parentesco: ${beneficiario.parentesco}`);
    const edadTexto = beneficiario.edad !== undefined ? `${beneficiario.edad} años` : 'N/D';
    const fechaNacTexto = beneficiario.fecha_nacimiento
      ? formatearFechaHora(beneficiario.fecha_nacimiento).split(',')[0]
      : 'N/D';
    lineas.push(`    Nacimiento: ${fechaNacTexto}   Edad: ${edadTexto}`);
    lineas.push(`    Ingreso: ${formatearFechaHora(beneficiario.fecha_ingreso).split(',')[0]}`);
    if (beneficiario.estado && beneficiario.estado !== 'activo') {
      lineas.push(`    Estado: ${beneficiario.estado.toUpperCase()}`);
    }
    lineas.push('');
  });

  lineas.push(SEPARADOR);
  lineas.push('');
  lineas.push('_____________________    _____________________');
  lineas.push('     Firma Socio             Firma Cooperativa');
  lineas.push('');
  lineas.push('');

  return lineas.join('\n');
}

/** Ficha de acuerdo de funeraria (socio + beneficiarios cubiertos). */
export function generarFichaAcuerdoFuneraria(data: FichaAcuerdoFuneraria): string {
  return generarFichaAcuerdoBeneficios(data, 'FUNERARIA');
}

/** Ficha de acuerdo de salud (titular + beneficiarios del mismo número de acuerdo). */
export function generarFichaAcuerdoSalud(data: FichaAcuerdoSalud): string {
  return generarFichaAcuerdoBeneficios(data, 'SALUD');
}

// ============================================
// FUNCIONES DE GUARDADO
// ============================================

/**
 * Registra una impresión en el log de auditoría
 */
export async function registrarImpresion(
  tipo: string,
  referencia_id: number,
  usuario_id: number,
  contenido: string
): Promise<void> {
  await registrarAuditoria(prisma, {
    usuarioId: usuario_id,
    accion: 'IMPRIMIR',
    modulo: tipo,
    registro_id: referencia_id,
    despues: {
      contenido_longitud: contenido.length,
      fecha_impresion: new Date().toISOString()
    },
  });
}

// ============================================
// EXPORTAR TODO
// ============================================

export default {
  generarTicketColecta,
  generarNotaOperacion,
  generarCarnetSocio,
  generarFichaAcuerdoFuneraria,
  generarFichaAcuerdoSalud,
  registrarImpresion
};
