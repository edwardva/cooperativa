// Préstamos: tabla de cuotas, inicial, interés diario y avisos de atraso.

import {
  condicionesDelMonto,
  interesAcumulado,
  interesDelPeriodo,
  planDeCuotas,
  situacionDeAtraso,
  TABLA_PRESTAMOS,
  tramoDelMonto,
} from '../planPrestamo';

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('tabla de préstamos', () => {
  it('los bordes de cada tramo caen donde dice la tabla', () => {
    expect(tramoDelMonto(25)?.cuotas).toBe(1);
    expect(tramoDelMonto(26)?.cuotas).toBe(2);
    expect(tramoDelMonto(120)?.cuotas).toBe(5);
    expect(tramoDelMonto(121)?.cuotas).toBe(6);
    expect(tramoDelMonto(1000)?.cuotas).toBe(24);
    expect(tramoDelMonto(1001)?.cuotas).toBe(30);
  });

  it('fuera de la tabla no hay préstamo', () => {
    expect(tramoDelMonto(4)).toBeNull();
    expect(tramoDelMonto(2001)).toBeNull();
    expect(() => condicionesDelMonto(2500)).toThrow(/fuera de la tabla/);
  });

  it('el pago por cuota del tope de cada tramo es el de la tabla', () => {
    const esperado: Record<number, number> = {
      25: 25, 50: 25, 120: 24, 220: 36.67, 320: 40, 420: 42,
      520: 40, 620: 41.33, 720: 40, 1000: 41.67, 2000: 66.67,
    };
    for (const tramo of TABLA_PRESTAMOS) {
      expect(condicionesDelMonto(tramo.hasta).cuota_capital_usd).toBe(esperado[tramo.hasta]);
    }
  });

  it('la inicial es el porcentaje del tramo y va aparte de las cuotas', () => {
    const mil = condicionesDelMonto(1000);
    expect([mil.inicial_usd, mil.cuotas, mil.financiado_usd]).toEqual([500, 24, 1000]);
    const ciento = condicionesDelMonto(120);
    expect([ciento.inicial_usd, ciento.cuotas]).toEqual([24, 5]);
  });
});

describe('plan de cuotas', () => {
  it('una cuota cada 21 días desde la entrega', () => {
    const plan = planDeCuotas(120, 5, 1.5, dia('2026-09-01'));
    expect(plan.map((c) => iso(c.fecha_vencimiento))).toEqual([
      '2026-09-22', '2026-10-13', '2026-11-03', '2026-11-24', '2026-12-15',
    ]);
  });

  it('el capital cierra exacto: la última cuota absorbe el redondeo', () => {
    const plan = planDeCuotas(220, 6, 1.5, dia('2026-09-01'));
    const capital = plan.reduce((s, c) => s + c.monto_capital_usd, 0);
    expect(Math.round(capital * 100) / 100).toBe(220);
    expect(plan[5]!.saldo_restante_usd).toBe(0);
  });

  it('el interés estimado baja con el saldo', () => {
    const plan = planDeCuotas(120, 5, 1.5, dia('2026-09-01'));
    expect(plan[0]!.monto_interes_estimado_usd).toBeGreaterThan(plan[4]!.monto_interes_estimado_usd);
  });
});

describe('interés diario sobre el saldo', () => {
  it('un mes completo es la tasa mensual', () => {
    expect(interesDelPeriodo(1000, 1.5, 30)).toBe(15);
    expect(interesDelPeriodo(1000, 1, 30)).toBe(10);
  });

  it('21 días es la parte proporcional', () => {
    expect(interesDelPeriodo(1000, 1.5, 21)).toBe(10.5);
  });

  it('sin días o sin saldo no hay interés', () => {
    expect(interesDelPeriodo(1000, 1.5, 0)).toBe(0);
    expect(interesDelPeriodo(0, 1.5, 30)).toBe(0);
    expect(interesAcumulado(1000, 1.5, dia('2026-09-30'), dia('2026-09-01'))).toBe(0);
  });

  it('entre dos fechas cuenta los días corridos', () => {
    expect(interesAcumulado(600, 1, dia('2026-09-01'), dia('2026-10-01'))).toBe(6);
  });
});

describe('atraso: aviso a los 21 días y moroso a los 30', () => {
  const hoy = dia('2026-09-30');
  const cuota = (vence: string, pagada = false) => ({ fecha_vencimiento: dia(vence), pagada });

  it('sin cuotas vencidas está al día', () => {
    expect(situacionDeAtraso([cuota('2026-10-15'), cuota('2026-09-01', true)], hoy).situacion).toBe('al_dia');
  });

  it('20 días de atraso todavía no genera aviso; 21 sí', () => {
    expect(situacionDeAtraso([cuota('2026-09-10')], hoy).situacion).toBe('al_dia');
    expect(situacionDeAtraso([cuota('2026-09-09')], hoy).situacion).toBe('con_aviso');
  });

  it('a los 30 días queda moroso y cuenta las cuotas vencidas', () => {
    const r = situacionDeAtraso([cuota('2026-08-31'), cuota('2026-09-21')], hoy);
    expect([r.situacion, r.dias_atraso, r.cuotas_vencidas]).toEqual(['moroso', 30, 2]);
  });
});
