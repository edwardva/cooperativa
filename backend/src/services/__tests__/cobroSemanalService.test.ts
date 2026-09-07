// Pruebas del paquete semanal de colecta.
//
// Cubren los escenarios 1, 2 y 3 de la validación con el cliente: socio con dos
// servicios y socio con uno solo, semanas pendientes y adelantadas, y "una
// pendiente más diez adelantadas".

import {
  armarPaquete,
  resumirServicio,
  semanasParaPonerseAlDia,
  tarifaDeAcuerdo,
  validarIntegridadDelPaquete,
  type AcuerdoCobrable,
} from '../cobroSemanalService';
import { calcularSituacion, type AcuerdoConCobertura } from '../coberturaService';
import type { TarifasColecta } from '../tarifasService';

const HOY = { ano: 2026, semana: 36 };

/** Las tarifas de referencia que dio el cliente. */
const TARIFAS: TarifasColecta = {
  ahorro_usd: 0.03,
  funeraria_usd: 0.75,
  salud_usd: 0.96,
  max_semanas_adelanto: 10,
  bloquear_adelanto_excedido: false,
  semanas_suspension_funeraria: 6,
  semanas_suspension_salud: 6,
};

const TASA = 100;

const crearAcuerdo = (
  servicio: 'funeraria' | 'salud',
  opciones: { id?: number; pagadoHasta?: number; ano?: number; estado?: string; plan?: number } = {}
): AcuerdoCobrable => {
  const base: AcuerdoConCobertura = {
    ano_pagado_hasta: opciones.ano ?? 2026,
    semana_pagada_hasta: opciones.pagadoHasta ?? 36,
    fecha_ultimo_pago: new Date(2026, 8, 1),
    semanas_sin_pago: 0,
    fecha_inicio: new Date(2020, 0, 1),
    estado: opciones.estado ?? 'activo',
  };
  return {
    servicio,
    referencia_id: opciones.id ?? (servicio === 'funeraria' ? 1 : 2),
    titulo: servicio === 'funeraria' ? 'Plan funerario' : 'Plan de salud',
    detalle: 'Juan Pérez',
    numero_acuerdo: 'A-1',
    monto_plan_usd: opciones.plan ?? 0,
    situacion: calcularSituacion(base, 6, HOY),
  };
};

describe('tarifaDeAcuerdo', () => {
  it('manda la tarifa general del parámetro, no la del catálogo', () => {
    // El catálogo trae valores de relleno (USD 5,00 en funeraria) frente a los
    // USD 0,75 que cobra la cooperativa de verdad. Darle precedencia cobraba
    // de más.
    expect(tarifaDeAcuerdo(crearAcuerdo('funeraria', { plan: 5 }), TARIFAS)).toBe(0.75);
    expect(tarifaDeAcuerdo(crearAcuerdo('salud', { plan: 3 }), TARIFAS)).toBe(0.96);
  });

  it('cae en la del plan sólo si el parámetro está vacío o en cero', () => {
    const sinTarifas = { ...TARIFAS, funeraria_usd: 0 };
    expect(tarifaDeAcuerdo(crearAcuerdo('funeraria', { plan: 1.25 }), sinTarifas)).toBe(1.25);
  });

  it('usa la tarifa general cuando el plan no trae ninguna', () => {
    expect(tarifaDeAcuerdo(crearAcuerdo('funeraria'), TARIFAS)).toBe(0.75);
    expect(tarifaDeAcuerdo(crearAcuerdo('salud'), TARIFAS)).toBe(0.96);
  });
});

