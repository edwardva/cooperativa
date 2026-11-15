import { datosDeRetiro } from '../datosRetiro';

describe('datosDeRetiro', () => {
  it('separa motivo y fecha del retiro manual', () => {
    expect(
      datosDeRetiro({ motivo: 'Retiro: Fallecimiento (fecha 2026-11-10)', fecha: new Date('2026-11-11T15:00:00Z') }, null)
    ).toEqual({ motivo: 'Fallecimiento', fecha: '2026-11-10' });
  });

  it('el retiro automatico usa su motivo y la fecha del historial', () => {
    expect(
      datosDeRetiro(
        { motivo: 'Artículo 5, literal c: pasividad mayor a seis meses (30 semanas sin pagar)', fecha: new Date('2026-10-05T12:00:00Z') },
        'Motivo retiro: VIEJO'
      )
    ).toEqual({ motivo: 'Artículo 5, literal c: pasividad mayor a seis meses (30 semanas sin pagar)', fecha: '2026-10-05' });
  });

  it('sin historial toma lo que la migracion dejo en las notas', () => {
    expect(
      datosDeRetiro(null, 'DEBE CARNET\n\nMotivo retiro: RENUNCIA\n\nFecha retiro: 2019-03-02')
    ).toEqual({ motivo: 'RENUNCIA', fecha: '2019-03-02' });
  });

  it('solo la fecha o solo el motivo tambien sirven', () => {
    expect(datosDeRetiro(null, 'Fecha retiro: 2019-03-02')).toEqual({ motivo: null, fecha: '2019-03-02' });
    expect(datosDeRetiro(null, 'Motivo retiro: FALLECIDO')).toEqual({ motivo: 'FALLECIDO', fecha: null });
  });

  it('sin historial ni notas de retiro no hay dato', () => {
    expect(datosDeRetiro(null, 'DEBE CARNET')).toBeNull();
    expect(datosDeRetiro(null, null)).toBeNull();
  });
});
