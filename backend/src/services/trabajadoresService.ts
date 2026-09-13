// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Expediente de trabajador: vistas derivadas
// ============================================
//
// Tres datos del trabajador no se guardan, se derivan, para que no puedan
// quedar desincronizados:
//
//   - Feria actual: la asociación con `fecha_fin` nula.
//   - Salud: RF-SER-05 la da por el solo hecho de ser trabajador ACTIVO con
//     feria. Suspendido, retirado o sin feria, no tiene. (La cooperativa no
//     confirmó si el retirado la conserva un tiempo: pendiente 11.)
//   - Período de prueba: sale de la fecha de ingreso y del parámetro de meses.

import type { EstadoTrabajador, Prisma, PrismaClient } from '@prisma/client';
import { leerParametroNumerico } from './tarifasService';
import { situacionPrueba } from '../utils/periodoPrueba';
import { textoDia } from '../utils/fechaDia';

export const mesesDePrueba = (): Promise<number> => leerParametroNumerico('MESES_PRUEBA_TRABAJADOR');

export const includeFerias = {
  orderBy: { fecha_inicio: 'desc' },
  include: { feria: { select: { id: true, codigo: true, nombre: true } } },
} satisfies Prisma.SocioTrabajador$feriasArgs;

export const includeTrabajador = {
  persona: {
    select: {
      id: true,
      tipo_identificacion: true,
      numero_identificacion: true,
      nombres: true,
      apellidos: true,
      telefono: true,
    },
  },
  ferias: includeFerias,
} satisfies Prisma.SocioTrabajadorInclude;

interface FeriaResumen {
  id: number;
  codigo: string;
  nombre: string;
}

interface TrabajadorBase {
  estado: EstadoTrabajador;
  fecha_ingreso: Date;
  ferias: { fecha_inicio: Date; fecha_fin: Date | null; feria: FeriaResumen }[];
}

export const saludDelTrabajador = (estado: EstadoTrabajador, feria: FeriaResumen | null) => {
  if (estado === 'activo' && feria) {
    return { asignada: true, detalle: `Asignada automáticamente por la feria ${feria.codigo}` };
  }
  if (estado === 'activo') return { asignada: false, detalle: 'Sin salud: el trabajador no tiene feria' };
  return { asignada: false, detalle: `Sin salud: trabajador ${estado}` };
};

export const formatearTrabajador = <T extends TrabajadorBase>(trabajador: T, meses: number, hoy: Date = new Date()) => {
  const abierta = trabajador.ferias.find((f) => f.fecha_fin === null) ?? null;
  const prueba = situacionPrueba(trabajador.fecha_ingreso, meses, hoy);

  return {
    ...trabajador,
    feria_actual: abierta ? { ...abierta.feria, desde: abierta.fecha_inicio } : null,
    salud: saludDelTrabajador(trabajador.estado, abierta?.feria ?? null),
    prueba: { ...prueba, meses },
  };
};

/**
 * HU-04, criterio 6: al inscribir como ahorrista a quien todavía está en
 * prueba se ADVIERTE, no se bloquea. La decisión es de la persona que atiende.
 */
export const advertenciasParaAhorrista = async (
  db: PrismaClient | Prisma.TransactionClient,
  personaId: number
): Promise<string[]> => {
  const trabajadores = await db.socioTrabajador.findMany({
    where: { persona_id: personaId, estado: { not: 'retirado' } },
  });
  if (trabajadores.length === 0) return [];

  const meses = await mesesDePrueba();
  return trabajadores
    .map((t) => ({ t, prueba: situacionPrueba(t.fecha_ingreso, meses) }))
    .filter(({ prueba }) => !prueba.cumplida)
    .map(
      ({ t, prueba }) =>
        `Es trabajador (${t.codigo_trabajador}) y todavía no cumple los ${meses} meses de prueba: ` +
        `termina el ${textoDia(prueba.fin_prueba).split('-').reverse().join('/')}.`
    );
};
