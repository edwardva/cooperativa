// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Deuda de salud de una feria en uno o varios períodos
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
//   - NO se le cobra a la feria el trabajador que ya paga su salud como socio
//     (tiene un acuerdo de salud activo): confirmado por la cooperativa, "el
//     que no se lo pagan es porque ya lo paga personalmente". Se listan aparte.
//
// Además se listan los que ya quedaron pagados por esta feria aunque hoy el
// cálculo los ubique en otra (un traslado cargado después, con fecha pasada):
// sin eso la suma de renglones dejaría de coincidir con el pago (HU-10.4).
//
// Se usa igual para mostrar la deuda y, dentro de la transacción, para
// registrar el pago: el backend nunca confía en el total que manda la pantalla.

import type { Prisma, PrismaClient } from '@prisma/client';
import { redondear } from './cobroSemanalService';
import { leerParametroNumerico, periodicidadSaludFeria } from './tarifasService';
import { resolverTasa } from './tasaCambioService';
import { BadRequestError } from '../middleware/errorHandler';
import {
  etiquetaRango,
  feriaDelPeriodo,
  MAX_PERIODOS_POR_PAGO,
  periodoQueContiene,
  periodosDesde,
  rangoPeriodo,
  validarPeriodo,
  type PeriodoSaludRef,
  type RangoPeriodo,
  type TipoPeriodo,
} from '../utils/periodoSalud';

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

/** Trabajador que no entra en el pago de la feria porque paga su salud como socio */
export interface TrabajadorAparte {
  trabajador_id: number;
  codigo_trabajador: string;
  nombre: string;
}

export interface DeudaFeria {
  periodo: RangoPeriodo & { id: number | null };
  tarifa_usd: number;
  filas: FilaDeuda[];
  pagan_aparte: TrabajadorAparte[];
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
  const delPeriodo = candidatos.filter((t) => feriaDelPeriodo(t.ferias, rango) === feriaId);

  // Quien ya tiene su acuerdo de salud como socio lo paga él: no lo cobra la feria
  const personas = delPeriodo.map((t) => t.persona_id);
  const conSaludPropia = new Set(
    personas.length === 0
      ? []
      : (
          await db.acuerdoSalud.findMany({
            where: { estado: 'activo', beneficiario: { socio: { persona_id: { in: personas } } } },
            select: { beneficiario: { select: { socio: { select: { persona_id: true } } } } },
          })
        )
          .map((a) => a.beneficiario.socio.persona_id)
          .filter((id): id is number => id !== null)
  );
  const deLaFeria = delPeriodo.filter((t) => !conSaludPropia.has(t.persona_id));
  const paganAparte = delPeriodo
    .filter((t) => conSaludPropia.has(t.persona_id))
    .map((t) => ({
      trabajador_id: t.id,
      codigo_trabajador: t.codigo_trabajador,
      nombre: `${t.persona.apellidos}, ${t.persona.nombres}`,
    }));

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
    pagan_aparte: paganAparte,
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

// ============================================
// Varios períodos seguidos
// ============================================
//
// La feria paga varias semanas juntas. La deuda de cada semana se calcula por
// separado (un traslado puede cambiar la feria de una semana a otra) y se
// agrupa por trabajador para mostrarla y cobrarla en un solo pago.

export interface PeriodoDeTrabajador {
  anio: number;
  numero: number;
  etiqueta: string;
  estado: 'pendiente' | 'pagado';
  monto_usd: number;
  pago_id: number | null;
}

export interface FilaDeudaRango {
  trabajador_id: number;
  codigo_trabajador: string;
  identificacion: string;
  nombre: string;
  estado_trabajador: string;
  /** Sólo los períodos en que su salud le toca a esta feria */
  periodos: PeriodoDeTrabajador[];
  pendientes: number;
  pagados: number;
  monto_pendiente_usd: number;
  estado: 'pendiente' | 'parcial' | 'pagado';
}

export interface DeudaRango {
  pagan_aparte: TrabajadorAparte[];
  desde: RangoPeriodo;
  hasta: RangoPeriodo;
  etiqueta: string;
  cantidad_periodos: number;
  periodos: (RangoPeriodo & { id: number | null; trabajadores: number; pendientes: number })[];
  tarifa_usd: number;
  filas: FilaDeudaRango[];
  resumen: {
    trabajadores: number;
    trabajadores_con_pendiente: number;
    periodos: number;
    renglones_pagados: number;
    /** Movimientos individuales que generaría el pago: trabajador × período pendiente */
    renglones_pendientes: number;
    monto_individual_usd: number;
    monto_pagado_usd: number;
    monto_pendiente_usd: number;
  };
}

export const calcularDeudaRango = async (
  db: Db,
  feriaId: number,
  desde: PeriodoSaludRef,
  cantidad: number,
  tarifaUsd: number
): Promise<DeudaRango> => {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_PERIODOS_POR_PAGO) {
    throw new BadRequestError(`La cantidad de períodos debe estar entre 1 y ${MAX_PERIODOS_POR_PAGO}`);
  }
  const refs = periodosDesde(desde, cantidad);

  const deudas: DeudaFeria[] = [];
  for (const ref of refs) deudas.push(await calcularDeuda(db, feriaId, ref, tarifaUsd));

