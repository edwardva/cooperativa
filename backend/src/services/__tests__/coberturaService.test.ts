// Pruebas de la cobertura por (año, semana).
//
// Cubren los escenarios 2, 3 y 4 de la validación acordada con el cliente:
// semanas pendientes y adelantadas, "una pendiente más diez adelantadas", y el
// pago que cruza de diciembre a enero.

import {
  aplicarPago,
  calcularSituacion,
  coberturaDe,
  coberturaInicial,
  deshacerPago,
  semanasSinPagoDerivadas,
  type AcuerdoConCobertura,
} from '../coberturaService';

/** Semana 36 de 2026: la "semana actual" de todas estas pruebas. */
const HOY = { ano: 2026, semana: 36 };

const acuerdo = (parcial: Partial<AcuerdoConCobertura> = {}): AcuerdoConCobertura => ({
  ano_pagado_hasta: null,
  semana_pagada_hasta: null,
  fecha_ultimo_pago: null,
  semanas_sin_pago: 0,
  fecha_inicio: new Date(2020, 0, 1),
  estado: 'activo',
  ...parcial,
});

describe('coberturaDe', () => {
  it('usa la cobertura guardada cuando existe', () => {
    const a = acuerdo({ ano_pagado_hasta: 2026, semana_pagada_hasta: 30 });
    expect(coberturaDe(a, HOY)).toEqual({ ano: 2026, semana: 30 });
  });

  it('la deduce del contador viejo mientras no haya cobertura cargada', () => {
    // 4 semanas sin pagar equivale a estar cubierto hasta 4 semanas atrás
    expect(coberturaDe(acuerdo({ semanas_sin_pago: 4 }), HOY)).toEqual({ ano: 2026, semana: 32 });
  });

  it('la cobertura guardada manda sobre el contador, aunque no coincidan', () => {
    const a = acuerdo({ ano_pagado_hasta: 2027, semana_pagada_hasta: 2, semanas_sin_pago: 9 });
    expect(coberturaDe(a, HOY)).toEqual({ ano: 2027, semana: 2 });
  });
});

describe('coberturaInicial', () => {
  it('arranca en la semana anterior, para que la primera ya se deba', () => {
    // 3/9/2026 cae en la semana 36; el acuerdo arranca cubierto hasta la 35
    expect(coberturaInicial(new Date(2026, 8, 3))).toEqual({ ano: 2026, semana: 35 });
  });
});

describe('calcularSituacion', () => {
  it('un socio al día no tiene pendientes ni adelantos', () => {
    const s = calcularSituacion(acuerdo({ ano_pagado_hasta: 2026, semana_pagada_hasta: 36 }), 6, HOY);
    expect(s.semanas_pendientes).toBe(0);
    expect(s.semanas_adelantadas).toBe(0);
    expect(s.estado_calculado).toBe('vigente');
  });

  it('cuenta las semanas pendientes desde la cobertura', () => {
    const s = calcularSituacion(acuerdo({ ano_pagado_hasta: 2026, semana_pagada_hasta: 33 }), 6, HOY);
    expect(s.semanas_pendientes).toBe(3);
    expect(s.estado_calculado).toBe('atrasado');
  });

  it('suspende al alcanzar el umbral, no antes', () => {
    const cinco = calcularSituacion(acuerdo({ ano_pagado_hasta: 2026, semana_pagada_hasta: 31 }), 6, HOY);
    expect(cinco.semanas_pendientes).toBe(5);
    expect(cinco.estado_calculado).toBe('atrasado');

    const seis = calcularSituacion(acuerdo({ ano_pagado_hasta: 2026, semana_pagada_hasta: 30 }), 6, HOY);
    expect(seis.semanas_pendientes).toBe(6);
    expect(seis.estado_calculado).toBe('suspendido');
  });

  it('un pago adelantado NO deja al socio como atrasado', () => {
    // Este es el caso que el personal marcó como mal calculado en la demo
    const s = calcularSituacion(acuerdo({ ano_pagado_hasta: 2027, semana_pagada_hasta: 3 }), 6, HOY);
    expect(s.semanas_pendientes).toBe(0);
    expect(s.semanas_adelantadas).toBe(20);
    expect(s.estado_calculado).toBe('vigente');
  });

  it('avisa cuando el estado guardado no coincide con el calculado', () => {
    // Suspendido en la base, pero pagó por adelantado: hay que revisarlo
    const s = calcularSituacion(
      acuerdo({ ano_pagado_hasta: 2027, semana_pagada_hasta: 3, estado: 'suspendido' }),
      6,
      HOY
    );
    expect(s.requiere_revision).toBe(true);
  });

  it('no marca revisión por un atraso que aún no llega al umbral', () => {
    const s = calcularSituacion(acuerdo({ ano_pagado_hasta: 2026, semana_pagada_hasta: 34 }), 6, HOY);
    expect(s.estado_calculado).toBe('atrasado');
    expect(s.requiere_revision).toBe(false);
  });

  it('un umbral en cero desactiva la suspensión automática', () => {
    const s = calcularSituacion(acuerdo({ ano_pagado_hasta: 2025, semana_pagada_hasta: 1 }), 0, HOY);
    expect(s.semanas_pendientes).toBeGreaterThan(50);
    expect(s.estado_calculado).toBe('atrasado');
  });
});

describe('aplicarPago', () => {
  it('cubre el escenario "una pendiente más diez adelantadas"', () => {
    // Cubierto hasta la 35 y hoy es la 36: debe 1. Paga 11 semanas.
    const cobertura = { ano: 2026, semana: 35 };
    const nueva = aplicarPago(cobertura, 11);
    expect(nueva).toEqual({ ano: 2026, semana: 46 });

    const s = calcularSituacion(
      acuerdo({ ano_pagado_hasta: nueva.ano, semana_pagada_hasta: nueva.semana }),
      6,
      HOY
    );
    expect(s.semanas_pendientes).toBe(0);
    expect(s.semanas_adelantadas).toBe(10);
  });

  it('cruza de diciembre a enero sin intervención técnica', () => {
    // Cubierto hasta la 50 de 2026 (año de 53 semanas) y paga 6 semanas
    expect(aplicarPago({ ano: 2026, semana: 50 }, 6)).toEqual({ ano: 2027, semana: 3 });
  });

  it('el reverso devuelve la cobertura exactamente a donde estaba', () => {
    const antes = { ano: 2026, semana: 50 };
    expect(deshacerPago(aplicarPago(antes, 6), 6)).toEqual(antes);
  });
});

describe('semanasSinPagoDerivadas', () => {
  it('reproduce el contador para los módulos que todavía lo leen', () => {
    expect(semanasSinPagoDerivadas({ ano: 2026, semana: 33 }, HOY)).toBe(3);
  });

  it('nunca es negativo, aunque el socio haya adelantado', () => {
    expect(semanasSinPagoDerivadas({ ano: 2027, semana: 3 }, HOY)).toBe(0);
  });
});
