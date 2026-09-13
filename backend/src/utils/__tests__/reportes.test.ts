// Forma común de los reportes: totales en la exportación y semanas adelantadas.

import { adelantoDelRenglon, filasParaExportar, nombreArchivo, type Reporte } from '../reportes';

const reporte: Reporte = {
  clave: 'prueba',
  titulo: 'Prueba',
  columnas: ['A', 'B', 'C'],
  filas: [['x', 1, 2]],
  totales: [{ etiqueta: 'Total', valor: 3 }],
};

describe('filasParaExportar', () => {
  it('agrega una fila vacía y los totales, del mismo ancho que la tabla', () => {
    expect(filasParaExportar(reporte)).toEqual([['x', 1, 2], ['', '', ''], ['Total', 3, '']]);
  });

  it('sin totales devuelve las filas tal cual', () => {
    expect(filasParaExportar({ ...reporte, totales: [] })).toEqual([['x', 1, 2]]);
  });
});

describe('nombreArchivo', () => {
  it('usa la fecha local y la extensión del formato', () => {
    expect(nombreArchivo('ferias-pendientes', 'excel', new Date(2026, 8, 13, 22, 0))).toBe('ferias-pendientes-2026-09-13.xlsx');
    expect(nombreArchivo('colectas', 'pdf', new Date(2026, 0, 2))).toBe('colectas-2026-01-02.pdf');
  });
});

describe('adelantoDelRenglon', () => {
  const cobro = { ano: 2026, semana: 36 };

  it('pago que deja cubiertas semanas futuras', () => {
    expect(adelantoDelRenglon(cobro, { ano: 2026, semana: 35 }, { ano: 2026, semana: 40 })).toEqual({
      desde: { ano: 2026, semana: 36 },
      hasta: { ano: 2026, semana: 40 },
      adelantadas: 4,
    });
  });

  it('pago que sólo pone al día: no es adelanto', () => {
    expect(adelantoDelRenglon(cobro, { ano: 2026, semana: 30 }, { ano: 2026, semana: 36 })).toBeNull();
  });

  it('adelanto que cruza de año', () => {
    const r = adelantoDelRenglon({ ano: 2026, semana: 52 }, { ano: 2026, semana: 52 }, { ano: 2027, semana: 2 });
    expect(r?.adelantadas).toBe(3);
    expect(r?.desde).toEqual({ ano: 2026, semana: 53 });
  });
});
