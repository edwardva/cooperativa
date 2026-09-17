// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Cartera de préstamos
// ============================================
//
// Reemplaza los cuatro listados del sistema viejo (Por Cobrar, Cobrados,
// Morosos, Emitidos) con una sola consulta filtrada por vista. La usan la
// pantalla de préstamos y el reporte exportable (RF-REP-06), así los dos
// muestran las mismas cifras.

import { PrismaClient, type Prisma } from '@prisma/client';
import { redondear } from './cobroSemanalService';

const prisma = new PrismaClient();

export const VISTAS_CARTERA = {
  // Los que esperan la reunión de los martes para entregarse
  solicitudes: 'En solicitud',
  por_cobrar: 'Por cobrar',
  morosos: 'Morosos (vencidos)',
  cobrados: 'Cobrados',
  emitidos: 'Todos los emitidos',
} as const;

export type VistaCartera = keyof typeof VISTAS_CARTERA;

const FILTROS: Record<VistaCartera, Prisma.PrestamoWhereInput> = {
  solicitudes: { estado: { in: ['solicitado', 'aprobado'] } },
  por_cobrar: { estado: { in: ['activo', 'moroso'] } },
  morosos: { estado: 'moroso' },
  cobrados: { estado: 'saldado' },
  emitidos: {},
};

export const carteraPrestamos = async (vistaPedida: string) => {
  const vista: VistaCartera = vistaPedida in FILTROS ? (vistaPedida as VistaCartera) : 'por_cobrar';

  const prestamos = await prisma.prestamo.findMany({
    where: FILTROS[vista],
    orderBy: { fecha_desembolso: 'desc' },
    include: {
      socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true, telefono: true } },
      tipo_prestamo: { select: { codigo: true, nombre: true } },
      plan_pagos: { select: { estado: true } },
    },
  });

  const filas = prestamos.map((p) => {
    const vencidas = p.plan_pagos.filter((c) => c.estado === 'vencida').length;
    const pagadas = p.plan_pagos.filter((c) => c.estado === 'pagada').length;
    return {
      id: p.id,
      numero_prestamo: p.numero_prestamo,
      codigo_socio: p.socio.codigo_socio,
      cedula: p.socio.cedula,
      socio: `${p.socio.apellido}, ${p.socio.nombre}`,
      telefono: p.socio.telefono,
      tipo: p.tipo_prestamo.nombre,
      monto_original_usd: Number(p.monto_original_usd),
      saldo_capital_usd: Number(p.saldo_capital_usd),
      saldo_interes_usd: Number(p.saldo_interes_usd),
      saldo_mora_usd: Number(p.saldo_mora_usd),
      deuda_total_usd: redondear(
        Number(p.saldo_capital_usd) + Number(p.saldo_interes_usd) + Number(p.saldo_mora_usd)
      ),
      cuotas_pagadas: pagadas,
      cuotas_vencidas: vencidas,
      cuotas_totales: p.plan_pagos.length,
      estado: p.estado,
      fecha_desembolso: p.fecha_desembolso,
      fecha_vencimiento: p.fecha_vencimiento,
    };
  });

  return {
    vista,
    filas,
    resumen: {
      cantidad: filas.length,
      otorgado_usd: redondear(filas.reduce((a, f) => a + f.monto_original_usd, 0)),
      por_cobrar_usd: redondear(filas.reduce((a, f) => a + f.deuda_total_usd, 0)),
      mora_usd: redondear(filas.reduce((a, f) => a + f.saldo_mora_usd, 0)),
      cuotas_pendientes: filas.reduce((a, f) => a + (f.cuotas_totales - f.cuotas_pagadas), 0),
    },
  };
};
