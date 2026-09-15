// Períodos del pago de salud: meses, semanas ISO y la feria que paga en un traslado.

import {
  contarPeriodos,
  etiquetaPeriodo,
  etiquetaRango,
  feriaDelPeriodo,
  periodosDesde,
  rangoPeriodo,
  validarPeriodo,
} from '../periodoSalud';

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('rangoPeriodo', () => {
  it('mes completo, incluido febrero bisiesto', () => {
    const feb = rangoPeriodo({ tipo: 'mensual', anio: 2028, numero: 2 });
    expect([iso(feb.inicio), iso(feb.fin)]).toEqual(['2028-02-01', '2028-02-29']);
    expect(feb.etiqueta).toBe('Febrero 2028');
  });

  it('semana ISO: la 1 de 2026 empieza el lunes 29 de diciembre de 2025', () => {
    const s1 = rangoPeriodo({ tipo: 'semanal', anio: 2026, numero: 1 });
    expect([iso(s1.inicio), iso(s1.fin)]).toEqual(['2025-12-29', '2026-01-04']);
    expect(s1.etiqueta).toBe('S01/2026');
  });

  it('rechaza períodos imposibles', () => {
    expect(validarPeriodo({ tipo: 'mensual', anio: 2026, numero: 13 })).toMatch(/mes/);
    expect(validarPeriodo({ tipo: 'semanal', anio: 2025, numero: 53 })).toMatch(/52 semanas/);
    expect(validarPeriodo({ tipo: 'semanal', anio: 2026, numero: 53 })).toBeNull();
    expect(() => rangoPeriodo({ tipo: 'mensual', anio: 1990, numero: 1 })).toThrow();
  });

  it('etiqueta sin calcular el rango', () => {
    expect(etiquetaPeriodo({ tipo: 'mensual', anio: 2026, numero: 9 })).toBe('Septiembre 2026');
  });
});

describe('varios períodos en un pago', () => {
  const semana = (anio: number, numero: number) => ({ tipo: 'semanal' as const, anio, numero });

  it('semanas seguidas que cruzan el año (2026 tiene 53)', () => {
    expect(periodosDesde(semana(2026, 52), 3)).toEqual([semana(2026, 52), semana(2026, 53), semana(2027, 1)]);
    expect(periodosDesde(semana(2025, 52), 2)).toEqual([semana(2025, 52), semana(2026, 1)]);
  });

  it('meses seguidos que cruzan el año', () => {
    expect(periodosDesde({ tipo: 'mensual', anio: 2026, numero: 11 }, 3).map(etiquetaPeriodo)).toEqual([
      'Noviembre 2026',
      'Diciembre 2026',
      'Enero 2027',
    ]);
  });

  it('cuenta y nombra el rango', () => {
    expect(contarPeriodos(semana(2026, 30), semana(2026, 38))).toBe(9);
    expect(contarPeriodos(semana(2026, 53), semana(2027, 2))).toBe(3);
    expect(etiquetaRango(semana(2026, 30), semana(2026, 38))).toBe('S30/2026 a S38/2026 (9 semanas)');
    expect(etiquetaRango(semana(2026, 30), semana(2026, 30))).toBe('S30/2026');
  });
});

describe('feriaDelPeriodo', () => {
  const septiembre = { inicio: dia('2026-09-01'), fin: dia('2026-09-30') };

  it('toda la vida en una feria', () => {
    expect(feriaDelPeriodo([{ feria_id: 1, fecha_inicio: dia('2025-01-10'), fecha_fin: null }], septiembre)).toBe(1);
  });

  it('trasladado a mitad de mes: paga la feria de la última asignación', () => {
    const historial = [
      { feria_id: 1, fecha_inicio: dia('2025-01-10'), fecha_fin: dia('2026-09-15') },
      { feria_id: 2, fecha_inicio: dia('2026-09-15'), fecha_fin: null },
    ];
    expect(feriaDelPeriodo(historial, septiembre)).toBe(2);
  });

  it('trasladado después del período: sigue pagando la feria anterior', () => {
    const historial = [
      { feria_id: 1, fecha_inicio: dia('2025-01-10'), fecha_fin: dia('2026-10-03') },
      { feria_id: 2, fecha_inicio: dia('2026-10-03'), fecha_fin: null },
    ];
    expect(feriaDelPeriodo(historial, septiembre)).toBe(1);
  });

  it('retirado a mitad de mes todavía cuenta; retirado antes, no', () => {
    expect(feriaDelPeriodo([{ feria_id: 1, fecha_inicio: dia('2025-01-10'), fecha_fin: dia('2026-09-05') }], septiembre)).toBe(1);
    expect(feriaDelPeriodo([{ feria_id: 1, fecha_inicio: dia('2025-01-10'), fecha_fin: dia('2026-08-31') }], septiembre)).toBeNull();
  });

  it('ingresó después del período: no cuenta', () => {
    expect(feriaDelPeriodo([{ feria_id: 1, fecha_inicio: dia('2026-10-01'), fecha_fin: null }], septiembre)).toBeNull();
  });
});
