// ============================================
// COOPERATIVA EL TRIUNFO - Retiro del socio para la ficha
// ============================================
//
// Pedido del 16/11: en el detalle del socio retirado se ve un campo "Retiro"
// con la fecha y el motivo. El dato vive en dos lugares segun de donde vino:
//
//   * Retiros hechos en este sistema: el historial de estados. El manual guarda
//     "Retiro: <motivo> (fecha AAAA-MM-DD)"; el automatico por pasividad guarda
//     el articulo de los estatutos y las semanas sin pagar.
//   * Socios que llegaron retirados del sistema viejo: no tienen historial; la
//     migracion dejo "Motivo retiro: X" y "Fecha retiro: AAAA-MM-DD" en las
//     notas, que la ficha ya no muestra (solo la observacion de la oficina).

export interface DatosRetiro {
  /** AAAA-MM-DD, o null si no se conoce */
  fecha: string | null;
  motivo: string | null;
}

interface RetiroDelHistorial {
  motivo: string;
  fecha: Date;
}

const RETIRO_MANUAL = /^Retiro:\s*(.+?)\s*\(fecha (\d{4}-\d{2}-\d{2})\)\s*$/;

/**
 * Fecha y motivo del retiro: primero el historial (lo mas reciente y fiel),
 * si no hay, lo que la migracion dejo en las notas. Null si no hay nada.
 */
export const datosDeRetiro = (
  historial: RetiroDelHistorial | null,
  notas: string | null | undefined
): DatosRetiro | null => {
  if (historial) {
    const manual = RETIRO_MANUAL.exec(historial.motivo.trim());
    if (manual) return { motivo: manual[1]!, fecha: manual[2]! };
    return { motivo: historial.motivo.trim() || null, fecha: historial.fecha.toISOString().slice(0, 10) };
  }

  const lineas = (notas ?? '').split('\n').map((l) => l.trim());
  const valor = (rotulo: string) =>
    lineas.find((l) => l.startsWith(`${rotulo}:`))?.slice(rotulo.length + 1).trim() || null;
  const motivo = valor('Motivo retiro');
  const fecha = valor('Fecha retiro');
  if (!motivo && !fecha) return null;
  return { motivo, fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null };
};
