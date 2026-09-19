// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Indicadores para el tablero
// ============================================
//
// Lo que la junta mira de un vistazo: cuántos socios hay y cómo se mueven, qué
// se cobró semana a semana, cómo viene el ahorro, en qué está la cartera de
// préstamos y cuántos socios vienen atrasados.
//
// Todo sale de lo ya registrado: nada se calcula dos veces ni se guarda aparte,
// para que el tablero no pueda discrepar de los reportes.

import type { PrismaClient, Prisma } from '@prisma/client';
import { redondear } from './cobroSemanalService';
import { atrasoPorSocio, NIVELES_ATRASO, nivelDeAtraso } from './atrasoSociosService';
import { hoyDia } from '../utils/fechaDia';

type Db = PrismaClient | Prisma.TransactionClient;

/** Un punto de una serie: la etiqueta que se ve y el valor */
export interface Punto {
  etiqueta: string;
  valor: number;
}

export interface Indicadores {
  al: Date;
  meses: number;
  socios: {
    activos: number;
    suspendidos: number;
    retirados: number;
    altas_por_mes: Punto[];
  };
  ahorro: {
    saldo_usd: number;
    bloqueado_usd: number;
    cuentas_activas: number;
    depositos_por_mes: Punto[];
    retiros_por_mes: Punto[];
  };
  colecta: {
    cobrado_mes_usd: number;
    por_semana_usd: Punto[];
    por_servicio_usd: Punto[];
  };
  prestamos: {
    activos: number;
    en_solicitud: number;
    morosos: number;
    saldo_usd: number;
    otorgado_por_mes_usd: Punto[];
  };
  atraso: {
    socios_con_atraso: number;
    por_nivel: Punto[];
  };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const etiquetaMes = (d: Date) => `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;

/** Los últimos `meses` meses, del más viejo al más nuevo, en horario local */
const ultimosMeses = (meses: number, hasta: Date): { desde: Date; claves: string[]; etiquetas: Map<string, string> } => {
  const claves: string[] = [];
  const etiquetas = new Map<string, string>();
  const primero = new Date(Date.UTC(hasta.getFullYear(), hasta.getMonth() - meses + 1, 1));
  for (let i = 0; i < meses; i++) {
    const d = new Date(Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + i, 1));
    const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    claves.push(clave);
    etiquetas.set(clave, etiquetaMes(d));
  }
  return { desde: new Date(hasta.getFullYear(), hasta.getMonth() - meses + 1, 1), claves, etiquetas };
};

/** Arma la serie completa: los meses sin dato quedan en cero, no desaparecen */
const serieMensual = (filas: { mes: string; total: number }[], meses: ReturnType<typeof ultimosMeses>): Punto[] => {
  const por = new Map(filas.map((f) => [f.mes, f.total]));
  return meses.claves.map((c) => ({ etiqueta: meses.etiquetas.get(c)!, valor: redondear(por.get(c) ?? 0) }));
};

type FilaMes = { mes: string; total: number | bigint | Prisma.Decimal };
const aFilas = (filas: FilaMes[]) => filas.map((f) => ({ mes: f.mes, total: Number(f.total) }));

export const indicadores = async (db: Db, opciones: { meses?: number } = {}): Promise<Indicadores> => {
  const meses = Math.min(Math.max(opciones.meses ?? 12, 3), 24);
  const hoy = hoyDia();
  const ventana = ultimosMeses(meses, new Date());
  const desde = ventana.desde;

  const [
    porEstado,
    altas,
    cuentas,
    movimientos,
    colectaMes,
    colectaSemana,
    porServicio,
    prestamosPorEstado,
    saldoPrestamos,
    otorgados,
    atrasos,
  ] = await Promise.all([
    db.socio.groupBy({ by: ['estado'], _count: { _all: true } }),
    db.$queryRaw<FilaMes[]>`
      SELECT to_char(fecha_inscripcion, 'YYYY-MM') AS mes, count(*)::int AS total
      FROM socios WHERE fecha_inscripcion >= ${desde} GROUP BY 1`,
    db.cuentaAhorro.aggregate({
      where: { estado: true },
      _sum: { saldo_usd: true, monto_bloqueado_usd: true },
      _count: { _all: true },
    }),
    db.$queryRaw<(FilaMes & { tipo_movimiento: string })[]>`
      SELECT to_char(fecha_movimiento, 'YYYY-MM') AS mes, tipo_movimiento, sum(monto_usd) AS total
      FROM movimientos_ahorro WHERE fecha_movimiento >= ${desde} GROUP BY 1, 2`,
    db.colecta.aggregate({
      where: { reversada: false, fecha_colecta: { gte: new Date(hoy.getFullYear(), hoy.getMonth(), 1) } },
      _sum: { monto_total_usd: true },
    }),
    db.$queryRaw<{ semana: string; total: Prisma.Decimal }[]>`
      SELECT to_char(date_trunc('week', fecha_colecta), 'DD/MM') AS semana, sum(monto_total_usd) AS total
      FROM colecta
      WHERE reversada = false AND fecha_colecta >= now() - interval '12 weeks'
      GROUP BY date_trunc('week', fecha_colecta) ORDER BY date_trunc('week', fecha_colecta)`,
    db.$queryRaw<{ servicio: string; total: Prisma.Decimal }[]>`
      SELECT d.servicio, sum(d.monto_usd) AS total
      FROM detalle_colecta d
      JOIN colecta c ON c.id = d.colecta_id
      WHERE c.reversada = false AND c.fecha_colecta >= ${desde}
      GROUP BY d.servicio ORDER BY 2 DESC`,
    db.prestamo.groupBy({ by: ['estado'], _count: { _all: true } }),
    db.prestamo.aggregate({
      where: { estado: { in: ['activo', 'moroso'] } },
      _sum: { saldo_capital_usd: true, saldo_interes_usd: true },
    }),
    db.$queryRaw<FilaMes[]>`
      SELECT to_char(fecha_desembolso, 'YYYY-MM') AS mes, sum(monto_original_usd) AS total
      FROM prestamos WHERE fecha_desembolso >= ${desde} AND estado <> 'cancelado' GROUP BY 1`,
    atrasoPorSocio(db),
  ]);

  const cuantos = (filas: { estado: string; _count: { _all: number } }[], estado: string) =>
    filas.find((f) => f.estado === estado)?._count._all ?? 0;

  const porNivel = NIVELES_ATRASO.map((nivel) => ({
    etiqueta: nivel.texto,
    valor: atrasos.filter((a) => nivelDeAtraso(a.semanas_atraso)?.texto === nivel.texto).length,
  }));

  return {
    al: hoy,
    meses,
    socios: {
      activos: cuantos(porEstado, 'activo'),
      suspendidos: cuantos(porEstado, 'suspendido'),
      retirados: cuantos(porEstado, 'retirado'),
      altas_por_mes: serieMensual(aFilas(altas), ventana),
    },
    ahorro: {
      saldo_usd: redondear(Number(cuentas._sum.saldo_usd ?? 0)),
      bloqueado_usd: redondear(Number(cuentas._sum.monto_bloqueado_usd ?? 0)),
      cuentas_activas: cuentas._count._all,
      depositos_por_mes: serieMensual(aFilas(movimientos.filter((m) => m.tipo_movimiento === 'deposito')), ventana),
      retiros_por_mes: serieMensual(aFilas(movimientos.filter((m) => m.tipo_movimiento === 'retiro')), ventana),
    },
    colecta: {
      cobrado_mes_usd: redondear(Number(colectaMes._sum.monto_total_usd ?? 0)),
      por_semana_usd: colectaSemana.map((f) => ({ etiqueta: f.semana, valor: redondear(Number(f.total)) })),
      por_servicio_usd: porServicio.map((f) => ({ etiqueta: f.servicio, valor: redondear(Number(f.total)) })),
    },
    prestamos: {
      activos: cuantos(prestamosPorEstado, 'activo'),
      en_solicitud: cuantos(prestamosPorEstado, 'solicitado') + cuantos(prestamosPorEstado, 'aprobado'),
      morosos: cuantos(prestamosPorEstado, 'moroso'),
      saldo_usd: redondear(
        Number(saldoPrestamos._sum.saldo_capital_usd ?? 0) + Number(saldoPrestamos._sum.saldo_interes_usd ?? 0)
      ),
      otorgado_por_mes_usd: serieMensual(aFilas(otorgados), ventana),
    },
    atraso: {
      socios_con_atraso: atrasos.filter((a) => a.semanas_atraso > 0).length,
      por_nivel: porNivel,
    },
  };
};
