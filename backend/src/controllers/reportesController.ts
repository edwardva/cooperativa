/**
 * ============================================
 * CONTROLLER: REPORTES
 * ============================================
 * Controlador para generación y descarga de reportes
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  generarReporteFunerariaSuspendidos,
  generarReporteSaludSuspendidos,
  generarReporteSaludAcuerdos,
  generarReporteSaludGrupos,
} from '../services/reportesService';

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const reporteFunerariaSuspendidosSchema = z.object({
  formato: z.literal('excel').default('excel'),
});

const reporteSaludSuspendidosSchema = z.object({
  formato: z.enum(['pdf', 'excel']),
});

const reporteSaludAcuerdosSchema = z.object({
  formato: z.literal('excel').default('excel'),
});

const reporteSaludGruposSchema = z.object({
  formato: z.literal('excel').default('excel'),
  tipo: z.enum(['activos', 'suspendidos', 'proximos_suspender']),
});

// ============================================
// CONTROLADORES
// ============================================

/**
 * POST /api/reportes/funeraria-suspendidos
 * Generar reporte de acuerdos de funeraria suspendidos
 */
export const reporteFunerariaSuspendidos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = reporteFunerariaSuspendidosSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const buffer = await generarReporteFunerariaSuspendidos(validacion.data.formato);

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `reporte-funeraria-suspendidos-${fecha}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reportes/salud-suspendidos
 * Generar reporte de acuerdos de salud suspendidos (PDF o Excel)
 */
export const reporteSaludSuspendidos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = reporteSaludSuspendidosSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const { formato } = validacion.data;
    const buffer = await generarReporteSaludSuspendidos(formato);

    const extension = formato === 'pdf' ? 'pdf' : 'xlsx';
    const mimeType =
      formato === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `reporte-salud-suspendidos-${fecha}.${extension}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reportes/salud-acuerdos
 * Generar reporte con TODOS los acuerdos de salud (no solo suspendidos)
 */
export const reporteSaludAcuerdos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = reporteSaludAcuerdosSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const buffer = await generarReporteSaludAcuerdos(validacion.data.formato);

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `reporte-salud-acuerdos-${fecha}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reportes/salud-grupos
 * Generar reporte Excel de acuerdos de salud agrupados (titular +
 * beneficiarios), filtrado por tipo de listado.
 */
export const reporteSaludGrupos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = reporteSaludGruposSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const buffer = await generarReporteSaludGrupos(validacion.data.tipo);

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `reporte-salud-${validacion.data.tipo}-${fecha}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

