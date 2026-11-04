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
    /** En que moneda se lleva el ahorro: la cuenta a la vista va en bolivares */
    moneda: 'bs' | 'usd';
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
  saldo_nuevo_usd: number;
  /** Saldo en bolívares tras el movimiento; nulo en movimientos viejos */
  saldo_nuevo_bs?: number | null;
  concepto?: string;
  referencia?: string;
  fecha_movimiento: string;
  created_at: string;
  cuenta?: {
    id: number;
    numero_cuenta: string;
    socio: {
      codigo_socio: string;
      nombre: string;
      apellido: string;
    };
    tipo_cuenta: {
      nombre: string;
      moneda?: 'bs' | 'usd';
    };
  };
}

/** Lo que devuelve el backend al registrar un depósito o retiro */
export interface MovimientoRegistrado {
  movimiento: MovimientoAhorro;
  cuenta: Omit<CuentaAhorro, '_count'>;
  /** El movimiento sólo guarda el saldo anterior en dólares */
  saldo_anterior_bs: number;
}

/** Un expediente candidato a abrir cuenta (ver GET /ahorro/socios-apertura) */
export interface SocioApertura {
  id: number;
  codigo_socio: string;
  cedula: string;
  nombre: string;
  apellido: string;
  estado: string;
  ubicacion: { id: number; codigo: string; nombre: string; tipo: 'sector' | 'feria' } | null;
  es_trabajador: boolean;
  cuentas_ahorro: {
    id: number;
    numero_cuenta: string;
    estado: boolean;
    tipo_cuenta_id: number;
    tipo_cuenta: { nombre: string };
  }[];
  puede_abrir: boolean;
  /** Por qué no puede abrir ahorro (feria, retirado, sin sector) */
  motivo_no_puede: string | null;
}

export interface TipoCuentaAhorro {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  /** En que moneda se lleva el ahorro de este tipo de cuenta */
  moneda: 'bs' | 'usd';
}

export interface AperturaCuentaData {
  socio_id: number;
  tipo_cuenta_id: number;
  /** En la moneda del tipo de cuenta */
  monto_inicial?: number;
}

export interface MovimientoData {
  cuenta_id: number;
  tipo_movimiento: 'deposito' | 'retiro';
  /** En la moneda del tipo de cuenta: bolivares a la vista, dolares en divisas */
  monto: number;
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
 * Obtener tipos de cuenta activos
 */
export const obtenerTiposCuenta = async (): Promise<ApiResponse<TipoCuentaAhorro[]>> => {
  const response = await apiClient.get<ApiResponse<TipoCuentaAhorro[]>>('/ahorro/tipos-cuenta');
  return response.data;
};

/**
 * Obtener TODOS los tipos de cuenta (incluyendo inactivos, con conteo)
 * Para uso en CRUD/administración
 */
export const obtenerTodosTiposCuenta = async (): Promise<ApiResponse<TipoCuentaAhorro[]>> => {
  const response = await apiClient.get<ApiResponse<TipoCuentaAhorro[]>>('/ahorro/tipos-cuenta/todos');
  return response.data;
};

/**
 * Buscar expedientes para abrir cuenta, por cédula, expediente o nombre.
 * Devuelve todos los expedientes de la persona, cada uno con si puede abrir.
 */
export const buscarSociosApertura = async (q: string): Promise<ApiResponse<SocioApertura[]>> => {
  const response = await apiClient.get<ApiResponse<SocioApertura[]>>('/ahorro/socios-apertura', {
    params: { q },
  });
  return response.data;
};

/**
 * Apertura de nueva cuenta
 */
export const aperturarCuenta = async (
  data: AperturaCuentaData
): Promise<ApiResponse<CuentaAhorro> & { message?: string }> => {
  const response = await apiClient.post<ApiResponse<CuentaAhorro> & { message?: string }>(
    '/ahorro/cuentas/apertura',
    data
  );
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
): Promise<ApiResponse<MovimientoRegistrado>> => {
  const response = await apiClient.post<ApiResponse<MovimientoRegistrado>>('/ahorro/movimientos', data);
  return response.data;
};

/**
 * Consultar movimientos con filtros
 */
export const consultarMovimientos = async (params?: {
  cuenta_id?: number;
  socio_id?: number;
  tipo_cuenta_id?: number;
  tipo_movimiento?: 'deposito' | 'retiro';
  /** Día 'YYYY-MM-DD' (el backend lo toma en hora de Venezuela) o instante ISO */
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
