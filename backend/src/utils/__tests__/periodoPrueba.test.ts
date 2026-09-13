// Período de prueba del trabajador: meses de calendario sobre columnas DATE.

import { situacionPrueba, sumarMeses } from '../periodoPrueba';

/** Así llega una columna DATE desde Prisma: medianoche UTC */
const fechaBD = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('sumarMeses', () => {
  it('suma meses de calendario', () => {
    expect(iso(sumarMeses(fechaBD('2026-06-10'), 3))).toBe('2026-09-10');
  });

  it('usa el último día cuando el mes destino es más corto', () => {
    expect(iso(sumarMeses(fechaBD('2026-01-31'), 1))).toBe('2026-02-28');
    expect(iso(sumarMeses(fechaBD('2027-11-30'), 3))).toBe('2028-02-29');
  });

  it('cruza de año', () => {
    expect(iso(sumarMeses(fechaBD('2026-11-15'), 3))).toBe('2027-02-15');
  });
});

describe('situacionPrueba', () => {
  const ingreso = fechaBD('2026-06-10');

  it('el día anterior al fin todavía está en prueba', () => {
    const s = situacionPrueba(ingreso, 3, new Date(2026, 8, 9, 15, 0));
    expect(s.cumplida).toBe(false);
    expect(s.dias_restantes).toBe(1);
    expect(iso(s.fin_prueba)).toBe('2026-09-10');
  });

  it('el día del fin ya la cumplió', () => {
    const s = situacionPrueba(ingreso, 3, new Date(2026, 8, 10, 8, 0));
    expect(s.cumplida).toBe(true);
    expect(s.dias_restantes).toBe(0);
  });

  it('cuenta los días trabajados desde el ingreso', () => {
    expect(situacionPrueba(ingreso, 3, new Date(2026, 5, 20, 23, 59)).dias_trabajados).toBe(10);
  });

  it('una hora de la noche no cambia el día (UTC-4 no retrocede la fecha)', () => {
    const tarde = situacionPrueba(ingreso, 3, new Date(2026, 8, 10, 23, 30));
    expect(tarde.cumplida).toBe(true);
  });
});
