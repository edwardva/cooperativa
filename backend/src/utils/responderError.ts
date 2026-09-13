// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Respuestas de error de los controladores de fase 2
// ============================================
//
// Los mensajes dicen qué pasó y qué corregir (RF-USA-04). Un choque con un
// índice único (dos usuarios registrando lo mismo a la vez) es un 409 que se
// explica, no un 500.

import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import type { ZodError } from 'zod';
import { logger } from './logger';
import { BadRequestError, ConflictError, NotFoundError } from '../middleware/errorHandler';

export const responderInvalido = (res: Response, error: ZodError): void => {
  const primero = error.errors[0];
  const campo = primero?.path.join('.');
  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: primero ? `${campo ? `${campo}: ` : ''}${primero.message}` : 'Datos inválidos',
      details: error.errors,
    },
  });
};

export const responderError = (res: Response, error: unknown, mensaje: string): void => {
  if (error instanceof BadRequestError || error instanceof ConflictError) {
    res.status(error.statusCode).json({
      success: false,
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICADO',
        message: 'Otro usuario acaba de registrar el mismo dato. Recargue la pantalla y revise antes de repetir.',
      },
    });
    return;
  }
  logger.error(`${mensaje}:`, error);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: mensaje } });
};
