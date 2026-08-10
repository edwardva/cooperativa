import apiClient from './api';

// ============================================
// TIPOS
// ============================================

export interface EstadisticasDashboard {
  socios: {
    total: number;
    activos: number;
    nuevos_hoy: number;
    nuevos_semana: number;
  };
  ahorro: {
    total_cuentas: number;
    cuentas_activas: number;
    total_saldo_usd: number;
    total_saldo_bs: number;
  };
  prestamos: {
    total_activos: number;
    monto_total_usd: number;
    monto_total_bs: number;
  };
  colectas: {
    hoy: number;
    semana: number;
  };
  funeraria: {
    total_acuerdos: number;
    activos: number;
    suspendidos: number;
  };
  salud: {
    total_acuerdos: number;
    activos: number;
    suspendidos: number;
  };
}

export interface ActividadReciente {
  id: number;
  tipo: 'colecta' | 'prestamo' | 'socio' | 'ahorro';
  socio_id: number;
  socio_nombre: string;
  socio_apellido: string;
  monto?: number;
  moneda?: string;
  fecha: string;
  descripcion: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// SERVICIO
// ============================================

/**
 * Obtener estadísticas generales del dashboard
 */
export const obtenerEstadisticas = async (): Promise<ApiResponse<EstadisticasDashboard>> => {
  const response = await apiClient.get<ApiResponse<EstadisticasDashboard>>('/dashboard/estadisticas');
  return response.data;
};

/**
 * Obtener actividad reciente del sistema
 */
export const obtenerActividadReciente = async (): Promise<ApiResponse<ActividadReciente[]>> => {
  const response = await apiClient.get<ApiResponse<ActividadReciente[]>>('/dashboard/actividad-reciente');
  return response.data;
};
