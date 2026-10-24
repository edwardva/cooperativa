/**
 * ============================================
 * PERMISOS POR ROL
 * ============================================
 * Única fuente de verdad de qué puede hacer cada rol. La usan el sembrado
 * (`seed.ts`, para bases nuevas) y `sincronizar-permisos.ts` (para las que ya
 * existen). Antes cada uno tenía su copia y no coincidían: el sembrado dejaba
 * roles sin los módulos nuevos.
 */

/** Permisos que debe tener cada rol por modulo. Solo se AGREGA lo que falte. */
const TODO = ['create', 'read', 'update', 'delete'];

/**
 * Permisos que debe tener cada rol por modulo. Solo se AGREGA lo que falte.
 *
 * La lista cubre TODOS los modulos que exigen las rutas del backend
 * (`grep -rho "authorize('[a-z_]*'" src/routes/`). Faltaba varios: admin no
 * tenia semanas_colecta, funeraria, impresion, tipos_cuenta ni tipos_prestamo,
 * asi que esas pantallas respondian 403 aunque el usuario fuera administrador.
 */
export const PERMISOS_POR_ROL: Record<string, Record<string, string[]>> = {
  admin: {
    dashboard: ['read'],
    // 'reactivar' levanta a mano la suspensión de un socio moroso.
    // 'reactivar_retirado' devuelve a activo a un retirado (p. ej. por faltar
    // dos años a la asamblea) cuando la oficina acepta sus motivos: sólo admin.
    socios: [...TODO, 'reactivar', 'reactivar_retirado'],
    ahorro: TODO,
    funeraria: TODO,
    salud: TODO,
    // La caja 99: única que reversa movimientos de días anteriores
    prestamos: [...TODO, 'approve', 'reversar_anterior'],
    colecta: [...TODO, 'reversar_anterior'],
    asambleas: TODO,
    // Multas por inasistencia: cobrar, reversar y fijar el monto. La caja 99
    // reversa las de días anteriores
    multas: [...TODO, 'reversar_anterior'],
    // Fondo de los trabajadores: la caja 99 reversa los de días anteriores
    fondo: [...TODO, 'reversar_anterior'],
    semanas_colecta: TODO,
    tipos_cuenta: TODO,
    tipos_prestamo: TODO,
    ubicaciones: TODO,
    personas: TODO,
    trabajadores: TODO,
    salud_feria: TODO,
    auditoria: ['read'],
    impresion: ['create', 'read'],
    reportes: ['read', 'export'],
    parametros: ['read', 'update'],
    usuarios: TODO,
  },
  cajero: {
    dashboard: ['read'],
    socios: ['read'],
    // Los cajeros cobran y reversan abonos y colectas del día (confirmado)
    prestamos: ['read', 'update', 'delete'],
    ahorro: ['create', 'read'],
    funeraria: ['create', 'read', 'update'],
    salud: ['create', 'read', 'update'],
    colecta: ['create', 'read', 'delete'],
    asambleas: ['create', 'read'],
    // Cobran la multa y reversan la del día, como en la colecta
    multas: ['create', 'read', 'delete'],
    // Por ahora el fondo lo opera cualquier cajero (confirmado el 24/10):
    // ingresos, ayudas, familiares y conceptos
    fondo: ['create', 'read', 'update', 'delete'],
    semanas_colecta: ['read'],
    tipos_cuenta: ['read'],
    ubicaciones: ['read'],
    personas: ['read'],
    trabajadores: ['read'],
    salud_feria: ['create', 'read'],
    impresion: ['create', 'read'],
    reportes: ['read'],
  },
  // Contabilidad de ahorro: ve todo e imprime o exporta, sin cambiar nada
  consulta: {
    dashboard: ['read'],
    socios: ['read'],
    ahorro: ['read'],
    funeraria: ['read'],
    salud: ['read'],
    prestamos: ['read'],
    colecta: ['read'],
    asambleas: ['read'],
    multas: ['read'],
    fondo: ['read'],
    semanas_colecta: ['read'],
    tipos_cuenta: ['read'],
    tipos_prestamo: ['read'],
    ubicaciones: ['read'],
    personas: ['read'],
    trabajadores: ['read'],
    salud_feria: ['read'],
    reportes: ['read', 'export'],
    impresion: ['create', 'read'],
  },
  analista: {
    dashboard: ['read'],
    socios: ['create', 'read', 'update'],
    ahorro: ['read'],
    funeraria: ['read'],
    salud: ['read'],
    prestamos: ['create', 'read', 'update'],
    colecta: ['read'],
    asambleas: ['read'],
    multas: ['read'],
    fondo: ['read'],
    semanas_colecta: ['read'],
    tipos_cuenta: ['read'],
    tipos_prestamo: ['read'],
    ubicaciones: ['read'],
    personas: ['create', 'read', 'update'],
    trabajadores: ['create', 'read', 'update'],
    salud_feria: ['read'],
    reportes: ['read', 'export'],
  },
  supervisor: {
    dashboard: ['read'],
    socios: ['create', 'read', 'update', 'reactivar'],
    ahorro: ['create', 'read', 'update'],
    funeraria: ['create', 'read', 'update'],
    salud: ['create', 'read', 'update'],
    colecta: TODO,
    asambleas: ['create', 'read', 'update'],
    multas: TODO,
    fondo: TODO,
    semanas_colecta: ['create', 'read', 'update'],
    tipos_cuenta: ['read'],
    ubicaciones: ['read'],
    personas: ['create', 'read', 'update'],
    trabajadores: ['create', 'read', 'update'],
    salud_feria: ['create', 'read'],
    impresion: ['create', 'read'],
    reportes: ['read', 'export'],
  },
};
