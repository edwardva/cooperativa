// Cuándo dos expedientes con la misma cédula se unen en una sola persona.

import { palabrasDelNombre, pareceLaMismaPersona } from '../personas';

const p = (nombre: string, apellido: string) => ({ nombre, apellido });

describe('palabrasDelNombre', () => {
  it('quita acentos, signos y espacios de más', () => {
    expect(palabrasDelNombre('  María José  PÉREZ-díaz ')).toEqual(['MARIA', 'JOSE', 'PEREZ', 'DIAZ']);
  });
});

describe('pareceLaMismaPersona', () => {
  it('mismo nombre con y sin acentos', () => {
    expect(pareceLaMismaPersona(p('MARIA', 'PEREZ'), p('María', 'Pérez'))).toBe(true);
  });

  it('el nombre corto está contenido en el largo', () => {
    expect(pareceLaMismaPersona(p('MARIA', 'PEREZ'), p('MARIA JOSE', 'PEREZ DIAZ'))).toBe(true);
  });

  it('nombres distintos bajo la misma cédula no se unen', () => {
    expect(pareceLaMismaPersona(p('MARIA', 'PEREZ'), p('JOSE', 'PEREZ'))).toBe(false);
  });

  it('sin nombre no se une nada', () => {
    expect(pareceLaMismaPersona(p('', ''), p('MARIA', 'PEREZ'))).toBe(false);
  });
});
