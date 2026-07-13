import bcrypt from 'bcrypt'
import jwt, { SignOptions } from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { config } from '@/config'
import { UnauthorizedError, BadRequestError } from '@/middleware/errorHandler'
import { logger } from '@/utils/logger'

const prisma = new PrismaClient()

interface LoginCredentials {
  username: string
  password: string
}

interface AuthResponse {
  token: string
  user: {
    id: number
    username: string
    email: string | null
    nombre: string
    rol: {
      id: number
      nombre: string
      permisos: Record<string, string[]>
    }
  }
}

/**
 * Servicio de autenticación
 * Maneja login, registro y validación de tokens
 */
class AuthService {
  /**
   * Autenticar usuario con username y password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials

    // Buscar usuario con su rol y permisos
    const usuario = await prisma.usuario.findUnique({
      where: { username },
      include: {
        rol: true,
      },
    })

    if (!usuario) {
      logger.warn(`Intento de login fallido: usuario ${username} no existe`)
      throw new UnauthorizedError('Credenciales inválidas')
    }

    // Verificar que el usuario esté activo
    if (usuario.estado !== 'activo') {
      logger.warn(`Intento de login con usuario inactivo: ${username}`)
      throw new UnauthorizedError('Usuario inactivo')
    }

    // Verificar password
    const isPasswordValid = await bcrypt.compare(password, usuario.password_hash)

    if (!isPasswordValid) {
      logger.warn(`Intento de login fallido: password incorrecto para ${username}`)
      throw new UnauthorizedError('Credenciales inválidas')
    }

    // Generar JWT token
    const payload = {
      userId: usuario.id,
      username: usuario.username,
      rolId: usuario.rol_id,
    };
    const token = jwt.sign(payload, config.jwtSecret, { 
      expiresIn: config.jwtExpiresIn
    } as SignOptions);

    // Actualizar último login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimo_acceso: new Date() },
    })

    logger.info(`Login exitoso: usuario ${username} (ID: ${usuario.id})`)

    return {
      token,
      user: {
        id: usuario.id,
        username: usuario.username,
        email: usuario.email,
        nombre: usuario.nombre_completo,
        rol: {
          id: usuario.rol.id,
          nombre: usuario.rol.nombre,
          permisos: usuario.rol.permisos as Record<string, string[]>,
        },
      },
    }
  }

  /**
   * Verificar y decodificar un JWT token
   */
  async verifyToken(token: string): Promise<{ userId: number; username: string; rolId: number }> {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as {
        userId: number
        username: string
        rolId: number
      }

      // Verificar que el usuario siga existiendo y activo
      const usuario = await prisma.usuario.findUnique({
        where: { id: decoded.userId },
      })

      if (!usuario || usuario.estado !== 'activo') {
        throw new UnauthorizedError('Token inválido o usuario inactivo')
      }

      return decoded
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Token inválido')
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expirado')
      }
      throw error
    }
  }

  /**
   * Obtener información completa del usuario actual
   */
  async getCurrentUser(userId: number) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        rol: true,
      },
    })

    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedError('Usuario no encontrado o inactivo')
    }

    // No retornar el password_hash
    const { password_hash, ...usuarioSinPassword } = usuario

    return {
      ...usuarioSinPassword,
      rol: {
        id: usuario.rol.id,
        nombre: usuario.rol.nombre,
        permisos: usuario.rol.permisos as Record<string, string[]>,
      },
    }
  }

  /**
   * Cambiar password del usuario
   */
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
    })

    if (!usuario) {
      throw new BadRequestError('Usuario no encontrado')
    }

    // Verificar password actual
    const isOldPasswordValid = await bcrypt.compare(oldPassword, usuario.password_hash)

    if (!isOldPasswordValid) {
      throw new UnauthorizedError('Password actual incorrecto')
    }

    // Validar nuevo password (mínimo 8 caracteres)
    if (newPassword.length < 8) {
      throw new BadRequestError('El nuevo password debe tener al menos 8 caracteres')
    }

    // Hash del nuevo password
    const newPasswordHash = await bcrypt.hash(newPassword, config.bcryptSaltRounds)

    // Actualizar password
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        password_hash: newPasswordHash,
        updated_at: new Date(),
      },
    })

    logger.info(`Password cambiado exitosamente para usuario ID: ${userId}`)
  }
}

export default new AuthService()
