// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Suspensión y retiro del socio por atraso (Sprint F)
// ============================================
//
// Reglas confirmadas por la cooperativa (16 y 18 de septiembre de 2026):
//
//   - Al caer en la SEMANA 6 (cinco vencidas): 3 días de suspensión en salud y
//     funeraria.
//   - Al caer en la SEMANA 11: un mes en funeraria y 7 días en salud. El socio
//     queda suspendido por el plazo más largo.
//   - El sistema muestra desde cuándo y hasta cuándo. Los días se cumplen aunque
//     el socio pague por adelantado; mientras tanto puede pagar su colecta, lo
//     que no puede es recibir los servicios.
//   - Si cumple los días y sigue sin pagar, SIGUE SUSPENDIDO de corrido.
//   - En la SEMANA 41 se lo retira AUTOMÁTICAMENTE por el artículo 5, literal c
//     del estatuto (pasividad mayor a seis meses): pierde sus acuerdos de salud y
//     funeraria. El expediente queda guardado como retirado y, si vuelve, entra
//     con número nuevo. Su ahorro se le entrega si lo busca dentro del año; si
//     debe un préstamo, se lleva a la reunión de delegados. Queda un reporte de
//     esos retiros para archivar.
//
// Por defecto el proceso SIMULA: devuelve lo que haría sin tocar nada. Aplicar
// es una decisión explícita de quien lo corre.

import type { Prisma, PrismaClient } from '@prisma/client';
import { atrasoPorSocio } from './atrasoSociosService';
import { hoyDia, textoDia } from '../utils/fechaDia';

type Db = PrismaClient | Prisma.TransactionClient;

/** Días de suspensión de cada nivel, confirmados por la cooperativa */
export const DIAS_SUSPENSION = {
  /** Semana 6: 3 días en los dos servicios */
  corta: 3,
  /** Semana 11: un mes en funeraria (y 7 días en salud) */
  larga: 30,
} as const;

export const SEMANAS = { suspension: 6, suspensionLarga: 11, retiro: 41 } as const;

/** Motivo del retiro de la semana 41, tal como lo dice el estatuto */
export const MOTIVO_RETIRO = 'Artículo 5, literal c: pasividad mayor a seis meses';
/** Cómo lo guardan los acuerdos de salud y funeraria (ya era una de sus opciones) */
export const MOTIVO_RETIRO_ACUERDO = 'Art. 5';
/** Plazo para retirar el ahorro después del retiro por la semana 41 */
export const DIAS_PARA_RETIRAR_AHORRO = 365;

export type AccionMorosidad = 'suspender' | 'extender' | 'reactivar' | 'retirar';

export interface CambioMorosidad {
  socio_id: number;
  codigo_socio: string;
  socio: string;
  semanas_atraso: number;
  accion: AccionMorosidad;
  estado_anterior: string;
  estado_nuevo: string;
  suspendido_desde: Date | null;
  suspendido_hasta: Date | null;
  motivo: string;
  /** Sólo en los retiros: lo que queda para devolverle y lo que debe */
  ahorro_usd?: number;
  prestamos_abiertos?: number;
}

const DIA_MS = 86_400_000;
const redondear = (v: number) => Math.round(v * 100) / 100;
const dias = (desde: Date, hasta: Date) => Math.round((hasta.getTime() - desde.getTime()) / DIA_MS);

const suspensionQueCorresponde = (semanas: number): { dias: number; motivo: string } | null => {
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
    retirar: number;
  };
}

