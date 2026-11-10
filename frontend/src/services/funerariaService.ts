/**
 * ============================================
 * SERVICE: FUNERARIA
 * ============================================
 * Servicio para gestión de acuerdos de funeraria
 */

import apiClient from './api';
import type { ConfirmarTraspasoData, ResultadoTraspaso, VistaPreviaTraspaso } from './traspasoAcuerdo';

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
  descripcion?: string;
  monto_usd: number;
  ubicacion?: string;
  estado: boolean;
}

/**
 * Forma real de GET /api/funeraria/acuerdos/:id (distinta del listado:
 * el beneficiario viene con nombre/apellido separados, no nombre_completo)
 */
export interface AcuerdoDetalle {
  id: number;
  numero_acuerdo: string | null;
  numero_contrato: string | null;
  beneficiario: {
    id: number;
    cedula: string;
    nombre: string;
    apellido: string;
    parentesco: string;
    telefono: string | null;
  };
  socio: {
    id: number;
    codigo_socio: string;
    cedula: string;
    nombre_completo: string;
    direccion?: string | null;
    telefono?: string | null;
    email?: string | null;
    /** Código de programas sociales (se edita con "Sociales" o desde Socios) */
    codigo_social?: string | null;
    estado: string;
  } | null;
  tipo_acuerdo: {
    id: number;
    codigo: string;
    nombre: string;
    monto_usd: number;
    ubicacion?: string | null;
  };
  estado: 'activo' | 'suspendido' | 'retirado';
  semanas_sin_pago: number;
  fecha_suspension?: string | null;
  fecha_retiro?: string | null;
  motivo_retiro?: string | null;
  fecha_inicio: string;
  /** Fin de los días de espera: antes no se puede usar la funeraria */
  fecha_fin_espera?: string;
  en_espera?: boolean;
  movimientos: MovimientoFuneraria[];
  created_at: string;
  updated_at: string;
}

export interface AcuerdoFuneraria {
  id: number;
  numero_acuerdo: string | null;
  numero_contrato: string | null;
  estado: 'activo' | 'suspendido' | 'retirado';
  fecha_inicio: string;
  /** Fin de los días de espera: antes no se puede usar la funeraria */
  fecha_fin_espera?: string;
  en_espera?: boolean;
  semanas_sin_pago: number;
  fecha_suspension?: string | null;
  fecha_retiro?: string | null;
  motivo_retiro?: string | null;
  beneficiario: Beneficiario;
  socio: {
    id: number;
    codigo_socio: string;
    cedula: string;
    nombre_completo: string;
    direccion?: string | null;
    telefono?: string | null;
    email?: string | null;
    estado: string;
  } | null;
  tipo_acuerdo: {
    id: number;
    codigo: string;
    nombre: string;
    monto_usd: number;
    ubicacion?: string | null;
  };
  created_at: string;
  updated_at: string;
  _count?: {
    movimientos: number;
  };
}

export interface EstadisticasFunerariaAPI {
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
  };
}

export interface EstadisticasFuneraria {
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
}

export interface MovimientoFuneraria {
  id: number;
  tipo_movimiento: string;
  monto_usd: number;
  monto_bs: number;
  tasa_cambio: number;
  semanas_pagadas?: number;
  concepto?: string;
  fecha_movimiento: string;
}

/** El acuerdo es siempre del socio titular; funeraria no tiene tipos ni contrato */
export interface CrearAcuerdoData {
  socio_id: number;
  /** Se propone como "expediente-N"; puede ir vacío */
  numero_acuerdo?: string;
  fecha_inicio?: string;
}

