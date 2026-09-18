// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Suspensión del socio por atraso (Sprint F)
// ============================================
//
// Reglas confirmadas por la cooperativa:
//
//   - Al caer en la SEMANA 6 (cinco vencidas): 3 días de suspensión en salud y
//     funeraria.
//   - Al caer en la SEMANA 11: un mes en funeraria y 7 días en salud. El socio
//     queda suspendido por el plazo más largo.
//   - Los días se cumplen aunque el socio pague por adelantado: la fecha de fin
//     se guarda en `suspendido_hasta` y no se adelanta por pagar.
//   - En la SEMANA 41 el socio pierde los servicios. Eso NO se aplica acá: hoy
//     revisan la lista a mano antes de retirar a nadie, así que el proceso sólo
//     los informa hasta que la cooperativa confirme si quiere que sea
//     automático.
//
// Por defecto el proceso SIMULA: devuelve lo que haría sin tocar nada. Aplicar
// es una decisión explícita de quien lo corre.
//
// Pendiente de confirmar (pregunta 9 al cliente): si el socio sigue sin pagar
// después de cumplir sus días, ¿se lo suspende de nuevo? Mientras tanto queda
// suspendido mientras el atraso siga en 6 semanas o más, y los días vuelven a
// correr sólo cuando pasa de un nivel al siguiente.

import type { Prisma, PrismaClient } from '@prisma/client';
import { atrasoPorSocio, nivelDeAtraso } from './atrasoSociosService';
import { hoyDia } from '../utils/fechaDia';

type Db = PrismaClient | Prisma.TransactionClient;

/** Días de suspensión de cada nivel, confirmados por la cooperativa */
export const DIAS_SUSPENSION = {
  /** Semana 6: 3 días en los dos servicios */
  corta: 3,
  /** Semana 11: un mes en funeraria (y 7 días en salud) */
  larga: 30,
} as const;

export const SEMANAS = { suspension: 6, suspensionLarga: 11, perdida: 41 } as const;

export type AccionMorosidad = 'suspender' | 'extender' | 'reactivar' | 'pierde_servicios';

export interface CambioMorosidad {
  socio_id: number;
  codigo_socio: string;
  socio: string;
  semanas_atraso: number;
  accion: AccionMorosidad;
  estado_anterior: string;
  estado_nuevo: string;
  suspendido_hasta: Date | null;
  motivo: string;
}

const DIA_MS = 86_400_000;

const nivelDeSuspension = (semanas: number): { dias: number; motivo: string } | null => {
  if (semanas >= SEMANAS.suspensionLarga) {
    return {
      dias: DIAS_SUSPENSION.larga,
      motivo: `${semanas} semanas sin pagar: un mes de suspensión en funeraria y 7 días en salud`,
    };
  }
  if (semanas >= SEMANAS.suspension) {
    return { dias: DIAS_SUSPENSION.corta, motivo: `${semanas} semanas sin pagar: 3 días de suspensión` };
  }
  return null;
};

export interface ResultadoMorosidad {
  hasta: Date;
  aplicado: boolean;
  cambios: CambioMorosidad[];
  totales: {
    revisados: number;
    suspender: number;
    extender: number;
    reactivar: number;
    pierden_servicios: number;
  };
}

/**
 * Revisa el atraso de todos los socios y devuelve qué cambiaría. Con
 * `aplicar` escribe el estado, la fecha de fin y el historial; sin él no toca
 * nada, que es como se usa para revisar la lista antes de decidir.
 */
