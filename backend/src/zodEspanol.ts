/**
 * Mensajes de validación en español para todos los esquemas de zod.
 *
 * Las respuestas "Datos inválidos" traen en `details` qué campo falló y por
 * qué, y la pantalla lo muestra (observación del 20/11: "el mensaje debe
 * indicar dónde está mal escrito"). Sin esto, los esquemas sin un texto
 * propio contestaban en inglés ("Expected number, received string").
 *
 * Los mensajes escritos en el propio esquema siguen mandando: este mapa sólo
 * cubre los que no lo tienen.
 */
import { z, ZodIssueCode, ZodParsedType } from 'zod';

const TIPOS: Partial<Record<ZodParsedType, string>> = {
  string: 'un texto',
  number: 'un número',
  bigint: 'un número',
  boolean: 'sí o no',
  date: 'una fecha',
  array: 'una lista',
  object: 'un grupo de datos',
};

const tipo = (t: ZodParsedType) => TIPOS[t] ?? t;

z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined || issue.received === ZodParsedType.null) {
        return { message: 'es obligatorio' };
      }
      if (issue.expected === 'integer') return { message: 'debe ser un número entero' };
      return { message: `debe ser ${tipo(issue.expected)}` };

    case ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return {
          message: Number(issue.minimum) <= 1 ? 'es obligatorio' : `debe tener al menos ${issue.minimum} caracteres`,
        };
      }
      if (issue.type === 'number') {
        return {
          message: issue.inclusive ? `debe ser mayor o igual a ${issue.minimum}` : `debe ser mayor que ${issue.minimum}`,
        };
      }
      if (issue.type === 'array') return { message: `debe tener al menos ${issue.minimum} elemento(s)` };
      return { message: 'es demasiado corto' };

    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `admite como máximo ${issue.maximum} caracteres` };
      if (issue.type === 'number') {
        return {
          message: issue.inclusive ? `debe ser menor o igual a ${issue.maximum}` : `debe ser menor que ${issue.maximum}`,
        };
      }
      if (issue.type === 'array') return { message: `admite como máximo ${issue.maximum} elemento(s)` };
      return { message: 'es demasiado largo' };

    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'no es un correo válido' };
      if (issue.validation === 'datetime') return { message: 'no es una fecha válida' };
      return { message: 'tiene un formato inválido' };

    case ZodIssueCode.invalid_enum_value:
      return { message: `debe ser uno de: ${issue.options.join(', ')}` };

    case ZodIssueCode.invalid_date:
      return { message: 'no es una fecha válida' };

    case ZodIssueCode.unrecognized_keys:
      return { message: `campos no reconocidos: ${issue.keys.join(', ')}` };

    default:
      return { message: ctx.defaultError };
  }
});
