// ============================================
// COOPERATIVA EL TRIUNFO - MIDDLEWARE
// Sesion del SOCIO en el cajero digital
// ============================================
//
// Separa los dos mundos. El personal entra por `authenticate` y los socios por
// aqui; aunque el secreto de firma sea el mismo, cada middleware solo acepta
// tokens de su tipo. Un socio no puede llegar al administrativo presentando su
// token, ni un empleado operar como socio con el suyo.

import type { NextFunction, Request, Response } from 'express';
import { verificarTokenSocio } from '../services/cajeroDigitalService';
import { UnauthorizedError } from './errorHandler';

declare global {
  namespace Express {
    interface Request {
      /** Presente solo en las rutas del cajero digital */
      socio?: {
        usuarioDigitalId: number;
        socioId: number;
      };
    }
  }
}

export const autenticarSocio = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const cabecera = req.headers.authorization;
    if (!cabecera?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Debe iniciar sesión');
    }
    req.socio = await verificarTokenSocio(cabecera.slice(7));
    next();
  } catch (error) {
    next(error);
  }
};
