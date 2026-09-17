// Recálculo de un préstamo viejo con el interés diario del cálculo nuevo.

import { simularConversionPrestamo } from '../conversionPrestamosService';

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('simularConversionPrestamo', () => {
  const base = { monto_original_usd: 1000, fecha_desembolso: dia('2026-01-01'), tasa_mensual: 1.5 };

  it('sin abonos, corre el interés desde el desembolso', () => {
    const r = simularConversionPrestamo({ ...base, abonos: [] }, dia('2026-01-31'));
    expect([r.saldo_capital_usd, r.saldo_interes_usd, r.deuda_total_usd]).toEqual([1000, 15, 1015]);
  });

  it('cada abono paga primero el interés corrido y después el capital', () => {
    const r = simularConversionPrestamo(
      { ...base, abonos: [{ fecha_abono: dia('2026-01-31'), monto_usd: 115 }] },
      dia('2026-01-31')
    );
    // 15 de interés y 100 de capital
    expect([r.saldo_capital_usd, r.saldo_interes_usd]).toEqual([900, 0]);
    expect(r.abonos_aplicados).toBe(1);
  });

  it('el interés siguiente corre sobre el capital que quedó', () => {
    const r = simularConversionPrestamo(
      { ...base, abonos: [{ fecha_abono: dia('2026-01-31'), monto_usd: 115 }] },
      dia('2026-03-02')
    );
    // 30 días más sobre 900: 13,50
    expect(r.saldo_interes_usd).toBe(13.5);
    expect(r.deuda_total_usd).toBe(913.5);
  });

  it('un abono que pasa la deuda deja sobrante y el préstamo en cero', () => {
    const r = simularConversionPrestamo(
      { ...base, abonos: [{ fecha_abono: dia('2026-01-31'), monto_usd: 1200 }] },
      dia('2026-06-30')
    );
    expect([r.saldo_capital_usd, r.saldo_interes_usd, r.deuda_total_usd]).toEqual([0, 0, 0]);
    expect(r.sobrante_usd).toBe(185);
  });

  it('pagar antes abarata: el mismo abono más temprano deja menos deuda', () => {
    const temprano = simularConversionPrestamo(
      { ...base, abonos: [{ fecha_abono: dia('2026-01-15'), monto_usd: 300 }] },
      dia('2026-06-30')
    );
    const tarde = simularConversionPrestamo(
      { ...base, abonos: [{ fecha_abono: dia('2026-05-15'), monto_usd: 300 }] },
      dia('2026-06-30')
    );
    expect(temprano.deuda_total_usd).toBeLessThan(tarde.deuda_total_usd);
  });
});
