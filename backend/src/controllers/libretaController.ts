// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLADOR
// Libreta de ahorro para imprimir
// ============================================
//
// Es el "Act. Libreta" / "Enc. Libreta" de Colecta Global en el sistema actual
// (colecta_global/rep_act_lib.php y rep_enc_lib.php). Una fila por movimiento
// de la cuenta, con lo que se cobró de funeraria y salud en el mismo cobro:
//
//   Id  Fecha  Tipo  Ahorro  Saldo  Sem  Fun  Salud  Hasta  Susp_Fun  Susp_Sal
//
// Todo en bolívares: Ahorros a la Vista es un producto en Bs. La de Ahorro en
// divisas (rep_act_lib_aho.php) usa los mismos renglones, en dólares. Susp_Fun y
// Susp_Sal: la fecha de suspensión si el acuerdo quedó suspendido tras el cobro. Se imprime el
// historial completo desde el primer movimiento (confirmado el 03/11).

import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler';
import { rangoDeSemana } from '../utils/calendarioSemanal';
import { nombreEnMayusculas } from '../utils/reportes';
import { responderError } from '../utils/responderError';

const redondear = (v: number): number => Math.round(v * 100) / 100;

/** Abreviatura de la libreta vieja: Ape, Dep, Ret... */
const TIPOS: Record<string, string> = {
  apertura: 'Ape',
  deposito: 'Dep',
  retiro: 'Ret',
  reverso: 'Rev',
};
const abreviarTipo = (tipo: string): string => {
  const t = tipo.toLowerCase();
  return TIPOS[t] ?? t.charAt(0).toUpperCase() + t.slice(1, 3);
};

/** Columna @db.Date como YYYY-MM-DD (llega a medianoche UTC) */
const soloFecha = (v: Date | undefined): string | null => (v ? v.toISOString().slice(0, 10) : null);

/** Las colectas dejan en el movimiento la referencia COL-<id> */
const colectaDeReferencia = (referencia: string | null): number | null => {
  const m = /^COL-(\d+)$/.exec(referencia ?? '');
  return m ? Number(m[1]) : null;
};

/**
 * GET /api/colecta/libreta/:cuentaId
 *
 * Encabezado (datos del socio) y renglones de la libreta, listos para imprimir.
 */
