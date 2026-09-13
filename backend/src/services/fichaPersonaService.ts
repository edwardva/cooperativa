// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Ficha integral de la persona (HU-20)
// ============================================
//
// Todo lo de una persona en una consulta, con cada expediente POR SEPARADO:
// lo que hizo como trabajador (feria, salud pagada por la feria) no se mezcla
// con lo que hizo como ahorrista (cuentas, servicios, colectas, préstamos).
//
// La situación de cada servicio sale de la misma cobertura (año, semana) que
// usa la colecta: la ficha y la caja no pueden decir cosas distintas.

import { PrismaClient } from '@prisma/client';
import { calcularSituacion, type SituacionServicio } from './coberturaService';
import { redondear } from './cobroSemanalService';
import { obtenerTarifas } from './tarifasService';
import { formatearTrabajador, includeFerias, mesesDePrueba } from './trabajadoresService';
import { aOrdinal, formatearPeriodo, semanaActual } from '../utils/calendarioSemanal';
import { etiquetaPeriodo } from '../utils/periodoSalud';

const prisma = new PrismaClient();

const selectAcuerdo = {
  id: true,
  numero_acuerdo: true,
  estado: true,
  ano_pagado_hasta: true,
  semana_pagada_hasta: true,
  fecha_ultimo_pago: true,
  semanas_sin_pago: true,
  fecha_inicio: true,
  fecha_suspension: true,
  fecha_retiro: true,
  motivo_retiro: true,
  tipo_acuerdo: { select: { nombre: true } },
} as const;

const cargar = (personaId: number) =>
  prisma.persona.findUnique({
    where: { id: personaId },
    include: {
      trabajadores: {
        orderBy: { fecha_ingreso: 'desc' },
        include: {
          ferias: includeFerias,
          pagos_salud: {
            orderBy: { id: 'desc' },
            take: 24,
            include: {
              periodo: true,
              feria: { select: { codigo: true, nombre: true } },
              pago: { select: { id: true, fecha_pago: true, referencia: true } },
            },
          },
        },
      },
      // select y no include: la foto del socio es un BLOB que la ficha no usa
      socios: {
        orderBy: { fecha_inscripcion: 'desc' },
        select: {
          id: true,
          codigo_socio: true,
          estado: true,
          fecha_inscripcion: true,
          es_delegado: true,
          ubicacion: { select: { codigo: true, nombre: true } },
          cuentas_ahorro: {
            select: {
              id: true,
              numero_cuenta: true,
              saldo_usd: true,
              saldo_bs: true,
              monto_bloqueado_usd: true,
              estado: true,
              tipo_cuenta: { select: { codigo: true, nombre: true } },
            },
          },
          beneficiarios: {
            select: {
              nombre: true,
              apellido: true,
              parentesco: true,
              acuerdos_funeraria: { select: selectAcuerdo },
              acuerdos_salud: { select: selectAcuerdo },
            },
          },
          prestamos: {
            orderBy: { fecha_desembolso: 'desc' },
            include: { tipo_prestamo: { select: { nombre: true } }, plan_pagos: { select: { estado: true } } },
          },
          colectas: {
            orderBy: { fecha_colecta: 'desc' },
            take: 10,
            select: {
              id: true,
              fecha_colecta: true,
              monto_total_usd: true,
              semanas_cobradas: true,
              reversada: true,
              motivo_reverso: true,
            },
          },
        },
      },
    },
  });

type PersonaCargada = NonNullable<Awaited<ReturnType<typeof cargar>>>;
type AcuerdoCargado = PersonaCargada['socios'][number]['beneficiarios'][number]['acuerdos_salud'][number];

interface ServicioFicha {
  servicio: 'funeraria' | 'salud';
  acuerdo_id: number;
  plan: string;
  numero_acuerdo: string | null;
  beneficiario: string;
  parentesco: string;
  estado: string;
  estado_calculado: SituacionServicio['estado_calculado'];
  pagado_hasta: string;
  cobertura: SituacionServicio['cobertura'];
  semanas_pendientes: number;
  semanas_adelantadas: number;
  fecha_ultimo_pago: Date | null;
  fecha_suspension: Date | null;
  fecha_retiro: Date | null;
  motivo_retiro: string | null;
}

