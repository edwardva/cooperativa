// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Expediente de trabajador: vistas derivadas
// ============================================
//
// Dos datos del trabajador no se guardan, se derivan, para que no puedan
// quedar desincronizados:
//
//   - Feria actual: la asociación con `fecha_fin` nula.
//   - Salud: RF-SER-05 la da por el solo hecho de ser trabajador ACTIVO con
//     feria. Suspendido, retirado o sin feria, no tiene. Confirmado por la
//     cooperativa: el retirado la pierde, salvo que además sea socio, y ahí
//     sigue con los servicios de su expediente de socio.
//
// El período de prueba de 90 días no lo controla el sistema (confirmado): la
// feria manda a su trabajador a inscribirse como ahorrista cuando corresponde.

import type { EstadoTrabajador, Prisma } from '@prisma/client';

export const includeFerias = {
  orderBy: { fecha_inicio: 'desc' },
  include: { feria: { select: { id: true, codigo: true, nombre: true, direccion: true } } },
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
  direccion: string | null;
}

/** Cómo se nombra una feria ante el usuario: por su dirección, igual que en el resto del sistema */
export const etiquetaFeria = (f: { codigo: string; nombre: string; direccion?: string | null }): string =>
  f.direccion?.trim() || f.nombre || f.codigo;

interface TrabajadorBase {
  estado: EstadoTrabajador;
  fecha_ingreso: Date;
  ferias: { fecha_inicio: Date; fecha_fin: Date | null; feria: FeriaResumen }[];
}

export const saludDelTrabajador = (estado: EstadoTrabajador, feria: FeriaResumen | null) => {
  if (estado === 'activo' && feria) {
    return { asignada: true, detalle: `Asignada automáticamente por la feria ${etiquetaFeria(feria)}` };
  }
  if (estado === 'activo') return { asignada: false, detalle: 'Sin salud: el trabajador no tiene feria' };
  return { asignada: false, detalle: `Sin salud: trabajador ${estado}` };
};

export const formatearTrabajador = <T extends TrabajadorBase>(trabajador: T) => {
  const abierta = trabajador.ferias.find((f) => f.fecha_fin === null) ?? null;

  return {
    ...trabajador,
    feria_actual: abierta ? { ...abierta.feria, desde: abierta.fecha_inicio } : null,
    salud: saludDelTrabajador(trabajador.estado, abierta?.feria ?? null),
  };
};
