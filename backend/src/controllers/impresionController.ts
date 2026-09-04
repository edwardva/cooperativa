// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Motor de Impresión
// ============================================

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  generarTicketColecta,
  generarNotaOperacion,
  generarCarnetSocio,
  generarFichaAcuerdoFuneraria,
  generarFichaAcuerdoSalud,
  registrarImpresion,
  type TicketColecta,
  type NotaOperacion,
  type CarnetSocio,
  type FichaAcuerdoFuneraria,
  type FichaAcuerdoSalud
} from '../services/impresionService';

// ============================================
// SCHEMAS DE VALIDACIÓN ZOD
// ============================================

const imprimirTicketColectaSchema = z.object({
  numero_ticket: z.string(),
  fecha: z.string().transform((str) => new Date(str)),
  socio: z.object({
    cedula: z.string(),
    nombre: z.string(),
    codigo: z.string()
  }),
  conceptos: z.array(z.object({
    tipo: z.string(),
    descripcion: z.string(),
    monto_usd: z.number(),
    monto_bs: z.number()
  })),
  total_usd: z.number(),
  total_bs: z.number(),
  tasa_cambio: z.number(),
  cajero: z.string(),
  ubicacion: z.string()
});

const imprimirNotaOperacionSchema = z.object({
  numero_nota: z.string(),
  fecha: z.string().transform((str) => new Date(str)),
  tipo_operacion: z.string(),
  socio: z.object({
    cedula: z.string(),
    nombre: z.string()
  }).optional(),
  detalles: z.string(),
  monto: z.number().optional(),
  moneda: z.string().optional(),
  usuario: z.string()
});

const imprimirCarnetSocioSchema = z.object({
  codigo: z.string(),
  cedula: z.string(),
  nombre: z.string(),
  foto_url: z.string().optional(),
  fecha_ingreso: z.string().transform((str) => new Date(str)),
  ubicacion: z.string(),
  tipo_socio: z.string(),
  qr_data: z.string().optional()
});

const imprimirFichaAcuerdoFunerariaSchema = z.object({
  numero_acuerdo: z.string(),
  numero_contrato: z.string().optional(),
  fecha_inicio: z.string().transform((str) => new Date(str)),
  socio: z.object({
    codigo: z.string(),
    cedula: z.string(),
    nombre: z.string(),
    direccion: z.string().optional(),
    telefono: z.string().optional()
  }),
  beneficiarios: z.array(z.object({
    id: z.number(),
    nombre: z.string(),
    cedula: z.string(),
    parentesco: z.string(),
    fecha_ingreso: z.string().transform((str) => new Date(str)),
    fecha_nacimiento: z.string().transform((str) => new Date(str)).optional(),
    edad: z.number().optional(),
    estado: z.string().optional()
  }))
});

// Mismo shape que la ficha de funeraria: titular + beneficiarios del mismo número de acuerdo.
const imprimirFichaAcuerdoSaludSchema = imprimirFichaAcuerdoFunerariaSchema;

// ============================================
// FUNCIONES DEL CONTROLADOR
// ============================================

/**
 * Imprimir ticket de colecta
 * POST /api/impresion/ticket-colecta
 */