export const fichaPersona = async (personaId: number) => {
  const [persona, tarifas, meses] = await Promise.all([cargar(personaId), obtenerTarifas(), mesesDePrueba()]);
  if (!persona) return null;
  const actual = semanaActual();

  const servicio = (
    tipo: 'funeraria' | 'salud',
    a: AcuerdoCargado,
    b: { nombre: string; apellido: string; parentesco: string }
  ): ServicioFicha => {
    const umbral = tipo === 'funeraria' ? tarifas.semanas_suspension_funeraria : tarifas.semanas_suspension_salud;
    const s = calcularSituacion(a, umbral, actual);
    return {
      servicio: tipo,
      acuerdo_id: a.id,
      plan: a.tipo_acuerdo.nombre,
      numero_acuerdo: a.numero_acuerdo,
      beneficiario: `${b.nombre} ${b.apellido}`,
      parentesco: b.parentesco,
      estado: a.estado,
      estado_calculado: s.estado_calculado,
      pagado_hasta: formatearPeriodo(s.cobertura),
      cobertura: s.cobertura,
      semanas_pendientes: s.semanas_pendientes,
      semanas_adelantadas: s.semanas_adelantadas,
      fecha_ultimo_pago: s.fecha_ultimo_pago,
      fecha_suspension: a.fecha_suspension,
      fecha_retiro: a.fecha_retiro,
      motivo_retiro: a.motivo_retiro,
    };
  };

  const ahorristas = persona.socios.map((s) => {
    const servicios = s.beneficiarios.flatMap((b) => [
      ...b.acuerdos_funeraria.map((a) => servicio('funeraria', a, b)),
      ...b.acuerdos_salud.map((a) => servicio('salud', a, b)),
    ]);

    // Semanas del expediente: manda el servicio más atrasado, igual que en caja
    const vigentes = servicios.filter((x) => x.estado !== 'retirado' && x.cobertura);
    const masAtrasado = vigentes.reduce<ServicioFicha | null>(
      (m, x) => (!m || aOrdinal(x.cobertura!) < aOrdinal(m.cobertura!) ? x : m),
      null
    );

    const prestamos = s.prestamos.map((p) => {
      const pagadas = p.plan_pagos.filter((c) => c.estado === 'pagada').length;
      return {
        id: p.id,
        numero_prestamo: p.numero_prestamo,
        tipo: p.tipo_prestamo.nombre,
        estado: p.estado,
        moneda: p.moneda,
        monto_original_usd: Number(p.monto_original_usd),
        deuda_total_usd: redondear(Number(p.saldo_capital_usd) + Number(p.saldo_interes_usd) + Number(p.saldo_mora_usd)),
        saldo_mora_usd: Number(p.saldo_mora_usd),
        cuota_semanal_usd: Number(p.cuota_semanal_usd),
        cuotas_totales: p.plan_pagos.length,
        cuotas_pagadas: pagadas,
        cuotas_pendientes: p.plan_pagos.length - pagadas,
        cuotas_vencidas: p.plan_pagos.filter((c) => c.estado === 'vencida').length,
        fecha_desembolso: p.fecha_desembolso,
        fecha_vencimiento: p.fecha_vencimiento,
        fecha_ultimo_abono: p.fecha_ultimo_abono,
      };
    });
    const actuales = prestamos.filter((p) => p.estado === 'activo' || p.estado === 'moroso');

    return {
      socio: {
        id: s.id,
        codigo_socio: s.codigo_socio,
        estado: s.estado,
        fecha_inscripcion: s.fecha_inscripcion,
        es_delegado: s.es_delegado,
        ubicacion: s.ubicacion,
      },
      cuentas: s.cuentas_ahorro.map((c) => ({
        id: c.id,
        numero_cuenta: c.numero_cuenta,
        tipo: c.tipo_cuenta.nombre,
        estado: c.estado,
        saldo_usd: Number(c.saldo_usd),
        saldo_bs: Number(c.saldo_bs),
        bloqueado_usd: Number(c.monto_bloqueado_usd),
        disponible_usd: redondear(Number(c.saldo_usd) - Number(c.monto_bloqueado_usd)),
      })),
      saldo_ahorro_usd: redondear(s.cuentas_ahorro.reduce((t, c) => t + Number(c.saldo_usd), 0)),
      servicios,
      semanas: masAtrasado
        ? {
            ultima_semana_pagada: masAtrasado.pagado_hasta,
            semanas_pendientes: Math.max(...vigentes.map((x) => x.semanas_pendientes)),
            semanas_adelantadas: Math.min(...vigentes.map((x) => x.semanas_adelantadas)),
            semana_actual: formatearPeriodo(actual),
          }
        : null,
      prestamos: {
        actuales,
        anteriores: prestamos.filter((p) => !actuales.includes(p)),
        saldo_total_usd: redondear(actuales.reduce((t, p) => t + p.deuda_total_usd, 0)),
        cuotas_pagadas: actuales.reduce((t, p) => t + p.cuotas_pagadas, 0),
        cuotas_pendientes: actuales.reduce((t, p) => t + p.cuotas_pendientes, 0),
      },
      colectas_recientes: s.colectas.map((c) => ({ ...c, monto_total_usd: Number(c.monto_total_usd) })),
    };
  });

  const trabajadores = persona.trabajadores.map((t) => {
    const { pagos_salud, ...resto } = t;
    return {
      ...formatearTrabajador(resto, meses),
      pagos_salud: pagos_salud.map((p) => ({
        id: p.id,
        periodo: etiquetaPeriodo(p.periodo),
        feria: p.feria,
        monto_usd: Number(p.monto_usd),
        estado: p.estado,
        pago: p.pago,
      })),
    };
  });

  // Hoy las suspensiones son por servicio; la del socio llega con el Sprint F
  const suspensiones = ahorristas.flatMap((a) =>
    a.servicios
      .filter((x) => x.fecha_suspension || x.estado === 'suspendido' || x.fecha_retiro)
      .map((x) => ({
        expediente: a.socio.codigo_socio,
        servicio: x.servicio,
        plan: x.plan,
        beneficiario: x.beneficiario,
        estado: x.estado,
        fecha_suspension: x.fecha_suspension,
        fecha_retiro: x.fecha_retiro,
        motivo_retiro: x.motivo_retiro,
      }))
  );

  const registros = [
    { modulo: 'personas', ids: [persona.id] },
    { modulo: 'socios', ids: persona.socios.map((s) => s.id) },
    { modulo: 'trabajadores', ids: persona.trabajadores.map((t) => t.id) },
    { modulo: 'prestamos', ids: persona.socios.flatMap((s) => s.prestamos.map((p) => p.id)) },
  ].filter((r) => r.ids.length > 0);

  const historial = await prisma.auditLog.findMany({
    where: { OR: registros.map((r) => ({ modulo: r.modulo, registro_id: { in: r.ids } })) },
    orderBy: { created_at: 'desc' },
    take: 50,
    select: {
      id: true,
      accion: true,
      modulo: true,
      registro_id: true,
      created_at: true,
      usuario: { select: { nombre_completo: true, username: true } },
    },
  });

  const { trabajadores: _t, socios: _s, ...datosPersona } = persona;
  return { persona: datosPersona, trabajadores, ahorristas, suspensiones, historial };
};
