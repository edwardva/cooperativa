// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Semanas de atraso de cada socio
// ============================================
//
// Reglas confirmadas por la cooperativa: el atraso se cuenta sin pagar NADA de
// la colecta, porque salud y funeraria van juntas y no se pagan por separado.
// Al caer en la semana 6 hay 3 días de suspensión; en la 11, un mes en
// funeraria y 7 días en salud; en la 41 el socio lo pierde todo.
//
// El número sale de la COBERTURA de sus acuerdos —hasta qué semana pagó—, que
// es la misma fuente que usa la colecta. De un socio se toma la cobertura más
// adelantada: si pagó, pagó todo junto.
//
// Lo usan el reporte de atraso y el proceso de morosidad, para que los dos
// digan exactamente lo mismo.

import type { Prisma, PrismaClient } from '@prisma/client';
import { coberturaDe, semanasSinPagoDerivadas, type AcuerdoConCobertura } from './coberturaService';
import { aOrdinal, semanaActual, type Periodo } from '../utils/calendarioSemanal';

type Db = PrismaClient | Prisma.TransactionClient;

export const NIVELES_ATRASO = [
  { clave: '41', desde: 41, hasta: Infinity, texto: 'Semana 41 o más: pierde los servicios' },
  { clave: '36', desde: 36, hasta: 40, texto: 'Próximo a la semana 41' },
  { clave: '11', desde: 11, hasta: 35, texto: 'Suspensión de 1 mes en funeraria y 7 días en salud' },
  { clave: '6', desde: 6, hasta: 10, texto: 'Suspensión de 3 días' },
  { clave: '1', desde: 1, hasta: 5, texto: 'Atrasado' },
] as const;

export type ClaveNivel = (typeof NIVELES_ATRASO)[number]['clave'];

export const nivelDeAtraso = (semanas: number) =>
  NIVELES_ATRASO.find((n) => semanas >= n.desde && semanas <= n.hasta);

export interface AtrasoDeSocio {
  socio_id: number;
  cobertura: Periodo;
  /** 'Funeraria', 'Salud' */
  servicios: string[];
  /** Alguno de sus acuerdos ya figura suspendido */
  suspendido: boolean;
  semanas_atraso: number;
}

const CAMPOS = {
  ano_pagado_hasta: true,
  semana_pagada_hasta: true,
  fecha_ultimo_pago: true,
  semanas_sin_pago: true,
  fecha_inicio: true,
  estado: true,
  beneficiario: { select: { socio_id: true } },
} as const;

/** Atraso de cada socio que tiene acuerdos vigentes, sin filtrar por nivel */
export const atrasoPorSocio = async (db: Db, hoy: Periodo = semanaActual()): Promise<AtrasoDeSocio[]> => {
  const vigentes = { estado: { in: ['activo' as const, 'suspendido' as const] } };
  const [funerarias, saludes] = await Promise.all([
    db.acuerdoFuneraria.findMany({ where: vigentes, select: CAMPOS }),
    db.acuerdoSalud.findMany({ where: vigentes, select: CAMPOS }),
  ]);

  const porSocio = new Map<number, { cobertura: Periodo; servicios: Set<string>; suspendido: boolean }>();
  const sumar = (servicio: string, a: AcuerdoConCobertura & { beneficiario: { socio_id: number } }) => {
    const cobertura = coberturaDe(a, hoy);
    if (!cobertura) return;
    const previo = porSocio.get(a.beneficiario.socio_id);
    if (!previo) {
      porSocio.set(a.beneficiario.socio_id, {
        cobertura,
        servicios: new Set([servicio]),
        suspendido: a.estado === 'suspendido',
      });
      return;
    }
    if (aOrdinal(cobertura) > aOrdinal(previo.cobertura)) previo.cobertura = cobertura;
    previo.servicios.add(servicio);
    previo.suspendido ||= a.estado === 'suspendido';
  };
  funerarias.forEach((a) => sumar('Funeraria', a));
  saludes.forEach((a) => sumar('Salud', a));

  return [...porSocio.entries()].map(([socio_id, s]) => ({
    socio_id,
    cobertura: s.cobertura,
    servicios: [...s.servicios],
    suspendido: s.suspendido,
    semanas_atraso: semanasSinPagoDerivadas(s.cobertura, hoy),
  }));
};
