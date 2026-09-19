// ============================================
// COOPERATIVA EL TRIUNFO - REGLA
// Qué puede hacer un socio suspendido
// ============================================
//
// Confirmado por la cooperativa: el socio suspendido pierde el acceso a los
// servicios. Lo único que puede hacer es ponerse al día con lo que debe (su
// colecta se sigue cobrando) o retirar su ahorro y cerrar. Lo que no puede es
// inscribir acuerdos nuevos, sumar beneficiarios ni pedir préstamos.
//
// El retirado tampoco: su expediente queda guardado, y si vuelve entra con
// número nuevo.

export interface SocioParaHabilitar {
  estado: string;
  codigo_socio?: string;
}

/** Devuelve el motivo por el que el socio no puede inscribir nada, o null si puede */
export const motivoNoHabilitado = (socio: SocioParaHabilitar, accion = 'inscribir'): string | null => {
  if (socio.estado === 'activo') return null;
  const quien = socio.codigo_socio ? `El socio ${socio.codigo_socio}` : 'El socio';
  if (socio.estado === 'suspendido') {
    return (
      `${quien} está suspendido: mientras lo esté no puede ${accion}. ` +
      'Puede pagar lo que debe o retirar su ahorro y cerrar.'
    );
  }
  return `${quien} está ${socio.estado} y no puede ${accion}.`;
};

/** Respuesta lista para los controladores que responden con `res.status(...)` */
export const RESPUESTA_NO_HABILITADO = (message: string) => ({
  success: false as const,
  error: { code: 'SOCIO_NO_HABILITADO', message },
});
