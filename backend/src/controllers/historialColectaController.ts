// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLADOR
// Historial rápido desde la colecta
// ============================================
//
// Pedido del 09/11: desde la caja, un clic en el préstamo, la cuenta de ahorro
// o el acuerdo de funeraria o salud muestra sus últimos movimientos en una
// ventanita, sin salir de la colecta.
//
// Un solo endpoint liviano para los cuatro: el detalle del préstamo que ya
// existe (`GET /api/prestamos/:id`) trae todo el plan y recalcula la mora en
// cada consulta, demasiado para una consulta rápida en caja.

import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { formatearPeriodo } from '../utils/calendarioSemanal';
import { responderError } from '../utils/responderError';

const LIMITE = 8;

export interface MovimientoHistorial {
  fecha: string;
  tipo: string;
  detalle: string | null;
  monto_usd: number;
  monto_bs: number;
  /** Saldo después del movimiento (ahorro) */
  saldo_bs: number | null;
  saldo_usd: number | null;
  /** Semana hasta la que quedó cubierto (funeraria y salud) */
  cubre_hasta: string | null;
  /** Funeraria y salud: si el acuerdo quedó suspendido, desde qué fecha (AAAA-MM-DD) */
  suspension: string | null;
  reversado: boolean;
}

const n = (v: unknown): number => Number(v ?? 0);

const SERVICIOS = ['prestamo', 'ahorro', 'funeraria', 'salud'] as const;
type Servicio = (typeof SERVICIOS)[number];

