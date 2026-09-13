// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Deuda de salud de una feria en un período
// ============================================
//
// Quién debe pagarse por la feria en un período (HU-07):
//
//   - Trabajadores cuya feria DEL PERÍODO es esta (ver `feriaDelPeriodo`):
//     si lo trasladaron a mitad de período, le toca a la última feria.
//   - Activos, o retirados que trabajaron parte del período. Suspendidos e
//     inactivos no tienen salud (misma regla que la ficha del trabajador).
//   - Pagado = tiene un renglón VIGENTE para ese período, en esta u otra feria.
//     Un anulado no cuenta, y el trabajador vuelve a pendiente.
//
// Además se listan los que ya quedaron pagados por esta feria aunque hoy el
// cálculo los ubique en otra (un traslado cargado después, con fecha pasada):
// sin eso la suma de renglones dejaría de coincidir con el pago (HU-10.4).
//
// Se usa igual para mostrar la deuda y, dentro de la transacción, para
// registrar el pago: el backend nunca confía en el total que manda la pantalla.

import type { Prisma, PrismaClient } from '@prisma/client';
import { redondear } from './cobroSemanalService';
import { feriaDelPeriodo, rangoPeriodo, type PeriodoSaludRef, type RangoPeriodo } from '../utils/periodoSalud';

type Db = PrismaClient | Prisma.TransactionClient;

export interface FilaDeuda {
  trabajador_id: number;
  codigo_trabajador: string;
  identificacion: string;
  nombre: string;
  estado_trabajador: string;
  estado: 'pendiente' | 'pagado';
  monto_usd: number;
  pago_id: number | null;
}

export interface DeudaFeria {
  periodo: RangoPeriodo & { id: number | null };
  tarifa_usd: number;
  filas: FilaDeuda[];
  resumen: {
    total: number;
    pagados: number;
    pendientes: number;
    monto_individual_usd: number;
    monto_pagado_usd: number;
    monto_pendiente_usd: number;
  };
}

const personaSelect = {
  select: { tipo_identificacion: true, numero_identificacion: true, nombres: true, apellidos: true },
} as const;

export const calcularDeuda = async (
  db: Db,
  feriaId: number,
  ref: PeriodoSaludRef,
  tarifaUsd: number
): Promise<DeudaFeria> => {
  const rango = rangoPeriodo(ref);
  const periodo = await db.periodoSalud.findUnique({
    where: { tipo_anio_numero: { tipo: ref.tipo, anio: ref.anio, numero: ref.numero } },
  });

  const candidatos = await db.socioTrabajador.findMany({
    where: {
      estado: { in: ['activo', 'retirado'] },
      ferias: {
        some: {
          feria_id: feriaId,
          fecha_inicio: { lte: rango.fin },
          OR: [{ fecha_fin: null }, { fecha_fin: { gte: rango.inicio } }],
        },
      },
    },
    include: {
      persona: personaSelect,
      ferias: { select: { feria_id: true, fecha_inicio: true, fecha_fin: true } },
    },
  });
  const deLaFeria = candidatos.filter((t) => feriaDelPeriodo(t.ferias, rango) === feriaId);

  const vigentes = periodo
    ? await db.pagoSaludTrabajador.findMany({
        where: {
          periodo_id: periodo.id,
          estado: 'vigente',
          OR: [{ trabajador_id: { in: deLaFeria.map((t) => t.id) } }, { feria_id: feriaId }],
        },
        include: { trabajador: { include: { persona: personaSelect } } },
      })
    : [];
  const pagoDe = new Map(vigentes.map((v) => [v.trabajador_id, v]));

  const fila = (
    t: { id: number; codigo_trabajador: string; estado: string; persona: { tipo_identificacion: string; numero_identificacion: string; nombres: string; apellidos: string } }
  ): FilaDeuda => {
    const pago = pagoDe.get(t.id);
    return {
      trabajador_id: t.id,
      codigo_trabajador: t.codigo_trabajador,
      identificacion: `${t.persona.tipo_identificacion}-${t.persona.numero_identificacion}`,
      nombre: `${t.persona.apellidos}, ${t.persona.nombres}`,
      estado_trabajador: t.estado,
      estado: pago ? 'pagado' : 'pendiente',
      monto_usd: pago ? Number(pago.monto_usd) : redondear(tarifaUsd),
      pago_id: pago?.pago_id ?? null,
    };
  };

  const incluidos = new Set(deLaFeria.map((t) => t.id));
  const filas = [
    ...deLaFeria.map(fila),
    // Pagados por esta feria que hoy el cálculo ubica en otra
    ...vigentes.filter((v) => v.feria_id === feriaId && !incluidos.has(v.trabajador_id)).map((v) => fila(v.trabajador)),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const pagadas = filas.filter((f) => f.estado === 'pagado');
  const pendientes = filas.filter((f) => f.estado === 'pendiente');

  return {
    periodo: { ...rango, id: periodo?.id ?? null },
    tarifa_usd: redondear(tarifaUsd),
    filas,
    resumen: {
      total: filas.length,
      pagados: pagadas.length,
      pendientes: pendientes.length,
      monto_individual_usd: redondear(tarifaUsd),
      monto_pagado_usd: redondear(pagadas.reduce((s, f) => s + f.monto_usd, 0)),
      // Suma de los renglones, no cantidad × tarifa: tiene que coincidir con la tabla (HU-07.6)
      monto_pendiente_usd: redondear(pendientes.reduce((s, f) => s + f.monto_usd, 0)),
    },
  };
};
