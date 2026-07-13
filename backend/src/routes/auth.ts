import { Router, Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import authService from '@/services/authService'
import { authenticate } from '@/middleware/authenticate'
import { BadRequestError } from '@/middleware/errorHandler'
import { logger } from '@/utils/logger'

const router = Router()

/**
 * POST /api/auth/login
 * Autenticar usuario y retornar JWT token
 */
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username es requerido'),
    body('password').notEmpty().withMessage('Password es requerido'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validar input
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new BadRequestError('Datos de login inválidos', errors.array())
      }

      const { username, password } = req.body

      // Autenticar
      const authResponse = await authService.login({ username, password })

      // Guardar token en httpOnly cookie (seguro contra XSS)
      res.cookie('token', authResponse.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS solo en producción
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      })

      // Retornar datos del usuario y token (para localStorage si es necesario)
      res.json({
        success: true,
        data: {
          token: authResponse.token,
          user: authResponse.user,
        },
      })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * POST /api/auth/logout
 * Cerrar sesión del usuario
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Limpiar cookie
    res.clearCookie('token')

    logger.info(`Logout exitoso: usuario ${req.user?.username}`)

    res.json({
      success: true,
      data: { message: 'Logout exitoso' },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/auth/me
 * Obtener información del usuario actual
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new BadRequestError('Usuario no autenticado')
    }

    const usuario = await authService.getCurrentUser(req.user.userId)

    res.json({
      success: true,
      data: usuario,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/auth/change-password
 * Cambiar password del usuario actual
 */
router.post(
  '/change-password',
  authenticate,
  [
    body('oldPassword').notEmpty().withMessage('Password actual es requerido'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('El nuevo password debe tener al menos 8 caracteres'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validar input
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new BadRequestError('Datos inválidos', errors.array())
      }

      if (!req.user) {
        throw new BadRequestError('Usuario no autenticado')
      }

      const { oldPassword, newPassword } = req.body

      await authService.changePassword(req.user.userId, oldPassword, newPassword)

      res.json({
        success: true,
        data: { message: 'Password cambiado exitosamente' },
      })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * GET /api/auth/verify
 * Verificar si el token es válido (endpoint de utilidad)
 */
router.get('/verify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Si llegó aquí, el token es válido (pasó por authenticate middleware)
    res.json({
      success: true,
      data: {
        valid: true,
        user: req.user,
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
