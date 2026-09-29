/**
 * El diferencial cambiario tiene que salir de lo que YA se cobro, no de una
 * estimacion con la tasa de hoy: si se recalcula manana con otra tasa, el
 * numero no puede moverse. Eso es lo que se comprueba aqui.
 */

import { diferencialDePrestamo } from '../diferencialCambiarioService';

/** Un prestamo de $100 otorgado a 850, con tres abonos a tasas distintas */
const prestamo = {
  id: 1,
  numero_prestamo: 'P-001',
  tasa_cambio_inicial: 850,
  monto_original_usd: 100,
  monto_original_bs: 85_000,
  abonos: [
    // A la misma tasa: no genera diferencial
    { id: 1, fecha_abono: new Date('2026-01-10'), monto_usd: 10, monto_bs: 8_500, tasa_cambio: 850 },
    // La tasa subio a 1.000: paga 1.500 Bs de mas por los mismos $10
    { id: 2, fecha_abono: new Date('2026-02-10'), monto_usd: 10, monto_bs: 10_000, tasa_cambio: 1_000 },
    // A 1.200: 3.500 Bs de mas
    { id: 3, fecha_abono: new Date('2026-03-10'), monto_usd: 10, monto_bs: 12_000, tasa_cambio: 1_200 },
  ],
};

const db = (datos: typeof prestamo | null) =>
  ({ prestamo: { findUnique: async () => datos } }) as never;

describe('diferencial cambiario', () => {
  it('suma lo cobrado de mas por cada abono, a la tasa de ese abono', async () => {
    const d = (await diferencialDePrestamo(db(prestamo), 1, 1_200))!;

    expect(d.abonado_usd).toBe(30);
    expect(d.abonado_bs).toBe(30_500);
    // 30 dolares a la tasa de otorgamiento habrian sido 25.500 Bs
    expect(d.abonado_a_tasa_inicial_bs).toBe(25_500);
    expect(d.diferencial_bs).toBe(5_000);
  });

  it('el abono cobrado a la tasa de otorgamiento no aporta diferencial', async () => {
    const d = (await diferencialDePrestamo(db(prestamo), 1, 1_200))!;
    expect(d.abonos[0]!.diferencial_bs).toBe(0);
    expect(d.abonos[1]!.diferencial_bs).toBe(1_500);
    expect(d.abonos[2]!.diferencial_bs).toBe(3_500);
  });

  it('NO cambia si manana la tasa es otra: solo mira lo ya cobrado', async () => {
    const hoy = (await diferencialDePrestamo(db(prestamo), 1, 1_200))!;
    const manana = (await diferencialDePrestamo(db(prestamo), 1, 5_000))!;
    expect(manana.diferencial_bs).toBe(hoy.diferencial_bs);
    // Lo que si cambia es su equivalente en dolares de hoy, que es otra cosa
    expect(manana.diferencial_usd).not.toBe(hoy.diferencial_usd);
  });

  it('si la tasa BAJA el diferencial es negativo: cobro de menos', async () => {
    const barato = {
      ...prestamo,
      abonos: [
        { id: 1, fecha_abono: new Date('2026-01-10'), monto_usd: 10, monto_bs: 7_000, tasa_cambio: 700 },
      ],
    };
    const d = (await diferencialDePrestamo(db(barato), 1, 700))!;
    expect(d.diferencial_bs).toBe(-1_500);
  });

  it('un prestamo sin abonos no tiene diferencial', async () => {
    const d = (await diferencialDePrestamo(db({ ...prestamo, abonos: [] }), 1, 1_200))!;
    expect(d.diferencial_bs).toBe(0);
    expect(d.abonos).toHaveLength(0);
  });

  it('sin tasa de hoy no divide entre cero', async () => {
    const d = (await diferencialDePrestamo(db(prestamo), 1, 0))!;
    expect(d.diferencial_usd).toBe(0);
    expect(d.diferencial_bs).toBe(5_000);
  });

  it('devuelve null si el prestamo no existe', async () => {
    expect(await diferencialDePrestamo(db(null), 99, 1_200)).toBeNull();
  });
});