describe('armarPaquete — socio con ambos servicios', () => {
  const acuerdos = [crearAcuerdo('funeraria'), crearAcuerdo('salud')];

  it('una semana cobra ahorro + funeraria + salud', () => {
    const p = armarPaquete({ semanas: 1, acuerdos, tarifas: TARIFAS, tasa: TASA, cuentaAhorroId: 7 });

    expect(p.totales.ahorro_usd).toBe(0.03);
    expect(p.totales.funeraria_usd).toBe(0.75);
    expect(p.totales.salud_usd).toBe(0.96);
    expect(p.totales.total_usd).toBe(1.74);
    expect(p.totales.total_bs).toBe(174);
  });

  it('las semanas multiplican por igual los tres conceptos', () => {
    const p = armarPaquete({ semanas: 4, acuerdos, tarifas: TARIFAS, tasa: TASA, cuentaAhorroId: 7 });
    expect(p.totales.ahorro_usd).toBe(0.12);
    expect(p.totales.funeraria_usd).toBe(3);
    expect(p.totales.salud_usd).toBe(3.84);
    expect(p.totales.total_usd).toBe(6.96);
  });

  it('suma el ahorro voluntario al obligatorio', () => {
    // El ejemplo del cliente: 2 semanas de ahorro obligatorio + un adicional
    const p = armarPaquete({
      semanas: 2,
      acuerdos: [],
      tarifas: TARIFAS,
      tasa: TASA,
      cuentaAhorroId: 7,
      ahorroAdicionalUsd: 5,
    });
    expect(p.totales.ahorro_usd).toBe(5.06);
  });
});

describe('armarPaquete — socio con un solo servicio', () => {
  it('cobra ese servicio y el ahorro, sin inventar el otro', () => {
    const p = armarPaquete({
      semanas: 1,
      acuerdos: [crearAcuerdo('funeraria')],
      tarifas: TARIFAS,
      tasa: TASA,
      cuentaAhorroId: 7,
    });
    expect(p.totales.funeraria_usd).toBe(0.75);
    expect(p.totales.salud_usd).toBe(0);
    expect(p.totales.total_usd).toBe(0.78);
  });
});

describe('armarPaquete — cobertura resultante', () => {
  it('avanza la cobertura de cada servicio las semanas cobradas', () => {
    const acuerdos = [crearAcuerdo('funeraria', { pagadoHasta: 35 })];
    const p = armarPaquete({ semanas: 3, acuerdos, tarifas: TARIFAS, tasa: TASA, cuentaAhorroId: null });

    const renglon = p.renglones.find((r) => r.servicio === 'funeraria')!;
    expect(renglon.cobertura_antes).toEqual({ ano: 2026, semana: 35 });
    expect(renglon.cobertura_despues).toEqual({ ano: 2026, semana: 38 });
  });

  it('cruza de diciembre a enero al calcular la cobertura resultante', () => {
    const acuerdos = [crearAcuerdo('salud', { pagadoHasta: 51 })];
    const p = armarPaquete({ semanas: 5, acuerdos, tarifas: TARIFAS, tasa: TASA, cuentaAhorroId: null });
    expect(p.renglones[0]!.cobertura_despues).toEqual({ ano: 2027, semana: 3 });
  });
});

describe('armarPaquete — advertencias', () => {
  it('advierte al pasar del tope de adelanto, sin impedir el cobro', () => {
    // Al día, así que las 12 semanas son todas adelanto
    const p = armarPaquete({
      semanas: 12,
      acuerdos: [crearAcuerdo('funeraria')],
      tarifas: TARIFAS,
      tasa: TASA,
      cuentaAhorroId: 7,
    });
    expect(p.advertencias).toHaveLength(1);
    expect(p.advertencias[0]).toContain('12 semanas');
    expect(p.totales.total_usd).toBeGreaterThan(0);
  });

  it('no advierte por "una pendiente más diez adelantadas"', () => {
    // Debe 1 semana y paga 11: son 10 de adelanto, dentro de la política
    const p = armarPaquete({
      semanas: 11,
      acuerdos: [crearAcuerdo('funeraria', { pagadoHasta: 35 })],
      tarifas: TARIFAS,
      tasa: TASA,
      cuentaAhorroId: 7,
    });
    expect(p.advertencias).toHaveLength(0);
  });

  it('avisa si el socio no tiene cuenta de ahorro donde poner el obligatorio', () => {
    const p = armarPaquete({
      semanas: 1,
      acuerdos: [crearAcuerdo('funeraria')],
      tarifas: TARIFAS,
      tasa: TASA,
      cuentaAhorroId: null,
    });
    expect(p.advertencias[0]).toContain('cuenta de ahorro');
    expect(p.totales.ahorro_usd).toBe(0);
  });
});

describe('semanasParaPonerseAlDia', () => {
  it('toma el mayor atraso entre los servicios', () => {
    const acuerdos = [
      crearAcuerdo('funeraria', { pagadoHasta: 34 }), // debe 2
      crearAcuerdo('salud', { pagadoHasta: 31 }), // debe 5
    ];
    expect(semanasParaPonerseAlDia(acuerdos)).toBe(5);
  });

  it('es cero si están todos al día', () => {
    expect(semanasParaPonerseAlDia([crearAcuerdo('funeraria')])).toBe(0);
  });
});

