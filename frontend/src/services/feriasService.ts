/**
 * ============================================
 * SERVICE: UBICACIONES
 * ============================================
 * Servicio para gestión de ubicaciones/ferias
 */

import apiClient from './api';

export interface Ubicacion {
  id: number;
  codigo: string;
  nombre: string;
  ubicacion?: string | null;
  direccion?: string | null;
  responsable?: string | null;
  telefono?: string | null;
  observaciones?: string | null;
  estado: boolean;
  created_at: string;
  _count?: {
    socios: number;
    /** Trabajadores activos con la feria como feria actual */
    trabajadores?: number;
  };
}

export interface CrearUbicacionDTO {
  codigo: string;
  nombre: string;
  ubicacion?: string | null;
  direccion?: string | null;
  responsable?: string | null;
  telefono?: string | null;
  observaciones?: string | null;
  estado?: boolean;
}

/** El codigo no se cambia: identifica a la feria en reportes e historiales */
export type ActualizarUbicacionDTO = Partial<Omit<CrearUbicacionDTO, 'codigo'>>;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any[];
  };
  message?: string;
  meta?: {
    total?: number;
  };
}

/**
 * Obtener todas las ubicaciones
 */
export const obtenerUbicaciones = async (): Promise<ApiResponse<Ubicacion[]>> => {
  const response = await apiClient.get<ApiResponse<Ubicacion[]>>('/ubicaciones');
  return response.data;
};

/**
 * Obtener ubicaciones activas
 */
export const obtenerUbicacionesActivas = async (): Promise<ApiResponse<Ubicacion[]>> => {
  const response = await apiClient.get<ApiResponse<Ubicacion[]>>('/ubicaciones/activas');
  return response.data;
};

/**
 * Obtener ubicación por ID
 */
export const obtenerUbicacionPorId = async (id: number): Promise<ApiResponse<Ubicacion>> => {
  const response = await apiClient.get<ApiResponse<Ubicacion>>(`/ubicaciones/${id}`);
  return response.data;
};

/**
 * Crear nueva ubicación
 */
export const crearUbicacion = async (
  datos: CrearUbicacionDTO
): Promise<ApiResponse<Ubicacion>> => {
  const response = await apiClient.post<ApiResponse<Ubicacion>>('/ubicaciones', datos);
  return response.data;
};

/**
 * Actualizar ubicación existente
 */
export const actualizarUbicacion = async (
  id: number,
  datos: ActualizarUbicacionDTO
): Promise<ApiResponse<Ubicacion>> => {
  const response = await apiClient.put<ApiResponse<Ubicacion>>(`/ubicaciones/${id}`, datos);
  return response.data;
};

/**
 * Eliminar/Desactivar ubicación
 */
export const eliminarUbicacion = async (id: number): Promise<ApiResponse<void>> => {
  const response = await apiClient.delete<ApiResponse<void>>(`/ubicaciones/${id}`);
  return response.data;
};
