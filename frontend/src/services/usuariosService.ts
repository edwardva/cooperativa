/**
 * ============================================
 * SERVICE: USUARIOS
 * ============================================
 * Alta y mantenimiento de los usuarios que entran al sistema. La clave nunca
 * vuelve del servidor: sólo se envía al crear o al restablecerla.
 */

import apiClient from './api'

export interface Usuario {
  id: number
  username: string
  nombre_completo: string
  email: string | null
  estado: 'activo' | 'inactivo'
  ultimo_acceso: string | null
  created_at: string
  rol: { id: number; nombre: string; descripcion: string | null }
}

export interface RolResumen {
  id: number
  nombre: string
  descripcion: string | null
  usuarios: number
  modulos: string[]
}

interface Respuesta<T> {
  success: boolean
  data: T
  error?: { message: string }
}

export interface DatosNuevoUsuario {
  username: string
  nombre_completo: string
  email?: string
  rol_id: number
  password: string
}

export interface DatosEdicionUsuario {
  nombre_completo?: string
  email?: string | null
  rol_id?: number
  estado?: 'activo' | 'inactivo'
}

export const listarUsuarios = async (): Promise<Respuesta<Usuario[]>> => {
  const { data } = await apiClient.get('/usuarios')
  return data
}

export const listarRoles = async (): Promise<Respuesta<RolResumen[]>> => {
  const { data } = await apiClient.get('/usuarios/roles')
  return data
}

export const crearUsuario = async (datos: DatosNuevoUsuario): Promise<Respuesta<Usuario>> => {
  const { data } = await apiClient.post('/usuarios', datos)
  return data
}

export const actualizarUsuario = async (
  id: number,
  datos: DatosEdicionUsuario
): Promise<Respuesta<Usuario>> => {
  const { data } = await apiClient.put(`/usuarios/${id}`, datos)
  return data
}

export const restablecerClave = async (
  id: number,
  password: string
): Promise<Respuesta<{ message: string }>> => {
  const { data } = await apiClient.post(`/usuarios/${id}/clave`, { password })
  return data
}

/** Cambiar la clave propia (cualquier usuario, sabiendo la actual) */
export const cambiarMiClave = async (
  oldPassword: string,
  newPassword: string
): Promise<Respuesta<{ message: string }>> => {
  const { data } = await apiClient.post('/auth/change-password', { oldPassword, newPassword })
  return data
}
