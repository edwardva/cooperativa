// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Estado de los servicios (vigente / atrasado / suspendido)
// ============================================
//
// Requisito 8 de la reunión.
//
// Antes: un job subía `semanas_sin_pago` en 1 cada lunes, a ciegas. Con la
// cobertura como fuente de verdad ese incremento sobra y ademas MIENTE — el
// atraso ya está implícito en el par (año, semana) hasta el que se pagó, así
// que sumarle uno cada semana lo contaría dos veces. Y un socio que pagó por
// adelantado terminaba figurando como atrasado, que es justo el caso que el
// personal marcó como mal calculado durante la demostración.
//
// Ahora el job RECALCULA: mira la cobertura de cada acuerdo, la compara con la
// semana en curso y escribe el atraso que corresponde.
//
// Sobre suspender automáticamente: el cliente NO confirmó cuántas semanas
// suspenden ("no fijar el umbral a partir de las menciones aisladas a seis o
// siete semanas"), así que la suspensión automática viene DESACTIVADA. El job
// informa a cuántos alcanzaría, y la cooperativa la habilita cuando acuerde el
// número. Suspender a cientos de socios con un umbral no confirmado sería
// bastante peor que no suspender a nadie.

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { semanaActual } from '../utils/calendarioSemanal';
import { coberturaDe, semanasSinPagoDerivadas } from './coberturaService';
import { obtenerTarifas } from './tarifasService';

/** Interruptor de la suspensión automática. Apagado mientras no se confirme. */
export const CLAVE_SUSPENSION_AUTOMATICA = 'SUSPENSION_AUTOMATICA';

async function suspensionAutomaticaActiva(): Promise<boolean> {
  const p = await prisma.parametroSistema.findUnique({
    where: { clave: CLAVE_SUSPENSION_AUTOMATICA },
  });
  return p?.valor === '1' || p?.valor === 'true';
}

export interface ResultadoRecalculo {
  servicio: 'funeraria' | 'salud';
  revisados: number;
  atrasoActualizado: number;
  alcanzanUmbral: number;
  suspendidos: number;
  suspensionAplicada: boolean;
}

/**
 * Recalcula el atraso de todos los acuerdos activos de un servicio.
 *
 * `semanas_sin_pago` se sigue escribiendo porque lo leen los módulos de
 * funeraria y salud y los reportes, pero ya no decide nada: es un derivado de
 * la cobertura.
 */
async function recalcular(
  servicio: 'funeraria' | 'salud',
  umbral: number,
  aplicarSuspension: boolean
): Promise<ResultadoRecalculo> {
  const actual = semanaActual();

  const acuerdos =
    servicio === 'funeraria'
      ? await prisma.acuerdoFuneraria.findMany({
          where: { estado: 'activo' },
          select: {
            id: true,
            ano_pagado_hasta: true,
            semana_pagada_hasta: true,
            fecha_ultimo_pago: true,
            semanas_sin_pago: true,
            fecha_inicio: true,
            estado: true,
          },
        })
      : await prisma.acuerdoSalud.findMany({
          where: { estado: 'activo' },
          select: {
            id: true,
            numero_acuerdo: true,
            ano_pagado_hasta: true,
            semana_pagada_hasta: true,
            fecha_ultimo_pago: true,
            semanas_sin_pago: true,
            fecha_inicio: true,
            estado: true,
          },
        });

  // Se agrupan por atraso: miles de acuerdos comparten el mismo valor, asi que
  // salen en unos pocos updateMany en vez de uno por fila.
  const porAtraso = new Map<number, number[]>();
  const alcanzanUmbral: number[] = [];

  for (const acuerdo of acuerdos) {
    const cobertura = coberturaDe(acuerdo, actual);
    if (!cobertura) continue;

    const atraso = semanasSinPagoDerivadas(cobertura, actual);
    if (atraso !== acuerdo.semanas_sin_pago) {
      const lista = porAtraso.get(atraso) ?? [];
      lista.push(acuerdo.id);
      porAtraso.set(atraso, lista);
    }
    if (umbral > 0 && atraso >= umbral) alcanzanUmbral.push(acuerdo.id);
  }

  let atrasoActualizado = 0;
  for (const [atraso, ids] of porAtraso) {
    const datos = { semanas_sin_pago: atraso };
    const { count } =
      servicio === 'funeraria'
        ? await prisma.acuerdoFuneraria.updateMany({ where: { id: { in: ids } }, data: datos })
        : await prisma.acuerdoSalud.updateMany({ where: { id: { in: ids } }, data: datos });
    atrasoActualizado += count;
  }

  let suspendidos = 0;
  if (aplicarSuspension && alcanzanUmbral.length > 0) {
    if (servicio === 'funeraria') {
      const { count } = await prisma.acuerdoFuneraria.updateMany({
        where: { id: { in: alcanzanUmbral }, estado: 'activo' },
        data: { estado: 'suspendido', fecha_suspension: new Date() },
      });
      suspendidos = count;
    } else {
      // En salud el acuerdo lo comparten hasta nueve personas: si vence, se
      // suspende el grupo entero, no solo la fila que cruzo el umbral.
      const vencidos = new Set(alcanzanUmbral);
      const conGrupo: { id: number; numero_acuerdo: string }[] = [];
      for (const a of acuerdos) {
        if (!vencidos.has(a.id)) continue;
        const numero = (a as { numero_acuerdo?: string | null }).numero_acuerdo;
        if (numero) conGrupo.push({ id: a.id, numero_acuerdo: numero });
      }
      const numeros = [...new Set(conGrupo.map((a) => a.numero_acuerdo))];

      if (numeros.length > 0) {
        const { count } = await prisma.acuerdoSalud.updateMany({
          where: { numero_acuerdo: { in: numeros }, estado: 'activo' },
          data: { estado: 'suspendido', fecha_suspension: new Date() },
        });
        suspendidos += count;
      }

      const conGrupoIds = new Set(conGrupo.map((a) => a.id));
      const sinGrupo = alcanzanUmbral.filter((id) => !conGrupoIds.has(id));
      if (sinGrupo.length > 0) {
        const { count } = await prisma.acuerdoSalud.updateMany({
          where: { id: { in: sinGrupo }, estado: 'activo' },
          data: { estado: 'suspendido', fecha_suspension: new Date() },
        });
        suspendidos += count;
      }
    }
  }

  return {
    servicio,
    revisados: acuerdos.length,
    atrasoActualizado,
    alcanzanUmbral: alcanzanUmbral.length,
    suspendidos,
    suspensionAplicada: aplicarSuspension,
  };
}

/** Recalcula funeraria y salud con sus umbrales respectivos. */
export async function recalcularEstados(
  forzarSuspension?: boolean
): Promise<ResultadoRecalculo[]> {
  const tarifas = await obtenerTarifas();
  const aplicar = forzarSuspension ?? (await suspensionAutomaticaActiva());

  const resultados = [
    await recalcular('funeraria', tarifas.semanas_suspension_funeraria, aplicar),
    await recalcular('salud', tarifas.semanas_suspension_salud, aplicar),
  ];

  for (const r of resultados) {
    logger.info(
      `Estado ${r.servicio}: ${r.revisados} revisado(s), ${r.atrasoActualizado} con atraso ` +
        `actualizado, ${r.alcanzanUmbral} alcanzan el umbral` +
        (r.suspensionAplicada
          ? `, ${r.suspendidos} suspendido(s)`
          : ' (suspension automatica desactivada)')
    );
  }

  return resultados;
}
