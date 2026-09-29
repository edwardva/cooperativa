// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Diferencial cambiario de un prestamo
// ============================================
//
// Pedido por la cooperativa al probar el sistema:
//
//   "Mostrar calculo del diferencial, es decir cuanto se presto y cuanto se
//    esta cobrando: es una suma de lo que se esta cobrando demas por los
//    cambios de la tasa monetaria. Mostrar un campo donde se vea el monto que
//    va sumando respecto a lo que se esta cobrando."
//
// El prestamo se otorga a una tasa (`tasa_cambio_inicial`) y cada abono se
// cobra a la del dia (`tasa_cambio` del abono). Si la tasa subio, el socio
// entrega mas bolivares por el mismo dolar de deuda; esa diferencia es el
// diferencial.
//
// Por cada abono no reversado:
//
//     diferencial = monto_bs cobrado  -  monto_usd x tasa inicial
//
// No se estima ni se deriva de la tasa de hoy: cada abono guarda la tasa a la
// que se cobro, asi que la suma es exacta y no cambia al recalcularla manana.
//
// Los abonos REVERSADOS no cuentan: ese dinero se devolvio.

import type { Prisma, PrismaClient } from '@prisma/client';
import { redondear } from './cobroSemanalService';

type Db = PrismaClient | Prisma.TransactionClient;

/** Lo que aporto un abono al diferencial */
export interface AbonoDelDiferencial {
  abono_id: number;
  fecha: Date;
  monto_usd: number;
  /** Bolivares que entrego el socio */
  monto_bs: number;
  /** Tasa a la que se le cobro */
  tasa_cambio: number;
  /** Lo que habria pagado a la tasa de otorgamiento */
  equivalente_inicial_bs: number;
  /** La diferencia. Negativo si la tasa bajo y pago menos */
  diferencial_bs: number;
}

export interface DiferencialCambiario {
  prestamo_id: number;
  numero_prestamo: string;
  tasa_inicial: number;
  /** Lo que se presto, en las dos monedas */
  prestado_usd: number;
  prestado_bs: number;
  /** Lo abonado hasta hoy, sin contar reversados */
  abonado_usd: number;
  abonado_bs: number;
  /** Lo que se habria cobrado si la tasa no hubiera cambiado */
  abonado_a_tasa_inicial_bs: number;
  /** El monto que va sumando: lo cobrado de mas por el cambio de tasa */
  diferencial_bs: number;
  /** El mismo diferencial llevado a dolares de hoy, para poder compararlo */
  diferencial_usd: number;
  /** Cuanto subio la tasa desde el otorgamiento, en porcentaje */
  variacion_tasa_pct: number;
  abonos: AbonoDelDiferencial[];
}

/**
 * Diferencial de un prestamo. `tasaHoy` solo se usa para expresar el resultado
 * en dolares: el diferencial en bolivares no depende de ella.
 */
export const diferencialDePrestamo = async (
  db: Db,
  prestamoId: number,
  tasaHoy: number
): Promise<DiferencialCambiario | null> => {
  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    select: {
      id: true,
      numero_prestamo: true,
      tasa_cambio_inicial: true,
      monto_original_usd: true,
      monto_original_bs: true,
      abonos: {
        where: { reversado: false },
        orderBy: { fecha_abono: 'asc' },
        select: {
          id: true,
          fecha_abono: true,
          monto_usd: true,
          monto_bs: true,
          tasa_cambio: true,
        },
      },
    },
  });

  if (!prestamo) return null;

  const tasaInicial = Number(prestamo.tasa_cambio_inicial);

  const abonos: AbonoDelDiferencial[] = prestamo.abonos.map((a) => {
    const montoUsd = Number(a.monto_usd);
    const montoBs = Number(a.monto_bs);
    const equivalente = montoUsd * tasaInicial;
    return {
      abono_id: a.id,
      fecha: a.fecha_abono,
      monto_usd: redondear(montoUsd),
      monto_bs: redondear(montoBs),
      tasa_cambio: Number(a.tasa_cambio),
      equivalente_inicial_bs: redondear(equivalente),
      diferencial_bs: redondear(montoBs - equivalente),
    };
  });

  const abonadoUsd = abonos.reduce((t, a) => t + a.monto_usd, 0);
  const abonadoBs = abonos.reduce((t, a) => t + a.monto_bs, 0);
  const aTasaInicial = abonos.reduce((t, a) => t + a.equivalente_inicial_bs, 0);
  const diferencial = abonadoBs - aTasaInicial;

  return {
    prestamo_id: prestamo.id,
    numero_prestamo: prestamo.numero_prestamo,
    tasa_inicial: tasaInicial,
    prestado_usd: redondear(Number(prestamo.monto_original_usd)),
    prestado_bs: redondear(Number(prestamo.monto_original_bs)),
    abonado_usd: redondear(abonadoUsd),
    abonado_bs: redondear(abonadoBs),
    abonado_a_tasa_inicial_bs: redondear(aTasaInicial),
    diferencial_bs: redondear(diferencial),
    // Si no hay tasa util se deja en cero en vez de dividir entre cero
    diferencial_usd: tasaHoy > 0 ? redondear(diferencial / tasaHoy) : 0,
    variacion_tasa_pct:
      tasaInicial > 0 ? redondear(((tasaHoy - tasaInicial) / tasaInicial) * 100) : 0,
    abonos,
  };
};
