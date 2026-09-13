// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Período de prueba del socio trabajador
// ============================================
//
// RF-SOC-05 / RN-07: después de N meses de prueba el trabajador puede
// inscribirse también como ahorrista. La cooperativa no confirmó si se cuentan
// meses completos o días calendario (pendiente 10 del requerimiento); se usan
// MESES DE CALENDARIO, con N por parámetro (`MESES_PRUEBA_TRABAJADOR`).
//
// Las fechas de ingreso vienen de columnas DATE, que Prisma entrega como
// medianoche UTC. Por eso se trabaja con componentes UTC: con los locales, en
// Venezuela (UTC-4) el ingreso del día 10 se leería como día 9.

const DIA_MS = 86_400_000;

/** Día calendario en UTC, sin hora */
const diaUTC = (anio: number, mes: number, dia: number): number => Date.UTC(anio, mes, dia);

/**
 * Suma meses de calendario. Si el día no existe en el mes destino se usa el
 * último día: 31 de enero + 1 mes = 28 (o 29) de febrero.
 */
export const sumarMeses = (fecha: Date, meses: number): Date => {
  const anio = fecha.getUTCFullYear();
  const mes = fecha.getUTCMonth() + meses;
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(diaUTC(anio, mes, Math.min(fecha.getUTCDate(), ultimoDia)));
};

export interface SituacionPrueba {
  fin_prueba: Date;
  cumplida: boolean;
  dias_trabajados: number;
  dias_restantes: number;
}

/**
 * @param fechaIngreso columna DATE (medianoche UTC)
 * @param hoy fecha y hora local actual; se toma su día calendario local
 */
export const situacionPrueba = (fechaIngreso: Date, meses: number, hoy: Date = new Date()): SituacionPrueba => {
  const fin = sumarMeses(fechaIngreso, meses);
  const hoyDia = diaUTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  return {
    fin_prueba: fin,
    cumplida: hoyDia >= fin.getTime(),
    dias_trabajados: Math.max(0, Math.round((hoyDia - fechaIngreso.getTime()) / DIA_MS)),
    dias_restantes: Math.max(0, Math.round((fin.getTime() - hoyDia) / DIA_MS)),
  };
};
