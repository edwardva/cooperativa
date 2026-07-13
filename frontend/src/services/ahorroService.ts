/**
 * ============================================
 * SERVICE: AHORRO
 * ============================================
 * Servicio para gestión de cuentas de ahorro y movimientos
 */

import apiClient from './api';

// ============================================
// TIPOS
// ============================================

export interface CuentaAhorro {
  id: number;
  numero_cuenta: string;
  saldo_usd: number;
  saldo_bs: number;
  monto_bloqueado_usd: number;
  monto_bloqueado_bs: number;
  estado: boolean;
  fecha_apertura: string;
  socio: {
    id: number;
    codigo_socio: string;
    cedula: string;
    nombre: string;
    apellido: string;
    estado: string;
  };
  tipo_cuenta: {
    id: number;
    codigo: string;
    nombre: string;
    descripcion?: string;
  };
  _count: {
    movimientos: number;
  };
}

export interface Estadisticas {
  total_cuentas: number;
  cuentas_activas: number;
  cuentas_inactivas: number;
  total_saldo_usd: number;
  total_saldo_bs: number;
  total_bloqueado_usd: number;
  total_bloqueado_bs: number;
  total_movimientos: number;
}

export interface MovimientoAhorro {
  id: number;
  cuenta_id: number;
  tipo_movimiento: 'deposito' | 'retiro';
  monto_usd: number;
  monto_bs: number;
  tasa_cambio: number;
  saldo_anterior_usd: number;
  saldo_posterior_usd: number;
  concepto?: string;
  referencia?: string;
  fecha: string;
  usuario_id: number;
  usuario?: {
    nombre: string;
    apellido: string;
  };
}

export interface AperturaCuentaData {
  socio_id: number;
  tipo_cuenta_id: number;
  monto_inicial_usd?: number;
}

export interface MovimientoData {
  cuenta_id: number;
  tipo_movimiento: 'deposito' | 'retiro';
  monto_usd: number;
  concepto?: string;
  referencia?: string;
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
// SERVICIOS DE CUENTAS
// ============================================

/**
 * Listar cuentas de ahorro con filtros y paginación
 */
export const obtenerCuentas = async (params?: {
  socio_id?: number;
  tipo_cuenta_id?: number;
  estado?: boolean;
  busqueda?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<CuentaAhorro>> => {
  const response = await apiClient.get<PaginatedResponse<CuentaAhorro>>('/ahorro/cuentas', {
    params,
  });
  return response.data;
};

/**
 * Obtener cuentas de un socio específico
 */
export const obtenerCuentasPorSocio = async (
  socioId: number
): Promise<ApiResponse<{ socio: unknown; cuentas: CuentaAhorro[]; totales: unknown }>> => {
  const response = await apiClient.get(`/ahorro/cuentas/socio/${socioId}`);
  return response.data;
};

/**
 * Obtener detalle de una cuenta
 */
export const obtenerCuenta = async (id: number): Promise<ApiResponse<CuentaAhorro>> => {
  const response = await apiClient.get<ApiResponse<CuentaAhorro>>(`/ahorro/cuentas/${id}`);
  return response.data;
};

/**
 * Apertura de nueva cuenta
 */
export const aperturarCuenta = async (
  data: AperturaCuentaData
): Promise<ApiResponse<CuentaAhorro>> => {
  const response = await apiClient.post<ApiResponse<CuentaAhorro>>('/ahorro/cuentas/apertura', data);
  return response.data;
};

/**
 * Cambiar estado de cuenta (activar/desactivar)
 */
export const cambiarEstadoCuenta = async (
  id: number,
  estado: boolean
): Promise<ApiResponse<CuentaAhorro>> => {
  const response = await apiClient.put<ApiResponse<CuentaAhorro>>(
    `/ahorro/cuentas/${id}/estado`,
    { estado }
  );
  return response.data;
};

// ============================================
// SERVICIOS DE MOVIMIENTOS
// ============================================

/**
 * Registrar depósito o retiro
 */
export const registrarMovimiento = async (
  data: MovimientoData
): Promise<ApiResponse<MovimientoAhorro>> => {
  const response = await apiClient.post<ApiResponse<MovimientoAhorro>>('/ahorro/movimientos', data);
  return response.data;
};

/**
 * Consultar movimientos con filtros
 */
export const consultarMovimientos = async (params?: {
  cuenta_id?: number;
  socio_id?: number;
  tipo_movimiento?: 'deposito' | 'retiro';
  fecha_desde?: string;
  fecha_hasta?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<MovimientoAhorro>> => {
  const response = await apiClient.get<PaginatedResponse<MovimientoAhorro>>('/ahorro/movimientos', {
    params,
  });
  return response.data;
};

// ============================================
// ESTADÍSTICAS Y UTILIDADES
// ============================================

/**
 * Obtener estadísticas generales de ahorro
 */
export const obtenerEstadisticas = async (): Promise<ApiResponse<Estadisticas>> => {
  const response = await apiClient.get<ApiResponse<Estadisticas>>('/ahorro/estadisticas');
  return response.data;
};

/**
 * Recalcular todos los saldos en Bs con tasa actual
 */
export const recalcularSaldos = async (): Promise<
  ApiResponse<{ cuentas_actualizadas: number; tasa_aplicada: number }>
> => {
  const response = await apiClient.post('/ahorro/recalcular-saldos');
  return response.data;
};
