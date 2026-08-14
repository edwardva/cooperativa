/**
 * ============================================
 * SERVICE: SALUD
 * ============================================
 * Servicio para gestión de acuerdos de salud. A diferencia de Funeraria (un
 * acuerdo por beneficiario), en Salud hasta 9 personas (titular + 8
 * beneficiarios) comparten un mismo "número de acuerdo" con una sola cuota
 * familiar; la suspensión y reactivación por falta de pago aplica a todo el
 * grupo a la vez.
 */

import apiClient from './api';

// ============================================
// TIPOS
// ============================================

export interface Beneficiario {
  id: number;
  cedula: string;
  nombre_completo: string;
  parentesco: string;
}

export interface TipoAcuerdo {
  id: number;
  codigo: string;
  nombre: string;
  monto_usd: number;
  estado?: boolean;
}

export interface AcuerdoSalud {
  id: number;
  numero_acuerdo: string | null;
  numero_contrato: string | null;
  estado: 'activo' | 'suspendido' | 'retirado';
  fecha_inicio: string;
  semanas_sin_pago: number;
  derecho_al_servicio: boolean;
  fecha_suspension?: string | null;
  fecha_retiro?: string | null;
  motivo_retiro?: string | null;
  beneficiario: Beneficiario;
  socio: {
    id: number;
    codigo_socio: string;
    cedula: string;
    nombre_completo: string;
    estado: string;
  } | null;
  tipo_acuerdo: {
    id: number;
    codigo: string;
    nombre: string;
    monto_usd: number;
  };
  created_at: string;
  updated_at: string;
}

/** Un miembro (titular o beneficiario) dentro de un grupo de salud. */
export interface MiembroGrupoSalud {
  acuerdo_id: number;
  beneficiario_id: number;
  cedula: string;
  nombre: string;
  apellido: string;
  parentesco: string;
  fecha_nacimiento: string | null;
  fecha_ingreso: string | null;
  telefono: string | null;
  estado_persona: 'activo' | 'inactivo' | 'retirado' | 'fallecido';
  estado_acuerdo: 'activo' | 'suspendido' | 'retirado';
  semanas_sin_pago: number;
  fecha_suspension: string | null;
  fecha_retiro: string | null;
  motivo_retiro: string | null;
}

/** Titular + beneficiarios que comparten un mismo número de acuerdo. */
export interface GrupoSalud {
  numero_acuerdo: string | null;
  numero_contrato: string | null;
  tipo_acuerdo: { id: number; codigo: string; nombre: string; monto_usd: number } | null;
  estado: 'activo' | 'suspendido' | 'retirado' | null;
  semanas_sin_pago: number;
  fecha_suspension: string | null;
  fecha_inicio: string | null;
  socio: {
    id: number;
    codigo_socio: string;
    cedula: string;
    nombre_completo: string;
    direccion: string | null;
    telefono: string | null;
    email: string | null;
    estado: string;
  } | null;
  titular: MiembroGrupoSalud | null;
  beneficiarios: MiembroGrupoSalud[];
  total_personas: number;
}

export interface EstadisticasSaludAPI {
  total_acuerdos: number;
  por_estado: {
    activos: number;
    suspendidos: number;
    retirados: number;
  };
  por_tipo: Array<{
    tipo: string;
    cantidad: number;
  }>;
  alertas: {
    proximos_suspender: number;
    sin_derecho_servicio: number;
  };
}

export interface EstadisticasSalud {
  total_acuerdos: number;
  por_estado: {
    activos: number;
    suspendidos: number;
    retirados: number;
    porcentaje_activos: number;
    porcentaje_suspendidos: number;
    porcentaje_retirados: number;
  };
  por_tipo: Array<{
    tipo: string;
    cantidad: number;
  }>;
  proximos_suspender: number;
  sin_derecho_servicio: number;
}

// Mismas 26 opciones que sociosService.PARENTESCOS_BENEFICIARIO
export const PARENTESCOS_BENEFICIARIO_SALUD = [
  'No tiene', 'Esposo', 'Esposa', 'Hijo', 'Hija', 'Padre', 'Madre', 'Abuelo', 'Abuela',
  'Hermano', 'Hermana', 'Nieto', 'Nieta', 'Bisnieto', 'Cuñado', 'Cuñada', 'Suegro', 'Suegra',
  'Sobrino', 'Tio', 'Tia', 'Primo', 'Prima', 'Yerno', 'Yerna', 'Ahijado', 'Otro',
] as const;

export const MOTIVOS_RETIRO_SALUD = ['Socio', 'Voluntario', 'Art. 5'] as const;

export interface BeneficiarioGrupoInput {
  cedula: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  fecha_ingreso: string;
  parentesco: string;
  estado?: 'activo' | 'fallecido';
  telefono?: string | null;
}

