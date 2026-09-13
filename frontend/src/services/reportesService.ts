/**
 * ============================================
 * SERVICE: REPORTES
 * ============================================
 * La tabla que se ve en pantalla y la que baja en Excel o PDF salen del mismo
 * generador del backend: los totales coinciden.
 */

import axios from 'axios'
import apiClient from './api'

export type ClaveReporte =
  | 'ferias-pendientes'
  | 'pagos-salud'
  | 'trabajadores-feria'
  | 'cartera-prestamos'
  | 'semanas-adelantadas'
  | 'colectas'

export type Celda = string | number | null

export interface Reporte {
  clave: ClaveReporte
  titulo: string
  subtitulo?: string
  columnas: string[]
  filas: Celda[][]
  totales: { etiqueta: string; valor: Celda }[]
}

export type ParametrosReporte = Record<string, string | undefined>

const limpiar = (params: ParametrosReporte) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))

export const verReporte = async (clave: ClaveReporte, params: ParametrosReporte): Promise<Reporte> => {
  const response = await apiClient.get(`/reportes/generar/${clave}`, { params: limpiar(params) })
  return response.data.data
}

/**
 * Descarga el Excel o PDF. Con responseType blob el error también llega como
 * blob: se lee para mostrar el mensaje del backend y no un "Request failed".
 */
export const exportarReporte = async (
  clave: ClaveReporte,
  formato: 'excel' | 'pdf',
  params: ParametrosReporte
): Promise<void> => {
  try {
    const response = await apiClient.get(`/reportes/exportar/${clave}`, {
      params: { ...limpiar(params), formato },
      responseType: 'blob',
    })
    const disposicion = String(response.headers['content-disposition'] ?? '')
    const nombre = disposicion.match(/filename="([^"]+)"/)?.[1] ?? `${clave}.${formato === 'excel' ? 'xlsx' : 'pdf'}`

    const url = window.URL.createObjectURL(new Blob([response.data]))
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.setAttribute('download', nombre)
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        const cuerpo = JSON.parse(await error.response.data.text())
        throw new Error(cuerpo?.error?.message ?? 'No fue posible exportar el reporte')
      } catch (e) {
        if (e instanceof Error && e.message) throw e
      }
    }
    throw error
  }
}
