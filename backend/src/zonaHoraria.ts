// ============================================
// COOPERATIVA EL TRIUNFO - ZONA HORARIA
// ============================================
//
// La semana de colecta va de lunes a domingo y vence el DOMINGO en hora de
// Venezuela (observación de la cooperativa, 07/11). El calendario semanal, el
// "hoy" de la caja y los jobs de los lunes leen la hora local del proceso; si
// el servidor está en UTC, el lunes llega el domingo a las 8 de la noche y lo
// cobrado esa noche cae en la semana siguiente.
//
// Se importa PRIMERO en index.ts, antes de cualquier cálculo de fechas. Si el
// entorno ya define TZ, se respeta.

export const ZONA_HORARIA = 'America/Caracas';

if (!process.env.TZ) {
  process.env.TZ = ZONA_HORARIA;
}