export interface CrearGrupoData {
  socio_id: number;
  tipo_acuerdo_id: number;
  numero_acuerdo: string;
  numero_contrato?: string;
  fecha_inicio?: string;
  beneficiarios: BeneficiarioGrupoInput[];
}

export interface ActualizarGrupoData {
  numero_acuerdo_nuevo?: string;
  numero_contrato?: string | null;
  tipo_acuerdo_id?: number;
  fecha_inicio?: string;
}

export interface CambiarEstadoGrupoData {
  estado: 'activo' | 'suspendido';
  motivo?: string;
}

export interface RetirarBeneficiarioData {
  fecha_retiro: string;
  motivo_retiro: (typeof MOTIVOS_RETIRO_SALUD)[number];
}

export interface RegistrarPagoData {
  fecha_pago: string;
  monto_usd: number;
  monto_bs: number;
  tasa_cambio: number;
  semanas: number;
  anio: number;
  numero_recibo: string;
  ubicacion_id: number;
}

export interface ImportarFunerariaData {
  beneficiario_ids: number[];
  tipo_acuerdo_funeraria_id: number;
  numero_acuerdo_funeraria: string;
  numero_contrato_funeraria?: string;
}

export interface SuspendidoSalud {
  expediente: string;
  numero_acuerdo: string;
  numero_contrato: string;
  apellidos: string;
  nombres: string;
  cedula: string;
  telefono: string;
  semanas_atraso: number;
  estado: string;
}

