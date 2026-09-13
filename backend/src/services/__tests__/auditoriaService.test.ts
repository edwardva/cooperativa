// Serialización de lo que se guarda en audit_log.

import { aJsonAuditable } from '../auditoriaService';

describe('aJsonAuditable', () => {
  it('omite los valores vacíos para no escribir la columna', () => {
    expect(aJsonAuditable(undefined)).toBeUndefined();
    expect(aJsonAuditable(null)).toBeUndefined();
  });

  it('reemplaza la foto del socio por una marca', () => {
    const socio = { id: 1, nombre: 'Ana', foto: Buffer.from('imagen grande') };
    expect(aJsonAuditable(socio)).toEqual({ id: 1, nombre: 'Ana', foto: '[binario omitido]' });
  });

  it('también cuando el binario llega como Uint8Array', () => {
    expect(aJsonAuditable({ foto: new Uint8Array([1, 2, 3]) })).toEqual({ foto: '[binario omitido]' });
  });

  it('pasa fechas a texto ISO', () => {
    expect(aJsonAuditable({ fecha: new Date('2026-09-12T10:00:00Z') })).toEqual({
      fecha: '2026-09-12T10:00:00.000Z',
    });
  });

  it('acepta el texto libre que guardan algunos módulos', () => {
    expect(aJsonAuditable('Estado cambiado: activo → suspendido')).toBe(
      'Estado cambiado: activo → suspendido'
    );
  });
});