export const revisarMorosidad = async (
  db: Db,
  opciones: { aplicar?: boolean; usuarioId?: number | null; hasta?: Date } = {}
): Promise<ResultadoMorosidad> => {
  const { aplicar = false, usuarioId = null } = opciones;
  const hasta = opciones.hasta ?? hoyDia();

  const atrasos = await atrasoPorSocio(db);
  const socios = await db.socio.findMany({
    where: { id: { in: atrasos.map((a) => a.socio_id) }, estado: { in: ['activo', 'suspendido'] } },
    select: { id: true, codigo_socio: true, nombre: true, apellido: true, estado: true, suspendido_hasta: true },
  });
  const datos = new Map(socios.map((s) => [s.id, s]));

  const cambios: CambioMorosidad[] = [];

  for (const atraso of atrasos) {
    const socio = datos.get(atraso.socio_id);
    if (!socio) continue;

    const base = {
      socio_id: socio.id,
      codigo_socio: socio.codigo_socio,
      socio: `${socio.apellido}, ${socio.nombre}`,
      semanas_atraso: atraso.semanas_atraso,
      estado_anterior: socio.estado,
    };

    // Semana 41: se informa, no se retira solo
    if (atraso.semanas_atraso >= SEMANAS.perdida) {
      cambios.push({
        ...base,
        accion: 'pierde_servicios',
        estado_nuevo: socio.estado,
        suspendido_hasta: socio.suspendido_hasta,
        motivo: `${atraso.semanas_atraso} semanas sin pagar: pierde los servicios (${nivelDeAtraso(atraso.semanas_atraso)?.texto ?? ''})`,
      });
      continue;
    }

    const suspension = nivelDeSuspension(atraso.semanas_atraso);

    if (suspension) {
      const nuevaFecha = new Date(hasta.getTime() + suspension.dias * DIA_MS);
      const yaSuspendido = socio.estado === 'suspendido';
      const diasVigentes = socio.suspendido_hasta !== null && socio.suspendido_hasta > hasta;
      // Suspendido y con días corriendo: no se vuelve a empezar la cuenta
      if (yaSuspendido && diasVigentes) continue;
      // Suspendido, ya cumplió sus días y sigue debiendo lo mismo: se deja como está
      if (yaSuspendido && socio.suspendido_hasta !== null) continue;

      cambios.push({
        ...base,
        accion: yaSuspendido ? 'extender' : 'suspender',
        estado_nuevo: 'suspendido',
        suspendido_hasta: nuevaFecha,
        motivo: suspension.motivo,
      });
      continue;
    }

    // Se puso al día y ya cumplió sus días: vuelve a activo
    if (socio.estado === 'suspendido' && (socio.suspendido_hasta === null || socio.suspendido_hasta <= hasta)) {
      cambios.push({
        ...base,
        accion: 'reactivar',
        estado_nuevo: 'activo',
        suspendido_hasta: null,
        motivo:
          atraso.semanas_atraso === 0
            ? 'Al día y cumplidos los días de suspensión'
            : `${atraso.semanas_atraso} semana(s) de atraso, por debajo de las ${SEMANAS.suspension} que suspenden`,
      });
    }
  }

  if (aplicar) {
    for (const cambio of cambios) {
      if (cambio.accion === 'pierde_servicios') continue;
      await db.socio.update({
        where: { id: cambio.socio_id },
        data: { estado: cambio.estado_nuevo as 'activo' | 'suspendido', suspendido_hasta: cambio.suspendido_hasta },
      });
      await db.historialEstadoSocio.create({
        data: {
          socio_id: cambio.socio_id,
          estado_anterior: cambio.estado_anterior,
          estado_nuevo: cambio.estado_nuevo,
          motivo: cambio.motivo,
          origen: 'automatico',
          semanas_atraso: cambio.semanas_atraso,
          suspendido_hasta: cambio.suspendido_hasta,
          usuario_id: usuarioId,
        },
      });
    }
  }

  const cuantos = (accion: AccionMorosidad) => cambios.filter((c) => c.accion === accion).length;
  return {
    hasta,
    aplicado: aplicar,
    cambios,
    totales: {
      revisados: atrasos.length,
      suspender: cuantos('suspender'),
      extender: cuantos('extender'),
      reactivar: cuantos('reactivar'),
      pierden_servicios: cuantos('pierde_servicios'),
    },
  };
};