/**
 * Revisa el atraso de todos los socios y devuelve qué cambiaría. Con
 * `aplicar` escribe estados, fechas, retiros e historial; sin él no toca nada.
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
    select: {
      id: true, codigo_socio: true, nombre: true, apellido: true, estado: true, notas: true,
      suspendido_desde: true, suspendido_hasta: true,
    },
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

    // --- Semana 41: retiro automático por el artículo 5 ---
    if (atraso.semanas_atraso >= SEMANAS.retiro) {
      cambios.push({
        ...base,
        accion: 'retirar',
        estado_nuevo: 'retirado',
        suspendido_desde: null,
        suspendido_hasta: null,
        motivo: `${MOTIVO_RETIRO} (${atraso.semanas_atraso} semanas sin pagar)`,
      });
      continue;
    }

    const suspension = suspensionQueCorresponde(atraso.semanas_atraso);
    if (suspension) {
      if (socio.estado !== 'suspendido') {
        cambios.push({
          ...base,
          accion: 'suspender',
          estado_nuevo: 'suspendido',
          suspendido_desde: hasta,
          suspendido_hasta: new Date(hasta.getTime() + suspension.dias * DIA_MS),
          motivo: suspension.motivo,
        });
        continue;
      }
      // Ya suspendido: sigue de corrido. Sólo cambia si llegó a la semana 11 y
      // lo que corre todavía es la suspensión corta
      const desde = socio.suspendido_desde ?? hasta;
      const largoActual = socio.suspendido_hasta ? dias(desde, socio.suspendido_hasta) : 0;
      if (suspension.dias > largoActual) {
        const nuevaFin = new Date(hasta.getTime() + suspension.dias * DIA_MS);
        const fin = socio.suspendido_hasta && socio.suspendido_hasta > nuevaFin ? socio.suspendido_hasta : nuevaFin;
        cambios.push({
          ...base,
          accion: 'extender',
          estado_nuevo: 'suspendido',
          suspendido_desde: desde,
          suspendido_hasta: fin,
          motivo: suspension.motivo,
        });
      }
      continue;
    }

    // Se puso al día y ya cumplió sus días: vuelve a activo
    if (socio.estado === 'suspendido' && (socio.suspendido_hasta === null || socio.suspendido_hasta <= hasta)) {
      cambios.push({
        ...base,
        accion: 'reactivar',
        estado_nuevo: 'activo',
        suspendido_desde: null,
        suspendido_hasta: null,
        motivo:
          atraso.semanas_atraso === 0
            ? 'Al día y cumplidos los días de suspensión'
            : `${atraso.semanas_atraso} semana(s) de atraso, por debajo de las ${SEMANAS.suspension} que suspenden`,
      });
    }
  }

  // Lo que le queda por devolver y lo que debe cada retirado, para el reporte
  const retirados = cambios.filter((c) => c.accion === 'retirar');
  if (retirados.length > 0) {
    const ids = retirados.map((c) => c.socio_id);
    const [ahorros, prestamos] = await Promise.all([
      db.cuentaAhorro.groupBy({ by: ['socio_id'], where: { socio_id: { in: ids } }, _sum: { saldo_usd: true } }),
      db.prestamo.groupBy({
        by: ['socio_id'],
        where: { socio_id: { in: ids }, estado: { in: ['solicitado', 'aprobado', 'activo', 'moroso'] } },
        _count: { _all: true },
      }),
    ]);
    const ahorroDe = new Map(ahorros.map((a) => [a.socio_id, redondear(Number(a._sum.saldo_usd ?? 0))]));
    const prestamosDe = new Map(prestamos.map((p) => [p.socio_id, p._count._all]));
    for (const c of retirados) {
      c.ahorro_usd = ahorroDe.get(c.socio_id) ?? 0;
      c.prestamos_abiertos = prestamosDe.get(c.socio_id) ?? 0;
    }
  }

  if (aplicar) {
    for (const cambio of cambios) {
      if (cambio.accion === 'retirar') {
        const socio = datos.get(cambio.socio_id)!;
        const nota =
          `[RETIRO] Fecha: ${textoDia(hasta)} | Motivo: ${cambio.motivo} | Automático` +
          (cambio.prestamos_abiertos ? ' | Debe préstamo: llevar a la reunión de delegados' : '');
        await db.socio.update({
          where: { id: cambio.socio_id },
          data: {
            estado: 'retirado',
            suspendido_desde: null,
            suspendido_hasta: null,
            notas: [socio.notas?.trim(), nota].filter(Boolean).join('\n'),
          },
        });
        // Pierde sus acuerdos de salud y funeraria
        const vigentes = { beneficiario: { socio_id: cambio.socio_id }, estado: { in: ['activo' as const, 'suspendido' as const] } };
        const retiro = { estado: 'retirado' as const, fecha_retiro: hasta, motivo_retiro: MOTIVO_RETIRO_ACUERDO };
        await db.acuerdoFuneraria.updateMany({ where: vigentes, data: retiro });
        await db.acuerdoSalud.updateMany({ where: vigentes, data: retiro });
      } else {
        await db.socio.update({
          where: { id: cambio.socio_id },
          data: {
            estado: cambio.estado_nuevo as 'activo' | 'suspendido',
            suspendido_desde: cambio.suspendido_desde,
            suspendido_hasta: cambio.suspendido_hasta,
          },
        });
      }
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
      retirar: cuantos('retirar'),
    },
  };
};