export const obtenerLibretaAhorro = async (req: Request, res: Response): Promise<void> => {
  try {
    const cuentaId = Number(req.params.cuentaId);
    if (!Number.isInteger(cuentaId) || cuentaId <= 0) {
      throw new BadRequestError('Cuenta inválida');
    }

    const cuenta = await prisma.cuentaAhorro.findUnique({
      where: { id: cuentaId },
      include: {
        socio: true,
        tipo_cuenta: { select: { nombre: true, moneda: true } },
        movimientos: { orderBy: [{ fecha_movimiento: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!cuenta) throw new NotFoundError('Cuenta de ahorro no encontrada');

    // Lo cobrado de funeraria y salud en cada colecta, para la misma fila
    const idsColecta = [
      ...new Set(
        cuenta.movimientos
          .map((m) => colectaDeReferencia(m.referencia))
          .filter((id): id is number => id !== null)
      ),
    ];
    const detalles = idsColecta.length
      ? await prisma.detalleColecta.findMany({
          where: { colecta_id: { in: idsColecta }, servicio: { in: ['funeraria', 'salud'] } },
        })
      : [];

    // Si el acuerdo quedó suspendido después del cobro, desde cuándo (Susp_Fun / Susp_Sal)
    const filtroMovimientos = { colecta_id: { in: idsColecta }, reversado: false };
    const [suspFun, suspSalud] = idsColecta.length
      ? await Promise.all([
          prisma.movimientoFuneraria.findMany({
            where: filtroMovimientos,
            select: { colecta_id: true, fecha_suspension: true },
          }),
          prisma.movimientoSalud.findMany({
            where: filtroMovimientos,
            select: { colecta_id: true, fecha_suspension: true },
          }),
        ])
      : [[], []];
    const suspensionPorColecta = (
      movimientos: { colecta_id: number | null; fecha_suspension: Date | null }[]
    ): Map<number, Date> => {
      const mapa = new Map<number, Date>();
      for (const m of movimientos) {
        if (m.colecta_id === null || !m.fecha_suspension) continue;
        const previa = mapa.get(m.colecta_id);
        if (!previa || m.fecha_suspension > previa) mapa.set(m.colecta_id, m.fecha_suspension);
      }
      return mapa;
    };
    const suspendidoFun = suspensionPorColecta(suspFun);
    const suspendidoSalud = suspensionPorColecta(suspSalud);

    const porColecta = new Map<
      number,
      { fun: number; salud: number; ano: number | null; semana: number | null }
    >();
    for (const d of detalles) {
      const fila = porColecta.get(d.colecta_id) ?? { fun: 0, salud: 0, ano: null, semana: null };
      if (d.servicio === 'funeraria') fila.fun += Number(d.monto_bs);
      else fila.salud += Number(d.monto_bs);
      // Hasta dónde quedó cubierto: la cobertura más lejana del cobro
      if (d.cobertura_ano_despues && d.cobertura_semana_despues) {
        const actual = (fila.ano ?? 0) * 100 + (fila.semana ?? 0);
        const nueva = d.cobertura_ano_despues * 100 + d.cobertura_semana_despues;
        if (nueva > actual) {
          fila.ano = d.cobertura_ano_despues;
          fila.semana = d.cobertura_semana_despues;
        }
      }
      porColecta.set(d.colecta_id, fila);
    }

    const renglones = cuenta.movimientos.map((m, indice) => {
      const colectaId = colectaDeReferencia(m.referencia);
      const cobro = colectaId !== null ? porColecta.get(colectaId) : undefined;
      const saldoBs =
        m.saldo_nuevo_bs !== null
          ? Number(m.saldo_nuevo_bs)
          : redondear(Number(m.saldo_nuevo_usd) * Number(m.tasa_cambio));

      return {
        item: indice + 1,
        fecha: m.fecha_movimiento,
        tipo: abreviarTipo(m.tipo_movimiento),
        ahorro_bs: Number(m.monto_bs),
        saldo_bs: saldoBs,
        // Ahorro en divisas: la libreta va en dólares, con depósito y retiro aparte
        ahorro_usd: Number(m.monto_usd),
        saldo_usd: Number(m.saldo_nuevo_usd),
        es_salida: Number(m.saldo_nuevo_usd) < Number(m.saldo_anterior_usd),
        semana: cobro?.semana ?? null,
        funeraria_bs: cobro ? redondear(cobro.fun) : null,
        salud_bs: cobro ? redondear(cobro.salud) : null,
        // Fecha del domingo de la última semana cubierta
        hasta:
          cobro?.ano && cobro.semana ? rangoDeSemana({ ano: cobro.ano, semana: cobro.semana }).fin : null,
        // YYYY-MM-DD; nulo si quedó activo
        susp_funeraria: colectaId !== null ? soloFecha(suspendidoFun.get(colectaId)) : null,
        susp_salud: colectaId !== null ? soloFecha(suspendidoSalud.get(colectaId)) : null,
      };
    });

    const socio = cuenta.socio;
    res.json({
      success: true,
      data: {
        encabezado: {
          socio: socio.codigo_socio,
          cuenta: cuenta.numero_cuenta,
          tipo_cuenta: cuenta.tipo_cuenta.nombre,
          moneda: cuenta.tipo_cuenta.moneda,
          // La de divisas lleva la fecha de apertura de la cuenta, no la de ingreso del socio
          fecha_apertura: cuenta.fecha_apertura,
          fecha_ingreso: socio.fecha_inscripcion,
          apellidos: nombreEnMayusculas(socio.apellido),
          nombres: nombreEnMayusculas(socio.nombre),
          cedula: socio.cedula,
        },
        renglones,
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al armar la libreta');
  }
};
