/**
 * Filas del listado de acuerdos de funeraria (sin paginar). La misma consulta
 * alimenta la hoja de impresión, la vista previa del reporte y el Excel, así
 * que lo que se ve en pantalla es exactamente lo que se descarga.
 */
import { prisma } from '../lib/prisma';

export type EstadoListadoFuneraria = 'activo' | 'suspendido' | 'retirado' | 'todos';

export interface FilaListadoFuneraria {
  expediente: string;
  numero_acuerdo: string;
  apellidos: string;
  nombres: string;
  cedula: string;
  telefono: string;
  semanas_atraso: number;
  estado: string;
  fecha_inicio: Date;
  fecha_retiro: Date | null;
}

export async function listarAcuerdosFunerariaParaListado(estado: EstadoListadoFuneraria): Promise<FilaListadoFuneraria[]> {
  const acuerdos = await prisma.acuerdoFuneraria.findMany({
    where: estado === 'todos' ? {} : { estado },
    include: { beneficiario: { include: { socio: true } } },
    orderBy:
      estado === 'suspendido'
        ? [{ semanas_sin_pago: 'desc' }, { numero_acuerdo: 'asc' }]
        : [{ beneficiario: { socio: { codigo_socio: 'asc' } } }, { numero_acuerdo: 'asc' }],
  });

  return acuerdos.map((acuerdo) => ({
    expediente: acuerdo.beneficiario.socio?.codigo_socio || 'N/D',
    numero_acuerdo: acuerdo.numero_acuerdo || 'N/D',
    apellidos: acuerdo.beneficiario.socio?.apellido || acuerdo.beneficiario.apellido,
    nombres: acuerdo.beneficiario.socio?.nombre || acuerdo.beneficiario.nombre,
    cedula: acuerdo.beneficiario.socio?.cedula || acuerdo.beneficiario.cedula,
    telefono: acuerdo.beneficiario.socio?.telefono || acuerdo.beneficiario.telefono || 'N/D',
    semanas_atraso: acuerdo.semanas_sin_pago,
    estado: acuerdo.estado,
    fecha_inicio: acuerdo.fecha_inicio,
    fecha_retiro: acuerdo.fecha_retiro,
  }));
}
