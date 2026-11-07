import { describe, expect, it } from 'vitest'
import type { ResumenServicio } from '../../services/colectaService'
import { agruparPorAcuerdo, fechaCorta } from './presentacion'

const servicio = (
  parcial: Partial<ResumenServicio> & Pick<ResumenServicio, 'servicio' | 'referencia_id'>
): ResumenServicio => ({
  titulo: 'Plan',
  detalle: 'Persona',
  numero_acuerdo: null,
  tarifa_semanal_usd: 0.96,
  fecha_ultimo_pago: null,
  pagado_hasta: null,
  pagado_hasta_texto: '',
  pagado_hasta_fecha: null,
  semanas_pendientes: 0,
  semanas_adelantadas: 0,
  estado: 'activo',
  estado_calculado: 'vigente',
  requiere_revision: false,
  monto_al_dia_usd: 0,
  ...parcial,
})

describe('fechaCorta', () => {
  it('muestra el domingo tal cual, sin correrlo al sabado', () => {
    // 08/11/2026 es domingo; como medianoche UTC en Venezuela seria el 07
    expect(fechaCorta('2026-11-08')).toBe('08/11/26')
    expect(fechaCorta('2026-11-08', true)).toBe('08/11/2026')
  })
})

describe('agruparPorAcuerdo', () => {
  it('deja un renglon por acuerdo de salud y no toca funeraria', () => {
    const r = agruparPorAcuerdo([
      servicio({ servicio: 'funeraria', referencia_id: 1, numero_acuerdo: 'F-1' }),
      servicio({ servicio: 'funeraria', referencia_id: 2, numero_acuerdo: 'F-2' }),
      servicio({ servicio: 'salud', referencia_id: 3, numero_acuerdo: 'S-1' }),
      servicio({ servicio: 'salud', referencia_id: 4, numero_acuerdo: 'S-1', semanas_pendientes: 2 }),
      servicio({ servicio: 'salud', referencia_id: 5, numero_acuerdo: 'S-1', estado: 'suspendido' }),
      servicio({ servicio: 'salud', referencia_id: 6, numero_acuerdo: 'S-2' }),
    ])
    expect(r.map((s) => s.numero_acuerdo)).toEqual(['F-1', 'F-2', 'S-1', 'S-2'])
    const s1 = r[2]!
    expect(s1.personas).toBe(3)
    // Se muestra la situacion mas atrasada y no se pierde la suspension
    expect(s1.semanas_pendientes).toBe(2)
    expect(s1.estado).toBe('suspendido')
  })
})
