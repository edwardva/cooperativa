// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Comparación de nombres de personas
// ============================================
//
// Al crear las personas de los socios existentes, varios expedientes con la
// misma cédula se unen en una sola persona SOLO si parecen la misma persona.
// Los datos migrados tienen de todo: con y sin acentos, segundo nombre sí y no
// ("MARIA PEREZ" y "MARÍA JOSÉ PÉREZ DÍAZ"). Unir a dos personas distintas es
// mucho peor que dejar un caso para revisión, así que el criterio es estricto
// en lo que importa: todas las palabras del nombre más corto tienen que estar
// en el más largo.

/** Palabras del nombre, sin acentos ni signos, en mayúsculas */
export const palabrasDelNombre = (texto: string): string[] =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((p) => p.length > 0);

export const pareceLaMismaPersona = (
  a: { nombre: string; apellido: string },
  b: { nombre: string; apellido: string }
): boolean => {
  const pa = palabrasDelNombre(`${a.nombre} ${a.apellido}`);
  const pb = palabrasDelNombre(`${b.nombre} ${b.apellido}`);
  if (pa.length === 0 || pb.length === 0) return false;

  const [corto, largo] = pa.length <= pb.length ? [pa, new Set(pb)] : [pb, new Set(pa)];
  return corto.every((p) => largo.has(p));
};