export interface CrearAcuerdoData {
  socio_id: number;
  tipo_acuerdo_id: number;
  beneficiario_id?: number;
  fecha_inicio?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ============================================
// CATÁLOGO Y ESTADÍSTICAS
// ============================================

export const obtenerTiposAcuerdo = async (): Promise<ApiResponse<TipoAcuerdo[]>> => {
  const response = await apiClient.get<ApiResponse<TipoAcuerdo[]>>('/salud/tipos-acuerdo');
  return response.data;
};

export const obtenerEstadisticas = async (): Promise<ApiResponse<EstadisticasSaludAPI>> => {
  const response = await apiClient.get<ApiResponse<EstadisticasSaludAPI>>('/salud/estadisticas');
  return response.data;
};

// ============================================
// LISTADO / CONSULTA
// ============================================

export const obtenerAcuerdos = async (params?: {
  estado?: 'activo' | 'suspendido' | 'retirado';
  tipo_acuerdo_id?: number;
  buscar?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<AcuerdoSalud>> => {
  const response = await apiClient.get<PaginatedResponse<AcuerdoSalud>>('/salud/acuerdos', { params });
  return response.data;
};

export const obtenerAcuerdosPorSocio = async (socioId: number): Promise<ApiResponse<AcuerdoSalud[]>> => {
  const response = await apiClient.get(`/salud/acuerdos/socio/${socioId}`);
  return response.data;
};

export const obtenerGrupoPorNumeroAcuerdo = async (numeroAcuerdo: string): Promise<ApiResponse<GrupoSalud>> => {
  const response = await apiClient.get(`/salud/acuerdos/grupo/${encodeURIComponent(numeroAcuerdo)}`);
  return response.data;
};

export const listarSuspendidosParaImpresion = async (): Promise<ApiResponse<SuspendidoSalud[]>> => {
  const response = await apiClient.get('/salud/acuerdos/suspendidos/listado');
  return response.data;
};

export const obtenerAcuerdo = async (
  id: number
): Promise<ApiResponse<MiembroGrupoSalud & { numero_acuerdo: string | null; numero_contrato: string | null; socio: GrupoSalud['socio']; tipo_acuerdo: GrupoSalud['tipo_acuerdo']; fecha_inicio: string }>> => {
  const response = await apiClient.get(`/salud/acuerdos/${id}`);
  return response.data;
};

// ============================================
// ALTA / MODIFICACIÓN / BAJA DE GRUPO
// ============================================

export const crearGrupoAcuerdo = async (data: CrearGrupoData): Promise<ApiResponse<GrupoSalud>> => {
  const response = await apiClient.post<ApiResponse<GrupoSalud>>('/salud/grupos', data);
  return response.data;
};

export const agregarBeneficiarioAGrupo = async (
  numeroAcuerdo: string,
  data: BeneficiarioGrupoInput
): Promise<ApiResponse<{ id: number }>> => {
  const response = await apiClient.post(`/salud/grupos/${encodeURIComponent(numeroAcuerdo)}/beneficiarios`, data);
  return response.data;
};

export const actualizarGrupoAcuerdo = async (
  numeroAcuerdo: string,
  data: ActualizarGrupoData
): Promise<ApiResponse<GrupoSalud>> => {
  const response = await apiClient.put(`/salud/grupos/${encodeURIComponent(numeroAcuerdo)}`, data);
  return response.data;
};

export const eliminarGrupoAcuerdo = async (
  numeroAcuerdo: string
): Promise<ApiResponse<{ numero_acuerdo: string; eliminados: number }>> => {
  const response = await apiClient.delete(`/salud/grupos/${encodeURIComponent(numeroAcuerdo)}`);
  return response.data;
};

export const eliminarAcuerdo = async (id: number): Promise<ApiResponse<{ id: number }>> => {
  const response = await apiClient.delete<ApiResponse<{ id: number }>>(`/salud/acuerdos/${id}`);
  return response.data;
};

/**
 * Crear un único acuerdo para un beneficiario existente, sin número de
 * acuerdo. Se conserva exclusivamente para el flujo "Importar a Salud" de
 * FunerariaPage.tsx — no usar para nada más.
 */
export const crearAcuerdo = async (data: CrearAcuerdoData): Promise<ApiResponse<unknown>> => {
  const response = await apiClient.post<ApiResponse<unknown>>('/salud/acuerdos', data);
  return response.data;
};

// ============================================
// SUSPENSIÓN / REACTIVACIÓN / RETIRO
// ============================================

export const cambiarEstado = async (
  id: number,
  data: CambiarEstadoGrupoData
): Promise<ApiResponse<{ numero_acuerdo: string | null; estado_nuevo: string; personas_afectadas: number }>> => {
  const response = await apiClient.patch(`/salud/acuerdos/${id}/estado`, data);
  return response.data;
};

export const retirarBeneficiario = async (
  id: number,
  data: RetirarBeneficiarioData
): Promise<ApiResponse<{ id: number; estado: string; fecha_retiro: string; motivo_retiro: string }>> => {
  const response = await apiClient.patch(`/salud/acuerdos/${id}/retirar`, data);
  return response.data;
};

// ============================================
// PAGOS
// ============================================

export const registrarPago = async (
  numeroAcuerdo: string,
  data: RegistrarPagoData
): Promise<ApiResponse<{ numero_acuerdo: string; personas_afectadas: number; reactivado: boolean }>> => {
  const response = await apiClient.post(`/salud/grupos/${encodeURIComponent(numeroAcuerdo)}/pagos`, data);
  return response.data;
};

// ============================================
// TRASPASO A FUNERARIA
// ============================================

export const importarGrupoAFuneraria = async (
  numeroAcuerdo: string,
  data: ImportarFunerariaData
): Promise<ApiResponse<{ transferidos: number; numeros_acuerdo_funeraria: string[] }>> => {
  const response = await apiClient.post(`/salud/grupos/${encodeURIComponent(numeroAcuerdo)}/importar-funeraria`, data);
  return response.data;
};

// ============================================
// SUSPENSIÓN AUTOMÁTICA
// ============================================

export const verificarSuspensionesAutomaticas = async (): Promise<
  ApiResponse<{ gruposSuspendidos: number; personasSuspendidas: number }>
> => {
  const response = await apiClient.post('/salud/verificar-suspensiones');
  return response.data;
};

// ============================================
// REPORTES E IMPRESIÓN
// ============================================

/** Descarga el reporte (PDF o Excel) de acuerdos de salud suspendidos. */
export const descargarReporteSuspendidos = async (formato: 'pdf' | 'excel' = 'excel'): Promise<void> => {
  const response = await apiClient.post(
    '/reportes/salud-suspendidos',
    { formato },
    { responseType: 'blob' }
  );

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const fecha = new Date().toISOString().split('T')[0];
  const extension = formato === 'pdf' ? 'pdf' : 'xlsx';
  link.setAttribute('download', `reporte-salud-suspendidos-${fecha}.${extension}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/** Descarga el Excel con el listado completo de todos los acuerdos de salud. */
export const descargarReporteAcuerdos = async (): Promise<void> => {
  const response = await apiClient.post(
    '/reportes/salud-acuerdos',
    { formato: 'excel' },
    { responseType: 'blob' }
  );

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const fecha = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `reporte-salud-acuerdos-${fecha}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export interface FichaAcuerdoSaludData {
  numero_acuerdo: string;
  numero_contrato?: string;
  fecha_inicio: string;
  socio: {
    codigo: string;
    cedula: string;
    nombre: string;
    direccion?: string;
    telefono?: string;
  };
  beneficiarios: {
    id: number;
    nombre: string;
    cedula: string;
    parentesco: string;
    fecha_ingreso: string;
    fecha_nacimiento?: string;
    edad?: number;
    estado?: string;
  }[];
}

/** Genera e imprime (registra en audit log) la ficha del acuerdo de salud. */
export const imprimirFichaAcuerdo = async (
  data: FichaAcuerdoSaludData
): Promise<ApiResponse<{ tipo: string; formato: string; contenido: string; longitud: number }>> => {
  const response = await apiClient.post('/impresion/ficha-acuerdo-salud', data);
  return response.data;
};
