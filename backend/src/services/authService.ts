import bcrypt from 'bcrypt'
import jwt, { SignOptions } from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { config } from '@/config'
import { UnauthorizedError, BadRequestError } from '@/middleware/errorHandler'
import { logger } from '@/utils/logger'

interface LoginCredentials {
  username: string
  password: string
  /** Caja desde la que entra. Opcional: hay usuarios que no atienden caja */
  caja_id?: number | null
}

interface AuthResponse {
  token: string
  /** La caja con la que quedo abierta la sesion, ya validada */
  caja: { id: number; codigo: string; nombre: string } | null
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
    const { username, password, caja_id } = credentials

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

    // La caja desde la que entra. Se valida aqui y no se confia en lo que
    // mande la pantalla: el registro de "quien hizo que y desde donde" no
    // sirve de nada si el dato se puede inventar desde el navegador.
    let caja: { id: number; codigo: string; nombre: string } | null = null;
    if (caja_id !== undefined && caja_id !== null) {
      const encontrada = await prisma.caja.findUnique({
        where: { id: caja_id },
        select: { id: true, codigo: true, nombre: true, estado: true },
      })
      if (!encontrada || !encontrada.estado) {
        throw new UnauthorizedError('La caja seleccionada no existe o está inactiva')
      }
      caja = { id: encontrada.id, codigo: encontrada.codigo, nombre: encontrada.nombre }
    }

    // Generar JWT token
    const payload = {
      userId: usuario.id,
      username: usuario.username,
      rolId: usuario.rol_id,
      // Viaja en el token: cada peticion sabe de que caja viene sin volver a
      // preguntarlo ni fiarse del cuerpo de la peticion
      cajaId: caja?.id ?? null,
    };
    const token = jwt.sign(payload, config.jwtSecret, { 
      expiresIn: config.jwtExpiresIn
    } as SignOptions);

    // Actualizar último login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimo_acceso: new Date() },
    })

    logger.info(
      `Login exitoso: usuario ${username} (ID: ${usuario.id})${caja ? ` desde ${caja.codigo}` : ''}`
    )

    return {
      token,
      caja,
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
  async verifyToken(
    token: string
  ): Promise<{ userId: number; username: string; rolId: number; cajaId: number | null }> {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as {
        userId: number
        username: string
        rolId: number
        // Las sesiones emitidas antes de que existieran las cajas no lo traen
        cajaId?: number | null
      }

      // Verificar que el usuario siga existiendo y activo
      const usuario = await prisma.usuario.findUnique({
        where: { id: decoded.userId },
      })

      if (!usuario || usuario.estado !== 'activo') {
        throw new UnauthorizedError('Token inválido o usuario inactivo')
      }

      return { ...decoded, cajaId: decoded.cajaId ?? null }
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