export const imprimirTicketColecta = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = imprimirTicketColectaSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: validacion.error.errors
        }
      });
      return;
    }

    const data = validacion.data as TicketColecta;
    const contenido = generarTicketColecta(data);

    // Registrar en audit log
    if (req.user?.userId) {
      await registrarImpresion(
        'ticket_colecta',
        parseInt(data.numero_ticket.replace(/\D/g, '') || '0'),
        req.user.userId,
        contenido
      );
    }

    res.json({
      success: true,
      data: {
        tipo: 'ticket_colecta',
        formato: 'texto_80mm',
        contenido,
        longitud: contenido.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Imprimir nota de operación
 * POST /api/impresion/nota-operacion
 */
export const imprimirNotaOperacion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = imprimirNotaOperacionSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: validacion.error.errors
        }
      });
      return;
    }

    const data = validacion.data as NotaOperacion;
    const contenido = generarNotaOperacion(data);

    // Registrar en audit log
    if (req.user?.userId) {
      await registrarImpresion(
        'nota_operacion',
        parseInt(data.numero_nota.replace(/\D/g, '') || '0'),
        req.user.userId,
        contenido
      );
    }

    res.json({
      success: true,
      data: {
        tipo: 'nota_operacion',
        formato: 'texto_80mm',
        contenido,
        longitud: contenido.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Imprimir carnet de socio
 * POST /api/impresion/carnet-socio
 */
export const imprimirCarnetSocio = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = imprimirCarnetSocioSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: validacion.error.errors
        }
      });
      return;
    }

    const data = validacion.data as CarnetSocio;
    const contenido = generarCarnetSocio(data);

    // Registrar en audit log
    if (req.user?.userId) {
      await registrarImpresion(
        'carnet_socio',
        parseInt(data.codigo.replace(/\D/g, '') || '0'),
        req.user.userId,
        contenido
      );
    }

    res.json({
      success: true,
      data: {
        tipo: 'carnet_socio',
        formato: 'texto_80mm',
        contenido,
        longitud: contenido.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Imprimir ficha de acuerdo de funeraria
 * POST /api/impresion/ficha-acuerdo-funeraria
 */
export const imprimirFichaAcuerdoFuneraria = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = imprimirFichaAcuerdoFunerariaSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: validacion.error.errors
        }
      });
      return;
    }

    const data = validacion.data as FichaAcuerdoFuneraria;
    const contenido = generarFichaAcuerdoFuneraria(data);

    // Registrar en audit log
    if (req.user?.userId) {
      await registrarImpresion(
        'ficha_acuerdo_funeraria',
        parseInt(data.numero_acuerdo.replace(/\D/g, '') || '0'),
        req.user.userId,
        contenido
      );
    }

    res.json({
      success: true,
      data: {
        tipo: 'ficha_acuerdo_funeraria',
        formato: 'texto_80mm',
        contenido,
        longitud: contenido.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Imprimir ficha de acuerdo de salud (titular + beneficiarios del grupo)
 * POST /api/impresion/ficha-acuerdo-salud
 */
export const imprimirFichaAcuerdoSalud = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = imprimirFichaAcuerdoSaludSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: validacion.error.errors
        }
      });
      return;
    }

    const data = validacion.data as FichaAcuerdoSalud;
    const contenido = generarFichaAcuerdoSalud(data);

    if (req.user?.userId) {
      await registrarImpresion(
        'ficha_acuerdo_salud',
        parseInt(data.numero_acuerdo.replace(/\D/g, '') || '0'),
        req.user.userId,
        contenido
      );
    }

    res.json({
      success: true,
      data: {
        tipo: 'ficha_acuerdo_salud',
        formato: 'texto_80mm',
        contenido,
        longitud: contenido.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener formatos disponibles de impresión
 * GET /api/impresion/formatos
 */
export const obtenerFormatosDisponibles = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const formatos = [
      {
        id: 'ticket_colecta',
        nombre: 'Ticket de Colecta',
        descripcion: 'Comprobante de pago de colecta (ahorro, funeraria, salud)',
        ancho_mm: 80,
        formato: 'texto',
        orientacion: 'vertical'
      },
      {
        id: 'nota_operacion',
        nombre: 'Nota de Operación',
        descripcion: 'Nota para operaciones especiales y movimientos',
        ancho_mm: 80,
        formato: 'texto',
        orientacion: 'vertical'
      },
      {
        id: 'carnet_socio',
        nombre: 'Carnet de Socio',
        descripcion: 'Credencial de identificación del socio',
        ancho_mm: 80,
        formato: 'texto',
        orientacion: 'vertical',
        nota: 'Próximamente incluirá código QR'
      },
      {
        id: 'ficha_acuerdo_funeraria',
        nombre: 'Ficha de Acuerdo Funeraria',
        descripcion: 'Datos del socio y beneficiarios cubiertos por el acuerdo',
        ancho_mm: 80,
        formato: 'texto',
        orientacion: 'vertical'
      },
      {
        id: 'ficha_acuerdo_salud',
        nombre: 'Ficha de Acuerdo Salud',
        descripcion: 'Datos del titular y beneficiarios del acuerdo de salud',
        ancho_mm: 80,
        formato: 'texto',
        orientacion: 'vertical'
      }
    ];

    res.json({
      success: true,
      data: formatos
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vista previa de ticket (sin registrar en audit log)
 * POST /api/impresion/preview
 */
export const generarVistaPrevia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tipo, data } = req.body;

    if (!tipo || !data) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Se requiere tipo y data'
        }
      });
      return;
    }

    let contenido: string;

    switch (tipo) {
      case 'ticket_colecta':
        const ticketValidacion = imprimirTicketColectaSchema.safeParse(data);
        if (!ticketValidacion.success) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Datos inválidos para ticket de colecta',
              details: ticketValidacion.error.errors
            }
          });
          return;
        }
        contenido = generarTicketColecta(ticketValidacion.data as TicketColecta);
        break;

      case 'nota_operacion':
        const notaValidacion = imprimirNotaOperacionSchema.safeParse(data);
        if (!notaValidacion.success) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Datos inválidos para nota de operación',
              details: notaValidacion.error.errors
            }
          });
          return;
        }
        contenido = generarNotaOperacion(notaValidacion.data as NotaOperacion);
        break;

      case 'carnet_socio':
        const carnetValidacion = imprimirCarnetSocioSchema.safeParse(data);
        if (!carnetValidacion.success) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Datos inválidos para carnet de socio',
              details: carnetValidacion.error.errors
            }
          });
          return;
        }
        contenido = generarCarnetSocio(carnetValidacion.data as CarnetSocio);
        break;

      case 'ficha_acuerdo_funeraria':
        const fichaValidacion = imprimirFichaAcuerdoFunerariaSchema.safeParse(data);
        if (!fichaValidacion.success) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Datos inválidos para ficha de acuerdo funeraria',
              details: fichaValidacion.error.errors
            }
          });
          return;
        }
        contenido = generarFichaAcuerdoFuneraria(fichaValidacion.data as FichaAcuerdoFuneraria);
        break;

      case 'ficha_acuerdo_salud':
        const fichaSaludValidacion = imprimirFichaAcuerdoSaludSchema.safeParse(data);
        if (!fichaSaludValidacion.success) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Datos inválidos para ficha de acuerdo de salud',
              details: fichaSaludValidacion.error.errors
            }
          });
          return;
        }
        contenido = generarFichaAcuerdoSalud(fichaSaludValidacion.data as FichaAcuerdoSalud);
        break;

      default:
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TYPE',
            message: 'Tipo de documento no soportado'
          }
        });
        return;
    }

    res.json({
      success: true,
      data: {
        tipo,
        formato: 'texto_80mm',
        contenido,
        preview: true
      }
    });
  } catch (error) {
    next(error);
  }
};
