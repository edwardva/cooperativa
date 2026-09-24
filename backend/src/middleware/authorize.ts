import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { ForbiddenError, UnauthorizedError } from './errorHandler'
import { logger } from '@/utils/logger'

/**
 * Cache de permisos de roles para optimizar performance
 * Se limpia cada 5 minutos
 */
const permissionsCache = new Map<number, Record<string, string[]>>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

setInterval(() => {
  permissionsCache.clear()
  logger.debug('Cache de permisos limpiado')
}, CACHE_TTL)

/**
 * Obtener permisos de un rol (con cache)
 */
async function getRolPermisos(rolId: number): Promise<Record<string, string[]>> {
  // Verificar cache
  if (permissionsCache.has(rolId)) {
    return permissionsCache.get(rolId)!
  }

  // Buscar en BD
  const rol = await prisma.rol.findUnique({
    where: { id: rolId },
    select: { permisos: true },
  })

  if (!rol) {
    return {}
  }

  const permisos = rol.permisos as Record<string, string[]>
  permissionsCache.set(rolId, permisos)

  return permisos
}

/** Para controles dentro de un controlador: ¿el rol tiene esta acción en el módulo? */
export const tienePermiso = async (rolId: number, modulo: string, accion: string): Promise<boolean> =>
  (await getRolPermisos(rolId))[modulo]?.includes(accion) ?? false

/**
 * Middleware para verificar que el usuario tenga permiso para una acción en un módulo
 * 
 * @param module - Nombre del módulo (ej: 'socios', 'prestamos', 'colecta')
 * @param action - Acción requerida (ej: 'read', 'create', 'update', 'delete')
 * 
 * @example
 * router.post('/socios', authenticate, authorize('socios', 'create'), createSocio)
 */
export const authorize = (module: string, action: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.user) {
        throw new UnauthorizedError('Usuario no autenticado')
      }

      const { rolId, username } = req.user

      // Obtener permisos del rol
      const permisos = await getRolPermisos(rolId)

      // Verificar si el rol tiene permisos para el módulo
      if (!permisos[module]) {
        logger.warn(
          `Usuario ${username} (rol ${rolId}) intentó acceder a módulo ${module} sin permisos`
        )
        throw new ForbiddenError(`No tienes permisos para acceder al módulo ${module}`)
      }

      // Verificar si el rol tiene permiso para la acción específica
      if (!permisos[module].includes(action)) {
        logger.warn(
          `Usuario ${username} (rol ${rolId}) intentó ${action} en ${module} sin permisos`
        )
        throw new ForbiddenError(`No tienes permisos para ${action} en ${module}`)
      }

      // Usuario tiene permisos, continuar
      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware para verificar que el usuario tenga ALGUNO de los permisos especificados
 * Útil cuando una acción requiere uno de varios permisos posibles
 * 
 * @param permissionsArray - Array de objetos {module, action}
 * 
 * @example
 * router.get('/reportes', authenticate, authorizeAny([
 *   { module: 'reportes', action: 'read' },
 *   { module: 'admin', action: 'read' }
 * ]), getReportes)
 */
export const authorizeAny = (permissionsArray: Array<{ module: string; action: string }>) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Usuario no autenticado')
      }

      const { rolId, username } = req.user
      const permisos = await getRolPermisos(rolId)

      // Verificar si el usuario tiene ALGUNO de los permisos requeridos
      const hasPermission = permissionsArray.some(({ module, action }) => {
        return permisos[module]?.includes(action)
      })

      if (!hasPermission) {
        logger.warn(
          `Usuario ${username} (rol ${rolId}) intentó acceder sin los permisos necesarios`
        )
        throw new ForbiddenError('No tienes los permisos necesarios para realizar esta acción')
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware para verificar que el usuario tenga TODOS los permisos especificados
 * 
 * @param permissionsArray - Array de objetos {module, action}
 * 
 * @example
 * router.post('/prestamos/aprobar', authenticate, authorizeAll([
 *   { module: 'prestamos', action: 'update' },
 *   { module: 'finanzas', action: 'approve' }
 * ]), aprobarPrestamo)
 */
export const authorizeAll = (permissionsArray: Array<{ module: string; action: string }>) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Usuario no autenticado')
      }

      const { rolId, username } = req.user
      const permisos = await getRolPermisos(rolId)

      // Verificar si el usuario tiene TODOS los permisos requeridos
      const hasAllPermissions = permissionsArray.every(({ module, action }) => {
        return permisos[module]?.includes(action)
      })

      if (!hasAllPermissions) {
        logger.warn(
          `Usuario ${username} (rol ${rolId}) intentó acceder sin todos los permisos necesarios`
        )
        throw new ForbiddenError('No tienes todos los permisos necesarios para realizar esta acción')
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