export interface CambiarEstadoData {
  estado: 'activo' | 'suspendido' | 'retirado';
  motivo?: string;
  fecha_retiro?: string;
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
// SERVICIOS DE ACUERDOS
// ============================================

/**
 * Listar tipos de acuerdo de funeraria activos (catálogo para selects)
 */
export const obtenerTiposAcuerdo = async (): Promise<ApiResponse<TipoAcuerdo[]>> => {
  const response = await apiClient.get<ApiResponse<TipoAcuerdo[]>>('/funeraria/tipos-acuerdo');
  return response.data;
};

/**
 * Listar acuerdos de funeraria con filtros y paginación
 */
export const obtenerAcuerdos = async (params?: {
  estado?: 'activo' | 'suspendido' | 'retirado';
  tipo_acuerdo_id?: number;
  buscar?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<AcuerdoFuneraria>> => {
  const response = await apiClient.get<PaginatedResponse<AcuerdoFuneraria>>('/funeraria/acuerdos', {
    params,
  });
  return response.data;
};

export interface AcuerdoFunerariaPorSocio {
  id: number;
  numero_acuerdo: string | null;
  beneficiario: {
    id: number;
    cedula: string;
    nombre_completo: string;
    parentesco: string;
  };
  tipo_acuerdo: {
    id: number;
    codigo: string;
    nombre: string;
    monto_usd: number;
  };
  estado: 'activo' | 'suspendido' | 'retirado';
  semanas_sin_pago: number;
  fecha_suspension: string | null;
  fecha_inicio: string;
  /** Fin de los días de espera: antes no se puede usar la funeraria */
  fecha_fin_espera?: string;
  en_espera?: boolean;
}

/**
 * Obtener todos los acuerdos de funeraria de un socio específico (a través
 * de sus beneficiarios), sin paginar.
 */
export const obtenerAcuerdosPorSocio = async (
  socioId: number
): Promise<ApiResponse<AcuerdoFunerariaPorSocio[]>> => {
  const response = await apiClient.get(`/funeraria/acuerdos/socio/${socioId}`);
  return response.data;
};

export interface AcuerdoSuspendidoListado {
  expediente: string;
  numero_acuerdo: string;
  apellidos: string;
  nombres: string;
  cedula: string;
  telefono: string;
  semanas_atraso: number;
  estado: string;
  fecha_inicio: string;
  fecha_retiro: string | null;
}

export type EstadoListadoFuneraria = 'activo' | 'suspendido' | 'retirado' | 'todos';

/**
 * Listado completo (sin paginar) de acuerdos en ese estado, para "Imprimir listado"
 */
export const obtenerListadoParaImprimir = async (
  estado: EstadoListadoFuneraria
): Promise<ApiResponse<AcuerdoSuspendidoListado[]>> => {
  const response = await apiClient.get('/funeraria/acuerdos/listado', { params: { estado } });
  return response.data;
};

/**
 * Obtener el listado completo (sin paginar) de acuerdos suspendidos, para imprimir
 */
export const obtenerListadoSuspendidos = async (): Promise<ApiResponse<AcuerdoSuspendidoListado[]>> => {
  const response = await apiClient.get('/funeraria/acuerdos/suspendidos/listado');
  return response.data;
};

/**
 * Obtener detalle completo de un acuerdo
 */
export const obtenerAcuerdo = async (id: number): Promise<ApiResponse<AcuerdoDetalle>> => {
  const response = await apiClient.get(`/funeraria/acuerdos/${id}`);
  return response.data;
};

/**
 * Crear nuevo acuerdo de funeraria
 */
export const crearAcuerdo = async (
  data: CrearAcuerdoData
): Promise<ApiResponse<AcuerdoFuneraria>> => {
  const response = await apiClient.post<ApiResponse<AcuerdoFuneraria>>(
    '/funeraria/acuerdos',
    data
  );
  return response.data;
};

export interface ActualizarAcuerdoData {
  tipo_acuerdo_id?: number;
  numero_acuerdo?: string;
  numero_contrato?: string | null;
  fecha_inicio?: string;
}

/**
 * Actualizar datos de un acuerdo de funeraria (tipo, número de acuerdo/contrato, fecha de inicio)
 */
export const actualizarAcuerdo = async (
  id: number,
  data: ActualizarAcuerdoData
): Promise<ApiResponse<AcuerdoFuneraria>> => {
  const response = await apiClient.put<ApiResponse<AcuerdoFuneraria>>(
    `/funeraria/acuerdos/${id}`,
    data
  );
  return response.data;
};

/**
 * Eliminar un acuerdo de funeraria (solo si no tiene movimientos registrados)
 */
export const eliminarAcuerdo = async (id: number): Promise<ApiResponse<{ id: number }>> => {
  const response = await apiClient.delete<ApiResponse<{ id: number }>>(
    `/funeraria/acuerdos/${id}`
  );
  return response.data;
};

/**
 * Cambiar estado de un acuerdo (suspender, reactivar, retirar)
 */
/** Retira a un beneficiario de este acuerdo de funeraria; en Salud no cambia nada */
export const retirarBeneficiarioAcuerdo = async (
  acuerdoId: number,
  beneficiarioId: number
): Promise<ApiResponse<unknown>> => {
  const response = await apiClient.patch<ApiResponse<unknown>>(
    `/funeraria/acuerdos/${acuerdoId}/beneficiarios/${beneficiarioId}/retirar`
  );
  return response.data;
};

/**
 * Revierte un fallecido cuyo acuerdo ya tiene 8 activos: abre otro acuerdo del
 * mismo titular para él (sin período de espera) y lo vuelve a activo
 */
export const revertirFallecidoConNuevoAcuerdo = async (
  beneficiarioId: number,
  // acuerdo_origen_id: el acuerdo lleno desde el que se revierte (la persona puede estar en varios)
  data: { numero_acuerdo?: string; acuerdo_origen_id?: number }
): Promise<ApiResponse<{ id: number; numero_acuerdo: string | null; fecha_inicio: string }>> => {
  const response = await apiClient.post(`/funeraria/beneficiarios/${beneficiarioId}/revertir-con-nuevo-acuerdo`, data);
  return response.data;
};

export const cambiarEstado = async (
  id: number,
  data: CambiarEstadoData
): Promise<ApiResponse<AcuerdoFuneraria>> => {
  const response = await apiClient.patch<ApiResponse<AcuerdoFuneraria>>(
    `/funeraria/acuerdos/${id}/estado`,
    data
  );
  return response.data;
};

// ============================================
// ESTADÍSTICAS Y UTILIDADES
// ============================================

/**
 * Obtener estadísticas generales de funeraria
 */
export const obtenerEstadisticas = async (): Promise<ApiResponse<EstadisticasFuneraria>> => {
  const response = await apiClient.get<ApiResponse<EstadisticasFuneraria>>(
    '/funeraria/estadisticas'
  );
  return response.data;
};

/**
 * Verificar suspensiones automáticas (6+ semanas sin pago)
 * Solo para administradores - se ejecuta como job nocturno
 */
export const verificarSuspensionesAutomaticas = async (): Promise<
  ApiResponse<{ suspendidos: number }>
> => {
  const response = await apiClient.post<ApiResponse<{ suspendidos: number }>>(
    '/funeraria/verificar-suspensiones'
  );
  return response.data;
};

// ============================================
// REPORTES E IMPRESIÓN
// ============================================

/**
 * Descarga el reporte Excel de acuerdos suspendidos y dispara la descarga en el navegador
 */
export const descargarReporteSuspendidos = async (): Promise<void> => {
  const response = await apiClient.post(
    '/reportes/funeraria-suspendidos',
    { formato: 'excel' },
    { responseType: 'blob' }
  );

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const fecha = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `reporte-funeraria-suspendidos-${fecha}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export interface FichaAcuerdoFunerariaData {
  numero_acuerdo: string;
  numero_contrato?: string;
  fecha_inicio: string;
  /** Fin de los días de espera: antes no se puede usar la funeraria */
  fecha_fin_espera?: string;
  en_espera?: boolean;
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

/**
 * Genera e imprime (registra en audit log) la ficha del acuerdo de funeraria
 */
export const imprimirFichaAcuerdo = async (
  data: FichaAcuerdoFunerariaData
): Promise<ApiResponse<{ tipo: string; formato: string; contenido: string; longitud: number }>> => {
  const response = await apiClient.post('/impresion/ficha-acuerdo-funeraria', data);
  return response.data;
};

// ============================================
// TRASPASO DEL ACUERDO A OTRO SOCIO
// ============================================

/** Vista previa: qué pasaría al traspasar el acuerdo al socio de ese expediente */
export const vistaPreviaTraspaso = async (
  acuerdoId: number,
  expediente: string
): Promise<ApiResponse<VistaPreviaTraspaso>> => {
  const response = await apiClient.get(`/funeraria/acuerdos/${acuerdoId}/traspaso`, { params: { expediente } });
  return response.data;
};

/** Traspasa el acuerdo (todo o nada) */
export const confirmarTraspaso = async (
  acuerdoId: number,
  data: ConfirmarTraspasoData
): Promise<ApiResponse<ResultadoTraspaso>> => {
  const response = await apiClient.post(`/funeraria/acuerdos/${acuerdoId}/traspaso`, data);
  return response.data;
};
