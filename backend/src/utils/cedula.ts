// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Validación y normalización de cédula venezolana
// ============================================
//
// La cédula se almacena SOLO EN DÍGITOS, sin nacionalidad ni separadores.
// Este módulo normaliza lo que escribe el operador ("V-12.345.678", "E12345678",
// "  012345678 ") a su forma canónica y valida que sea plausible.
//
// Los rangos salen de los datos reales de la cooperativa: la cédula más baja
// registrada es 18.102 y ninguna baja de 10.000.

/** Cédula más baja aceptada. Por debajo son casi siempre errores de tipeo. */
const VALOR_MINIMO = 10_000;

/** Tope superior: las cédulas venezolanas vigentes no superan los 8 dígitos. */
const VALOR_MAXIMO = 99_999_999;

export interface ResultadoCedula {
  valida: boolean;
  /** Cédula normalizada (solo dígitos, sin ceros a la izquierda). */
  cedula: string;
  /** Nacionalidad detectada en el texto de entrada, si venía indicada. */
  nacionalidad: 'V' | 'E' | null;
  error?: string;
}

/**
 * Normaliza el texto que escribe el operador a la forma canónica.
 * Acepta "V-12.345.678", "e 12345678", "012345678" y demás variantes.
 */
export const normalizarCedula = (entrada: string): { cedula: string; nacionalidad: 'V' | 'E' | null } => {
  const limpio = String(entrada ?? '').trim().toUpperCase();

  // Nacionalidad opcional al inicio: V, E, V-, E-
  const conPrefijo = limpio.match(/^([VE])[\s.-]*(.*)$/);
  const nacionalidad = conPrefijo ? (conPrefijo[1] as 'V' | 'E') : null;
  const resto = conPrefijo ? (conPrefijo[2] ?? '') : limpio;

  // Fuera puntos, guiones y espacios de miles
  const soloDigitos = resto.replace(/[^\d]/g, '');

  // Sin ceros a la izquierda: evita que "018102" y "18102" convivan como distintas
  const sinCeros = soloDigitos.replace(/^0+/, '');

  return { cedula: sinCeros, nacionalidad };
};

/**
 * Valida una cédula venezolana y devuelve su forma normalizada.
 *
 * Nota: esto verifica que el número sea PLAUSIBLE, no que exista. Comprobar
 * existencia requiere consultar el registro del CNE a través de un servicio externo.
 */
export const validarCedula = (entrada: string): ResultadoCedula => {
  const { cedula, nacionalidad } = normalizarCedula(entrada);

  if (!cedula) {
    return { valida: false, cedula: '', nacionalidad, error: 'La cédula es obligatoria' };
  }

  const original = String(entrada ?? '').trim().toUpperCase();
  // Detecta basura como "TEMP000154" o "12AB3456": tras quitar la nacionalidad
  // no puede quedar ninguna letra
  const sinNacionalidad = nacionalidad ? original.slice(1) : original;
  if (/[A-Z]/.test(sinNacionalidad)) {
    return { valida: false, cedula, nacionalidad, error: 'La cédula solo puede contener números' };
  }

  if (cedula.length > 8) {
    return {
      valida: false,
      cedula,
      nacionalidad,
      error: `La cédula tiene ${cedula.length} dígitos; el máximo son 8`,
    };
  }

  const valor = parseInt(cedula, 10);

  if (isNaN(valor) || valor < VALOR_MINIMO) {
    return {
      valida: false,
      cedula,
      nacionalidad,
      error: `La cédula ${cedula} es demasiado baja para ser válida`,
    };
  }

  if (valor > VALOR_MAXIMO) {
    return { valida: false, cedula, nacionalidad, error: 'La cédula excede el rango válido' };
  }

  // Placeholders del estilo 11111111 o 12345678
  if (/^(\d)\1+$/.test(cedula)) {
    return { valida: false, cedula, nacionalidad, error: 'La cédula no puede ser un número repetido' };
  }

  return { valida: true, cedula, nacionalidad };
};

/** Formato de lectura: 12.345.678 */
export const formatearCedula = (cedula: string): string => {
  const { cedula: normalizada } = normalizarCedula(cedula);
  return normalizada.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