/** GET /api/colecta/historial/:servicio/:id */
export const historialRapido = async (req: Request, res: Response): Promise<void> => {
  try {
    const servicio = String(req.params.servicio) as Servicio;
    if (!SERVICIOS.includes(servicio)) throw new BadRequestError('Servicio inválido');
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID inválido');

    let titulo = '';
    let resumen = '';
    let movimientos: MovimientoHistorial[] = [];
    let moneda: 'bs' | 'usd' = 'bs';

    if (servicio === 'prestamo') {
      const prestamo = await prisma.prestamo.findUnique({
        where: { id },
        select: {
          numero_prestamo: true,
          saldo_capital_usd: true,
          saldo_capital_bs: true,
          abonos: { orderBy: { fecha_abono: 'desc' }, take: LIMITE },
        },
      });
      if (!prestamo) throw new NotFoundError('Préstamo no encontrado');
      titulo = `Préstamo ${prestamo.numero_prestamo}`;
      resumen = `Saldo capital: $${n(prestamo.saldo_capital_usd).toFixed(2)} · Bs ${n(prestamo.saldo_capital_bs).toFixed(2)}`;
      movimientos = prestamo.abonos.map((a) => ({
        fecha: a.fecha_abono.toISOString(),
        tipo: 'Abono',
        detalle:
          `Capital $${n(a.aplicado_capital_usd).toFixed(2)} · Interés $${n(a.aplicado_interes_usd).toFixed(2)}` +
          (n(a.aplicado_mora_usd) > 0 ? ` · Mora $${n(a.aplicado_mora_usd).toFixed(2)}` : ''),
        monto_usd: n(a.monto_usd),
        monto_bs: n(a.monto_bs),
        saldo_bs: null,
        saldo_usd: null,
        cubre_hasta: null,
        suspension: null,
        reversado: a.reversado,
      }));
    }

    if (servicio === 'ahorro') {
      const cuenta = await prisma.cuentaAhorro.findUnique({
        where: { id },
        select: {
          numero_cuenta: true,
          saldo_bs: true,
          saldo_usd: true,
          tipo_cuenta: { select: { moneda: true } },
          movimientos: { orderBy: [{ fecha_movimiento: 'desc' }, { id: 'desc' }], take: LIMITE },
        },
      });
      if (!cuenta) throw new NotFoundError('Cuenta no encontrada');
      // La cuenta en divisas se lleva en dólares: su saldo es el de $ (10/11)
      moneda = cuenta.tipo_cuenta.moneda === 'usd' ? 'usd' : 'bs';
      titulo = `Cuenta de ahorro ${cuenta.numero_cuenta}${moneda === 'usd' ? ' (divisas)' : ''}`;
      resumen =
        moneda === 'usd'
          ? `Saldo: $${n(cuenta.saldo_usd).toFixed(2)}`
          : `Saldo: Bs ${n(cuenta.saldo_bs).toFixed(2)}`;
      movimientos = cuenta.movimientos.map((m) => ({
        fecha: m.fecha_movimiento.toISOString(),
        tipo: m.tipo_movimiento === 'retiro' ? 'Retiro' : 'Depósito',
        detalle: m.concepto ?? m.referencia,
        monto_usd: n(m.monto_usd),
        monto_bs: n(m.monto_bs),
        saldo_bs: m.saldo_nuevo_bs === null ? null : n(m.saldo_nuevo_bs),
        saldo_usd: n(m.saldo_nuevo_usd),
        cubre_hasta: null,
        suspension: null,
        reversado: false,
      }));
    }

    if (servicio === 'funeraria') {
      const acuerdo = await prisma.acuerdoFuneraria.findUnique({
        where: { id },
        select: {
          numero_acuerdo: true,
          ano_pagado_hasta: true,
          semana_pagada_hasta: true,
          estado: true,
          fecha_suspension: true,
          movimientos: { orderBy: [{ fecha_movimiento: 'desc' }, { id: 'desc' }], take: LIMITE },
        },
      });
      if (!acuerdo) throw new NotFoundError('Acuerdo no encontrado');
      titulo = `Funeraria · acuerdo ${acuerdo.numero_acuerdo ?? id}`;
      resumen = `Pagado hasta ${formatearPeriodo(
        acuerdo.ano_pagado_hasta && acuerdo.semana_pagada_hasta
          ? { ano: acuerdo.ano_pagado_hasta, semana: acuerdo.semana_pagada_hasta }
          : null
      )}`;
      resumen += textoSuspension(acuerdo);
      movimientos = conSuspensionActual(acuerdo.movimientos.map((m) => movimientoDeServicio(m)), acuerdo).slice(
        0,
        LIMITE
      );
    }

    if (servicio === 'salud') {
      const acuerdo = await prisma.acuerdoSalud.findUnique({
        where: { id },
        select: {
          numero_acuerdo: true,
          ano_pagado_hasta: true,
          semana_pagada_hasta: true,
          estado: true,
          fecha_suspension: true,
        },
      });
      if (!acuerdo) throw new NotFoundError('Acuerdo no encontrado');

      // El acuerdo de salud lo comparten el titular y sus beneficiarios: se
      // muestra el del grupo, un renglón por cobro aunque toque a varias personas
      const ids = acuerdo.numero_acuerdo
        ? (
            await prisma.acuerdoSalud.findMany({
              where: { numero_acuerdo: acuerdo.numero_acuerdo },
              select: { id: true },
            })
          ).map((a) => a.id)
        : [id];
      const crudos = await prisma.movimientoSalud.findMany({
        where: { acuerdo_id: { in: ids } },
        orderBy: [{ fecha_movimiento: 'desc' }, { id: 'desc' }],
        take: LIMITE * ids.length,
      });

      const porCobro = new Map<string, MovimientoHistorial>();
      for (const m of crudos) {
        // Un cobro o un reverso toca un movimiento por persona del acuerdo,
        // pero es una sola operación: un renglón. Los reversos no guardan el
        // cobro: se juntan por su concepto ("Reverso de colecta #N: motivo"),
        // que es único por reverso.
        const clave = m.colecta_id
          ? `c${m.colecta_id}-${m.tipo_movimiento}`
          : m.tipo_movimiento === 'reverso' && m.concepto
            ? `r-${m.concepto}`
            : `m${m.id}`;
        const previo = porCobro.get(clave);
        if (previo) {
          previo.monto_usd += n(m.monto_usd);
          previo.monto_bs += n(m.monto_bs);
          previo.suspension ??= dia(m.fecha_suspension);
        } else {
          porCobro.set(clave, movimientoDeServicio(m));
        }
      }

      titulo = `Salud · acuerdo ${acuerdo.numero_acuerdo ?? id}`;
      resumen =
        `Pagado hasta ${formatearPeriodo(
          acuerdo.ano_pagado_hasta && acuerdo.semana_pagada_hasta
            ? { ano: acuerdo.ano_pagado_hasta, semana: acuerdo.semana_pagada_hasta }
            : null
        )}` + (ids.length > 1 ? ` · ${ids.length} personas` : '') + textoSuspension(acuerdo);
      movimientos = conSuspensionActual([...porCobro.values()], acuerdo).slice(0, LIMITE);
    }

    res.json({ success: true, data: { servicio, titulo, resumen, moneda, movimientos } });
  } catch (error) {
    responderError(res, error, 'Error al consultar el historial');
  }
};

