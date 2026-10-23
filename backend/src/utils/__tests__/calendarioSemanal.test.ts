// Pruebas del calendario semanal.
//
// Cubren el escenario 4 de la validación acordada con el cliente ("pago que
// cruce de diciembre a enero"), que es donde el sistema viejo obliga a llamar
// al proveedor todos los años.

import {
  aOrdinal,
  deOrdinal,
  diferenciaSemanas,
  formatearPeriodo,
  lunesDeSemana,
  normalizarPeriodo,
  periodosEntre,
  rangoDeSemana,
  semanaDeFecha,
  semanasEnAno,
  sumarSemanas,
} from '../calendarioSemanal';

describe('semanaDeFecha', () => {
  it('ubica una fecha corriente en su semana', () => {
    // Jueves 3 de septiembre de 2026
    expect(semanaDeFecha(new Date(2026, 8, 3))).toEqual({ ano: 2026, semana: 36 });
  });

  it('devuelve el año del CALENDARIO, no el de la fecha, a fin de año', () => {
    // Confirmado el 23/10: la semana que contiene el 1 de enero ya es la
    // semana 1 del año nuevo. El 31/12/2026 (jueves) es semana 1 de 2027
    expect(semanaDeFecha(new Date(2026, 11, 31))).toEqual({ ano: 2027, semana: 1 });
    expect(semanaDeFecha(new Date(2026, 11, 28))).toEqual({ ano: 2027, semana: 1 });
    // El domingo anterior todavía es la última de 2026
    expect(semanaDeFecha(new Date(2026, 11, 27))).toEqual({ ano: 2026, semana: 52 });
    // El 1/1/2029 es lunes: semana 1 de 2029
    expect(semanaDeFecha(new Date(2029, 0, 1))).toEqual({ ano: 2029, semana: 1 });
    // Hoy coincide con la semana que tiene cargada el sistema viejo (43)
    expect(semanaDeFecha(new Date(2026, 9, 23))).toEqual({ ano: 2026, semana: 43 });
  });

  it('el lunes y el domingo de una misma semana dan el mismo período', () => {
    const lunes = semanaDeFecha(new Date(2026, 8, 7));
    const domingo = semanaDeFecha(new Date(2026, 8, 13));
    expect(lunes).toEqual(domingo);
  });
});

describe('semanasEnAno', () => {
  it('reconoce los años de 53 semanas sin asumir 52', () => {
    // 2026 ya no tiene semana 53: esa semana es la 1 de 2027
    expect(semanasEnAno(2026)).toBe(52);
    expect(semanasEnAno(2027)).toBe(52);
    // Con esta regla todavía hay años de 53: cuando el 1 de enero siguiente cae lunes
    expect(semanasEnAno(2028)).toBe(53);
  });
});

describe('ordinal', () => {
  it('ida y vuelta conserva el período', () => {
    for (const p of [
      { ano: 2026, semana: 1 },
      { ano: 2026, semana: 52 },
      { ano: 2027, semana: 1 },
      { ano: 2028, semana: 53 },
      { ano: 2030, semana: 27 },
    ]) {
      expect(deOrdinal(aOrdinal(p))).toEqual(p);
    }
  });

  it('avanza de uno en uno entre semanas consecutivas, aun cruzando el año', () => {
    const finDeAno = aOrdinal({ ano: 2026, semana: 52 });
    const inicioSiguiente = aOrdinal({ ano: 2027, semana: 1 });
    expect(inicioSiguiente - finDeAno).toBe(1);
  });
});

describe('sumarSemanas', () => {
  it('cruza de diciembre a enero sin intervención', () => {
    // Escenario del cliente: cubierto hasta la 51 de 2026 y paga 5 semanas
    expect(sumarSemanas({ ano: 2026, semana: 51 }, 5)).toEqual({ ano: 2027, semana: 4 });
  });

  it('después de la 52 de 2026 viene la 1 de 2027, sin semana 53', () => {
    expect(sumarSemanas({ ano: 2026, semana: 52 }, 1)).toEqual({ ano: 2027, semana: 1 });
    expect(sumarSemanas({ ano: 2026, semana: 52 }, 2)).toEqual({ ano: 2027, semana: 2 });
  });

  it('resta y deshace un pago (reverso)', () => {
    const antes = { ano: 2026, semana: 51 };
    const despues = sumarSemanas(antes, 5);
    expect(sumarSemanas(despues, -5)).toEqual(antes);
  });

  it('cubre el caso de una pendiente más diez adelantadas', () => {
    // Cubierto hasta la 50, semana actual 51: debe 1. Paga 11 (1 + 10).
    const cobertura = { ano: 2026, semana: 50 };
    expect(sumarSemanas(cobertura, 11)).toEqual({ ano: 2027, semana: 9 });
  });
});

describe('diferenciaSemanas', () => {
  it('cuenta las pendientes desde la cobertura hasta hoy', () => {
    expect(diferenciaSemanas({ ano: 2026, semana: 50 }, { ano: 2026, semana: 52 })).toBe(2);
  });

  it('cuenta las adelantadas como diferencia negativa', () => {
    expect(diferenciaSemanas({ ano: 2027, semana: 5 }, { ano: 2026, semana: 52 })).toBe(-5);
  });

  it('mide correctamente a través del cambio de año', () => {
    expect(diferenciaSemanas({ ano: 2026, semana: 51 }, { ano: 2027, semana: 3 })).toBe(4);
  });
});

describe('normalizarPeriodo', () => {
  it('corrige una semana fuera de rango en vez de guardarla mal', () => {
    expect(normalizarPeriodo({ ano: 2027, semana: 53 })).toEqual({ ano: 2028, semana: 1 });
    expect(normalizarPeriodo({ ano: 2027, semana: 0 })).toEqual({ ano: 2026, semana: 52 });
    // Una "semana 53 de 2026" (como las que guardaba el sistema viejo) es la 1 de 2027
    expect(normalizarPeriodo({ ano: 2026, semana: 53 })).toEqual({ ano: 2027, semana: 1 });
  });
});

describe('presentación', () => {
  it('formatea siempre con el año, para no confundir semanas de años distintos', () => {
    expect(formatearPeriodo({ ano: 2027, semana: 3 })).toBe('S03/2027');
    expect(formatearPeriodo(null)).toBe('—');
  });

  it('da el lunes y el domingo de la semana', () => {
    expect(rangoDeSemana({ ano: 2026, semana: 36 })).toEqual({
      inicio: '2026-08-31',
      fin: '2026-09-06',
    });
  });

  it('lunesDeSemana devuelve un lunes', () => {
    expect(lunesDeSemana(2026, 36).getUTCDay()).toBe(1);
  });
});

describe('periodosEntre', () => {
  it('lista las semanas cubiertas por un pago que cruza el año', () => {
    const periodos = periodosEntre({ ano: 2026, semana: 52 }, { ano: 2027, semana: 2 });
    expect(periodos).toEqual([
      { ano: 2026, semana: 52 },
      { ano: 2027, semana: 1 },
      { ano: 2027, semana: 2 },
    ]);
  });

  it('devuelve vacío si el rango está invertido', () => {
    expect(periodosEntre({ ano: 2027, semana: 2 }, { ano: 2026, semana: 52 })).toEqual([]);
  });
});
