// Estado de las cuotas recalculado desde lo abonado.
//
// Los casos que el marcado por abono resolvía mal: medios pagos que suman una
// cuota, el reverso que tiene que desmarcar, y la cuota vencida sin cubrir.

import { estadosDeCuotas } from '../amortizacion';

const HOY = new Date(2026, 8, 12);

/** Tres cuotas de $10, vencidas las dos primeras */
const plan = [
  { numero_cuota: 1, monto_total_usd: 10, fecha_vencimiento: new Date(2026, 7, 29) },
  { numero_cuota: 2, monto_total_usd: 10, fecha_vencimiento: new Date(2026, 8, 5) },
  { numero_cuota: 3, monto_total_usd: 10, fecha_vencimiento: new Date(2026, 8, 19) },
];

const estados = (aplicado: number) => estadosDeCuotas(plan, aplicado, HOY).map((e) => e.estado);

describe('estadosDeCuotas', () => {
  it('sin abonos: vencidas las que pasaron su fecha, pendiente la futura', () => {
    expect(estados(0)).toEqual(['vencida', 'vencida', 'pendiente']);
  });

  it('dos medios pagos que suman una cuota la dejan pagada', () => {
    expect(estados(5 + 5)).toEqual(['pagada', 'vencida', 'pendiente']);
  });

  it('un pago parcial no marca la cuota', () => {
    expect(estados(9.5)).toEqual(['vencida', 'vencida', 'pendiente']);
  });

  it('tolera el error de coma flotante al sumar abonos', () => {
    // 0.1 + 0.2 + 9.7 no da 10 exacto en coma flotante
    expect(estados(0.1 + 0.2 + 9.7)).toEqual(['pagada', 'vencida', 'pendiente']);
    // pero un centavo de menos sigue sin cubrir la cuota
    expect(estados(9.99)).toEqual(['vencida', 'vencida', 'pendiente']);
  });

  it('un abono grande cubre varias cuotas en orden', () => {
    expect(estados(25)).toEqual(['pagada', 'pagada', 'pendiente']);
  });

  it('al reversar, bajar el total desmarca desde la última', () => {
    expect(estados(30)).toEqual(['pagada', 'pagada', 'pagada']);
    expect(estados(20)).toEqual(['pagada', 'pagada', 'pendiente']);
  });

  it('no depende del orden en que llega el plan', () => {
    const desordenado = [plan[2]!, plan[0]!, plan[1]!];
    expect(estadosDeCuotas(desordenado, 10, HOY).map((e) => e.numero_cuota)).toEqual([1, 2, 3]);
  });
});
