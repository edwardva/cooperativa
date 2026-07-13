import { Request, Response, NextFunction } from 'express'
import authService from '@/services/authService'
import { UnauthorizedError } from './errorHandler'
import { logger } from '@/utils/logger'

// Extender el tipo Request de Express para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number
        username: string
        rolId: number
      }
    }
  }
}

/**
 * Middleware para autenticar requests usando JWT
 * Verifica que exista un token válido en las cookies o en el header Authorization
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Buscar token en cookies (preferido) o en header Authorization
    let token: string | undefined

    // 1. Buscar en cookies (httpOnly)
    if (req.cookies?.token) {
      token = req.cookies.token
    }
    // 2. Buscar en header Authorization (Bearer token)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7)
    }

    if (!token) {
      throw new UnauthorizedError('Token de autenticación no proporcionado')
    }

    // Verificar y decodificar el token
    const decoded = await authService.verifyToken(token)

    // Agregar información del usuario al request
    req.user = decoded

    next()
  } catch (error) {
    // Si el error ya es UnauthorizedError, pasarlo tal cual
    if (error instanceof UnauthorizedError) {
      next(error)
    } else {
      logger.error('Error en middleware de autenticación:', error)
      next(new UnauthorizedError('Error al verificar autenticación'))
    }
  }
}

/**
 * Middleware opcional de autenticación
 * No falla si no hay token, solo agrega el usuario si existe
 */
export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined

    if (req.cookies?.token) {
      token = req.cookies.token
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7)
    }

    if (token) {
      try {
        const decoded = await authService.verifyToken(token)
        req.user = decoded
      } catch (error) {
        // Ignorar errores de token en autenticación opcional
        logger.debug('Token inválido en autenticación opcional:', error)
      }
    }

    next()
  } catch (error) {
    // En autenticación opcional, nunca fallar
    next()
  }
}