  const porTrabajador = new Map<number, FilaDeudaRango>();
  for (const deuda of deudas) {
    for (const f of deuda.filas) {
      let fila = porTrabajador.get(f.trabajador_id);
      if (!fila) {
        fila = {
          trabajador_id: f.trabajador_id,
          codigo_trabajador: f.codigo_trabajador,
          identificacion: f.identificacion,
          nombre: f.nombre,
          estado_trabajador: f.estado_trabajador,
          periodos: [],
          pendientes: 0,
          pagados: 0,
          monto_pendiente_usd: 0,
          estado: 'pendiente',
        };
        porTrabajador.set(f.trabajador_id, fila);
      }
      fila.periodos.push({
        anio: deuda.periodo.anio,
        numero: deuda.periodo.numero,
        etiqueta: deuda.periodo.etiqueta,
        estado: f.estado,
        monto_usd: f.monto_usd,
        pago_id: f.pago_id,
      });
      if (f.estado === 'pendiente') {
        fila.pendientes++;
        fila.monto_pendiente_usd += f.monto_usd;
      } else {
        fila.pagados++;
      }
    }
  }

  const filas = [...porTrabajador.values()]
    .map((f) => ({
      ...f,
      monto_pendiente_usd: redondear(f.monto_pendiente_usd),
      estado: f.pendientes === 0 ? ('pagado' as const) : f.pagados === 0 ? ('pendiente' as const) : ('parcial' as const),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  // `cantidad` validada arriba: al menos un período
  const primero = deudas[0]!.periodo;
  const ultimo = deudas[deudas.length - 1]!.periodo;
  // Los que pagan su salud como socios: los mismos en todos los períodos del rango
  const aparte = new Map(deudas.flatMap((d) => d.pagan_aparte).map((t) => [t.trabajador_id, t]));
  return {
    pagan_aparte: [...aparte.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    desde: primero,
    hasta: ultimo,
    etiqueta: etiquetaRango(primero, ultimo),
    cantidad_periodos: refs.length,
    periodos: deudas.map((d) => ({ ...d.periodo, trabajadores: d.resumen.total, pendientes: d.resumen.pendientes })),
    tarifa_usd: redondear(tarifaUsd),
    filas,
    resumen: {
      trabajadores: filas.length,
      trabajadores_con_pendiente: filas.filter((f) => f.pendientes > 0).length,
      periodos: refs.length,
      renglones_pagados: deudas.reduce((s, d) => s + d.resumen.pagados, 0),
      renglones_pendientes: deudas.reduce((s, d) => s + d.resumen.pendientes, 0),
      monto_individual_usd: redondear(tarifaUsd),
      monto_pagado_usd: redondear(deudas.reduce((s, d) => s + d.resumen.monto_pagado_usd, 0)),
      // Suma de los renglones de cada período: coincide con la tabla (HU-07.6)
      monto_pendiente_usd: redondear(deudas.reduce((s, d) => s + d.resumen.monto_pendiente_usd, 0)),
    },
  };
};

// ============================================
// Período pedido y ferias pendientes (HU-19)
// ============================================

/** `tipo`, `anio` y `numero` tal como llegan de la query; sin anio ni numero, el período en curso */
export const periodoDesdeParametros = async (p: {
  tipo?: unknown;
  anio?: unknown;
  numero?: unknown;
}): Promise<PeriodoSaludRef> => {
  const tipoTexto = p.tipo ? String(p.tipo) : '';
  if (tipoTexto && tipoTexto !== 'mensual' && tipoTexto !== 'semanal') {
    throw new BadRequestError("El tipo de período debe ser 'mensual' o 'semanal'");
  }
  const tipo: TipoPeriodo = (tipoTexto as TipoPeriodo) || (await periodicidadSaludFeria());
  const vacio = (v: unknown) => v === undefined || v === null || v === '';
  if (vacio(p.anio) && vacio(p.numero)) return periodoQueContiene(tipo);

  const ref = { tipo, anio: Number(p.anio), numero: Number(p.numero) };
  const error = validarPeriodo(ref);
  if (error) throw new BadRequestError(error);
  return ref;
};

/**
 * Estado de cada feria en un período. Todas las activas, más las inactivas
 * que tengan algo en el período. Lo usan la pantalla y el reporte exportable.
 */
export const feriasPendientesDelPeriodo = async (db: Db, ref: PeriodoSaludRef) => {
  const [ferias, tarifa, { tasa }] = await Promise.all([
    db.ubicacion.findMany({
      orderBy: { codigo: 'asc' },
      select: { id: true, codigo: true, nombre: true, direccion: true, responsable: true, telefono: true, estado: true },
    }),
    leerParametroNumerico('TARIFA_SALUD_TRABAJADOR_USD'),
    resolverTasa(),
  ]);

  const filas = [];
  for (const feria of ferias) {
    const { resumen } = await calcularDeuda(db, feria.id, ref, tarifa);
    if (!feria.estado && resumen.total === 0) continue;
    filas.push({
      feria,
      ...resumen,
      monto_pendiente_bs: redondear(resumen.monto_pendiente_usd * tasa),
      estado:
        resumen.total === 0 ? ('sin_trabajadores' as const)
        : resumen.pendientes === 0 ? ('pagada' as const)
        : resumen.pagados === 0 ? ('pendiente' as const)
        : ('parcial' as const),
    });
  }

  const conDeuda = filas.filter((f) => f.pendientes > 0);
  return {
    periodo: rangoPeriodo(ref),
    tarifa_usd: tarifa,
    tasa,
    ferias: filas,
    totales: {
      ferias_con_deuda: conDeuda.length,
      trabajadores_pendientes: conDeuda.reduce((s, f) => s + f.pendientes, 0),
      monto_pendiente_usd: redondear(conDeuda.reduce((s, f) => s + f.monto_pendiente_usd, 0)),
    },
  };
};
