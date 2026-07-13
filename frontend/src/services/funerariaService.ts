/**
 * ============================================
 * SERVICE: FUNERARIA
 * ============================================
 * Servicio para gestión de acuerdos de funeraria
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
  descripcion?: string;
  monto_usd: number;
  ubicacion?: string;
  estado: boolean;
}

export interface AcuerdoFuneraria {
  id: number;
  estado: 'activo' | 'suspendido' | 'retirado';
  fecha_inicio: string;
  semanas_sin_pago: number;
  fecha_suspension?: string | null;
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

export interface CrearAcuerdoData {
  socio_id: number;
  tipo_acuerdo_id: number;
  beneficiario_id?: number;
  fecha_inicio?: string;
}

export interface CambiarEstadoData {
  estado: 'activo' | 'suspendido' | 'retirado';
  motivo?: string;
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

/**
 * Obtener acuerdos de un socio específico
 */
export const obtenerAcuerdosPorSocio = async (
  socioId: number
): Promise<ApiResponse<{ socio: unknown; acuerdos: AcuerdoFuneraria[] }>> => {
  const response = await apiClient.get(`/funeraria/acuerdos/socio/${socioId}`);
  return response.data;
};

/**
 * Obtener detalle completo de un acuerdo
 */
export const obtenerAcuerdo = async (
  id: number
): Promise<
  ApiResponse<
    AcuerdoFuneraria & {
      movimientos: MovimientoFuneraria[];
    }
  >
> => {
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

/**
 * Cambiar estado de un acuerdo (suspender, reactivar, retirar)
 */
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