const ETIQUETA_TIPO: Record<string, string> = {
  pago: 'Pago',
  reverso: 'Reverso',
  suspension: 'Suspensión',
  reactivacion: 'Reactivación',
  reintegro: 'Reintegro',
};

const dia = (fecha: Date | null): string | null => (fecha ? fecha.toISOString().slice(0, 10) : null);

const textoSuspension = (a: { estado: string; fecha_suspension: Date | null }): string =>
  a.estado === 'suspendido'
    ? ` · Suspendido${a.fecha_suspension ? ` desde ${a.fecha_suspension.toISOString().slice(0, 10).split('-').reverse().join('/')}` : ''}`
    : '';

/**
 * Si el acuerdo está suspendido, la suspensión entra como un renglón más en su
 * fecha: la hace el proceso semanal, que no deja movimiento propio.
 */
const conSuspensionActual = (
  lista: MovimientoHistorial[],
  a: { estado: string; fecha_suspension: Date | null }
): MovimientoHistorial[] => {
  if (a.estado !== 'suspendido' || !a.fecha_suspension) return lista;
  const fecha = dia(a.fecha_suspension)!;
  const renglon: MovimientoHistorial = {
    fecha: a.fecha_suspension.toISOString(),
    tipo: 'Suspensión',
    detalle: 'Por atraso en el pago',
    monto_usd: 0,
    monto_bs: 0,
    saldo_bs: null,
    saldo_usd: null,
    cubre_hasta: null,
    suspension: fecha,
    reversado: false,
  };
  return [...lista, renglon].sort((x, y) => y.fecha.localeCompare(x.fecha));
};

const movimientoDeServicio = (m: {
  fecha_movimiento: Date;
  tipo_movimiento: string;
  concepto: string | null;
  monto_usd: unknown;
  monto_bs: unknown;
  semanas_pagadas: number | null;
  ano_cobertura: number | null;
  semana_cobertura: number | null;
  fecha_suspension: Date | null;
  reversado: boolean;
}): MovimientoHistorial => ({
  fecha: m.fecha_movimiento.toISOString(),
  tipo: ETIQUETA_TIPO[m.tipo_movimiento] ?? m.tipo_movimiento,
  detalle: !m.semanas_pagadas
    ? m.concepto
    : m.semanas_pagadas < 0
      ? `Deshace ${-m.semanas_pagadas} semana(s)`
      : `${m.semanas_pagadas} semana(s)`,
  monto_usd: n(m.monto_usd),
  monto_bs: n(m.monto_bs),
  saldo_bs: null,
  saldo_usd: null,
  cubre_hasta:
    m.ano_cobertura && m.semana_cobertura
      ? formatearPeriodo({ ano: m.ano_cobertura, semana: m.semana_cobertura })
      : null,
  suspension: dia(m.fecha_suspension),
  reversado: m.reversado,
});
