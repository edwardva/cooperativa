/**
 * Nombre de un sector o feria tal como lo conoce la cooperativa.
 *
 * La migracion le puso a TODAS las ubicaciones el nombre generico
 * "Feria <codigo>" (tambien a los sectores) y guardo el nombre real
 * ("Sector 5", la direccion de la feria) en `direccion`. Por eso manda la
 * direccion: con el nombre, un sector salia como "Feria 05" (07/11).
 * Es la misma regla que `etiquetaFeria` en el backend.
 */
export const nombreUbicacion = (u: {
  codigo: string
  nombre?: string | null
  direccion?: string | null
}): string => u.direccion?.trim() || u.nombre?.trim() || u.codigo
