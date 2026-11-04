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
// Todo en bolívares: Ahorros a la Vista es un producto en Bs. Se imprime el
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
        tipo_cuenta: { select: { nombre: true } },
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
        semana: cobro?.semana ?? null,
        funeraria_bs: cobro ? redondear(cobro.fun) : null,
        salud_bs: cobro ? redondear(cobro.salud) : null,
        // Fecha del domingo de la última semana cubierta
        hasta:
          cobro?.ano && cobro.semana ? rangoDeSemana({ ano: cobro.ano, semana: cobro.semana }).fin : null,
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
