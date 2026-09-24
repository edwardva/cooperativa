import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { indicadores } from '../services/indicadoresService';

// ============================================
// INTERFACES
// ============================================

interface EstadisticasDashboard {
  socios: {
    total: number;
    activos: number;
    nuevos_hoy: number;
    nuevos_semana: number;
  };
  ahorro: {
    total_cuentas: number;
    cuentas_activas: number;
    total_saldo_usd: number;
    total_saldo_bs: number;
  };
  prestamos: {
    total_activos: number;
    monto_total_usd: number;
    monto_total_bs: number;
  };
  colectas: {
    hoy: number;
    semana: number;
  };
  funeraria: {
    total_acuerdos: number;
    activos: number;
    suspendidos: number;
  };
  salud: {
    total_acuerdos: number;
    activos: number;
    suspendidos: number;
  };
}

interface ActividadReciente {
  id: number;
  tipo: 'colecta' | 'prestamo' | 'socio' | 'ahorro';
  socio_id: number;
  socio_nombre: string;
  socio_apellido: string;
  monto?: number;
  moneda?: string;
  fecha: Date;
  descripcion: string;
}

// ============================================
// CONTROLADORES
// ============================================

/**
 * GET /api/dashboard/estadisticas
 * Obtener estadísticas generales para el dashboard
 */
export const obtenerEstadisticasDashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - 7);

    // Ejecutar todas las consultas en paralelo
    const [
      // Socios
      totalSocios,
      sociosActivos,
      nuevosHoy,
      nuevosSemana,
      
      // Ahorro
      totalCuentasAhorro,
      cuentasAhorroActivas,
      saldosAhorro,
      
      // Préstamos (cuando se implemente)
      // totalPrestamosActivos,
      // montosPrestamos,
      
      // Colectas (cuando se implemente el módulo)
      // colectasHoy,
      // colectasSemana,
      
      // Funeraria
      totalFuneraria,
      funerariaActivos,
      funerariaSuspendidos,
      
      // Salud
      totalSalud,
      saludActivos,
      saludSuspendidos,
    ] = await Promise.all([
      // Socios
      prisma.socio.count(),
      prisma.socio.count({ where: { estado: 'activo' } }),
      prisma.socio.count({ 
        where: { 
          fecha_inscripcion: { gte: inicioHoy }
        } 
      }),
      prisma.socio.count({ 
        where: { 
          fecha_inscripcion: { gte: inicioSemana }
        } 
      }),
      
      // Ahorro
      prisma.cuentaAhorro.count(),
      prisma.cuentaAhorro.count({ where: { estado: true } }),
      prisma.cuentaAhorro.aggregate({
        _sum: {
          saldo_usd: true,
          saldo_bs: true,
        },
        where: { estado: true }
      }),
      
      // Funeraria
      prisma.acuerdoFuneraria.count(),
      prisma.acuerdoFuneraria.count({ where: { estado: 'activo' } }),
      prisma.acuerdoFuneraria.count({ where: { estado: 'suspendido' } }),
      
      // Salud
      prisma.acuerdoSalud.count(),
      prisma.acuerdoSalud.count({ where: { estado: 'activo' } }),
      prisma.acuerdoSalud.count({ where: { estado: 'suspendido' } }),
    ]);

    const estadisticas: EstadisticasDashboard = {
      socios: {
        total: totalSocios,
        activos: sociosActivos,
        nuevos_hoy: nuevosHoy,
        nuevos_semana: nuevosSemana,
      },
      ahorro: {
        total_cuentas: totalCuentasAhorro,
        cuentas_activas: cuentasAhorroActivas,
        total_saldo_usd: Number(saldosAhorro._sum.saldo_usd || 0),
        total_saldo_bs: Number(saldosAhorro._sum.saldo_bs || 0),
      },
      prestamos: {
        total_activos: 0, // TODO: Implementar cuando exista módulo de préstamos
        monto_total_usd: 0,
        monto_total_bs: 0,
      },
      colectas: {
        hoy: 0, // TODO: Implementar cuando exista módulo de colecta
        semana: 0,
      },
      funeraria: {
        total_acuerdos: totalFuneraria,
        activos: funerariaActivos,
        suspendidos: funerariaSuspendidos,
      },
      salud: {
        total_acuerdos: totalSalud,
        activos: saludActivos,
        suspendidos: saludSuspendidos,
      },
    };

    res.json({
      success: true,
      data: estadisticas,
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas del dashboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener estadísticas',
      },
    });
  }
};

/**
 * GET /api/dashboard/actividad-reciente
 * Obtener actividad reciente del sistema (últimos movimientos)
 */
export const obtenerActividadReciente = async (_req: Request, res: Response): Promise<void> => {
  try {
    const limite = 10;

    // Obtener últimos movimientos de ahorro
    const movimientosAhorro = await prisma.movimientoAhorro.findMany({
      take: limite,
      orderBy: { fecha_movimiento: 'desc' },
      include: {
        cuenta: {
          include: {
            socio: true,
          },
        },
      },
    });

    // Obtener últimos socios registrados
    const nuevosSocios = await prisma.socio.findMany({
      take: limite,
      orderBy: { fecha_inscripcion: 'desc' },
      where: {
        fecha_inscripcion: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Última semana
        },
      },
    });

    // Combinar y formatear actividades
    const actividades: ActividadReciente[] = [];

    // Agregar movimientos de ahorro
    movimientosAhorro.forEach((mov) => {
      actividades.push({
        id: mov.id,
        tipo: 'ahorro',
        socio_id: mov.cuenta.socio_id,
        socio_nombre: mov.cuenta.socio.nombre,
        socio_apellido: mov.cuenta.socio.apellido,
        monto: Number(mov.monto_usd || mov.monto_bs || 0),
        moneda: Number(mov.monto_usd ?? 0) > 0 ? 'USD' : 'Bs',
        fecha: mov.fecha_movimiento,
        descripcion: `${mov.tipo_movimiento === 'deposito' ? 'Depósito' : 'Retiro'} en ahorro`,
      });
    });

    // Agregar nuevos socios
    nuevosSocios.forEach((socio) => {
      actividades.push({
        id: socio.id,
        tipo: 'socio',
        socio_id: socio.id,
        socio_nombre: socio.nombre,
        socio_apellido: socio.apellido,
        fecha: socio.fecha_inscripcion,
        descripcion: 'Nuevo socio registrado',
      });
    });

    // Ordenar por fecha descendente y limitar
    actividades.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    const actividadesLimitadas = actividades.slice(0, limite);

    res.json({
      success: true,
      data: actividadesLimitadas,
    });
  } catch (error) {
    logger.error('Error al obtener actividad reciente:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener actividad reciente',
      },
    });
  }
};

/**
 * GET /api/dashboard/indicadores?meses=12
 *
 * Series para el tablero. Todo sale de lo registrado, así que no puede
 * discrepar de los reportes.
 */
export const obtenerIndicadores = async (req: Request, res: Response): Promise<void> => {
  try {
    const meses = req.query.meses ? Number(req.query.meses) : undefined;
    const datos = await indicadores(prisma, { meses: Number.isFinite(meses) ? meses : undefined });
    res.json({ success: true, data: datos });
  } catch (error) {
    logger.error('Error al calcular los indicadores:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'No se pudieron calcular los indicadores' },
    });
  }
};