describe('validarIntegridadDelPaquete', () => {
  const acuerdos = [crearAcuerdo('funeraria', { id: 1 }), crearAcuerdo('salud', { id: 2 })];

  it('rechaza cobrar sólo uno de los dos servicios contratados', () => {
    const problemas = validarIntegridadDelPaquete({
      acuerdosDelSocio: acuerdos,
      cobrados: [{ servicio: 'funeraria', referencia_id: 1, semanas: 1 }],
      tarifas: TARIFAS,
      semanasSolicitadas: 1,
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]!.codigo).toBe('SERVICIO_FALTANTE');
    expect(problemas[0]!.mensaje).toContain('salud');
  });

  it('acepta el paquete completo', () => {
    const problemas = validarIntegridadDelPaquete({
      acuerdosDelSocio: acuerdos,
      cobrados: [
        { servicio: 'funeraria', referencia_id: 1, semanas: 1 },
        { servicio: 'salud', referencia_id: 2, semanas: 1 },
      ],
      tarifas: TARIFAS,
      semanasSolicitadas: 1,
    });
    expect(problemas).toHaveLength(0);
  });

  it('no exige el acuerdo suspendido: reactivarlo es otra decisión', () => {
    const conSuspendido = [
      crearAcuerdo('funeraria', { id: 1 }),
      crearAcuerdo('salud', { id: 2, estado: 'suspendido' }),
    ];
    const problemas = validarIntegridadDelPaquete({
      acuerdosDelSocio: conSuspendido,
      cobrados: [{ servicio: 'funeraria', referencia_id: 1, semanas: 1 }],
      tarifas: TARIFAS,
      semanasSolicitadas: 1,
    });
    expect(problemas).toHaveLength(0);
  });

  it('no valida nada si no se cobra ningún servicio (depósito o abono suelto)', () => {
    const problemas = validarIntegridadDelPaquete({
      acuerdosDelSocio: acuerdos,
      cobrados: [],
      tarifas: TARIFAS,
      semanasSolicitadas: 1,
    });
    expect(problemas).toHaveLength(0);
  });

  it('exige que todos los servicios cubran las mismas semanas', () => {
    const problemas = validarIntegridadDelPaquete({
      acuerdosDelSocio: acuerdos,
      cobrados: [
        { servicio: 'funeraria', referencia_id: 1, semanas: 2 },
        { servicio: 'salud', referencia_id: 2, semanas: 1 },
      ],
      tarifas: TARIFAS,
      semanasSolicitadas: 2,
    });
    expect(problemas.map((p) => p.codigo)).toContain('SEMANAS_DISPARES');
  });

  it('bloquea el adelanto excedido sólo si el parámetro lo pide', () => {
    const estrictas = { ...TARIFAS, bloquear_adelanto_excedido: true };
    const problemas = validarIntegridadDelPaquete({
      acuerdosDelSocio: acuerdos,
      cobrados: [
        { servicio: 'funeraria', referencia_id: 1, semanas: 15 },
        { servicio: 'salud', referencia_id: 2, semanas: 15 },
      ],
      tarifas: estrictas,
      semanasSolicitadas: 15,
    });
    expect(problemas.map((p) => p.codigo)).toContain('ADELANTO_EXCEDIDO');
  });
});

describe('resumirServicio', () => {
  it('separa la fecha del pago de la cobertura alcanzada', () => {
    const r = resumirServicio(crearAcuerdo('funeraria', { pagadoHasta: 40 }), TARIFAS);
    expect(r.fecha_ultimo_pago).toEqual(new Date(2026, 8, 1));
    expect(r.pagado_hasta_texto).toBe('S40/2026');
    expect(r.semanas_adelantadas).toBe(4);
    expect(r.semanas_pendientes).toBe(0);
  });

  it('calcula lo que cuesta ponerse al día', () => {
    const r = resumirServicio(crearAcuerdo('salud', { pagadoHasta: 33 }), TARIFAS);
    expect(r.semanas_pendientes).toBe(3);
    expect(r.monto_al_dia_usd).toBe(2.88);
  });
});
