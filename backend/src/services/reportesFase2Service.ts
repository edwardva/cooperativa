// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Reportes exportables (fase 2, Sprint E)
// ============================================
//
// RF-REP-01 a 08. Cada generador devuelve un `Reporte` (título, columnas,
// filas y totales) que la pantalla muestra y que se exporta a Excel o PDF sin
// volver a calcular nada. Las consultas son las mismas que usan las pantallas
// de cada módulo, así un total del reporte coincide con el de su pantalla.

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { BadRequestError } from '../middleware/errorHandler';
import { carteraPrestamos, VISTAS_CARTERA } from './carteraService';
import { conversionDePrestamos } from './conversionPrestamosService';
import { atrasoPorSocio, NIVELES_ATRASO, nivelDeAtraso } from './atrasoSociosService';
import { DIAS_PARA_RETIRAR_AHORRO, MOTIVO_RETIRO } from './morosidadService';
import { redondear } from './cobroSemanalService';
import { leerParametroNumerico } from './tarifasService';
import { deudoresDelAno } from './multasService';
import { feriasPendientesDelPeriodo, periodoDesdeParametros } from './saludFeriaService';
import { etiquetaFeria } from './trabajadoresService';
import { aOrdinal, formatearPeriodo, semanaActual, semanaDeFecha, semanasEnAno, type Periodo } from '../utils/calendarioSemanal';
import { coberturaDe } from './coberturaService';
import { fechaDia, hoyDia } from '../utils/fechaDia';
import { etiquetaPeriodo } from '../utils/periodoSalud';
import { adelantoDelRenglon, nombresEnMayusculas, type Reporte } from '../utils/reportes';

export const REPORTES = {
  'ferias-pendientes': 'Ferias pendientes de pago de salud',
  'pagos-salud': 'Pagos de salud por feria',
  'trabajadores-feria': 'Trabajadores por feria',
  'cartera-prestamos': 'Cartera de préstamos',
  'semanas-adelantadas': 'Semanas pagadas por adelantado',
  colectas: 'Colectas',
  'atraso-socios': 'Socios por semanas de atraso',
  'conversion-prestamos': 'Préstamos vigentes con el cálculo nuevo',
  'retiros-semana-41': 'Retiros por pasividad (semana 41)',
  'socios-suspendidos': 'Socios suspendidos',
  'saldos-ahorro': 'Saldos de ahorro',
  'inasistencia-asambleas': 'Inasistencia a asambleas',
  'corte-ano': 'Corte de año',
  'beneficiarios-retirados': 'Beneficiarios retirados',
} as const;

export type ClaveReporte = keyof typeof REPORTES;

/** Más filas que esto no es un reporte, es un volcado: se pide acotar */
const MAXIMO_FILAS = 20_000;

type Parametros = Record<string, string | undefined>;

const texto = (p: Parametros, clave: string): string => (p[clave] ?? '').trim();

/** Columnas DATE: se leen en UTC para no correr el día */
const diaBD = (d: Date | null): string => (d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : '');
/** Marcas de tiempo: en la hora local del servidor */
const diaLocal = (d: Date): string => d.toLocaleDateString('es-VE');

/** Rango de fechas en hora local. Por defecto, del primero del mes a hoy. */
const rangoLocal = (p: Parametros): { desde: Date; hasta: Date; texto: string } => {
  const hoy = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hoyTexto = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
  const desdeTexto = texto(p, 'desde') || `${hoyTexto.slice(0, 8)}01`;
  const hastaTexto = texto(p, 'hasta') || hoyTexto;
  fechaDia(desdeTexto, 'Desde');
  fechaDia(hastaTexto, 'Hasta');

  const desde = new Date(`${desdeTexto}T00:00:00`);
  const hasta = new Date(`${hastaTexto}T23:59:59.999`);
  if (desde > hasta) throw new BadRequestError('La fecha desde no puede ser posterior a la fecha hasta');
  const legible = (t: string) => t.split('-').reverse().join('/');
  return { desde, hasta, texto: `del ${legible(desdeTexto)} al ${legible(hastaTexto)}` };
};

const acotar = (cantidad: number): void => {
  if (cantidad > MAXIMO_FILAS) {
    throw new BadRequestError(
      `El reporte tendría ${cantidad.toLocaleString('es-VE')} filas. Acote las fechas o los filtros (máximo ${MAXIMO_FILAS.toLocaleString('es-VE')}).`
    );
  }
};

const insensible = Prisma.QueryMode.insensitive;

// ============================================
// RF-REP-03 / HU-19 · Ferias pendientes
// ============================================

const ESTADO_FERIA = {
  pagada: 'Pagada',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
  sin_trabajadores: 'Sin trabajadores',
} as const;

const feriasPendientes = async (p: Parametros): Promise<Reporte> => {
  const ref = await periodoDesdeParametros({ tipo: p.tipo, anio: p.anio, numero: p.numero });
  const r = await feriasPendientesDelPeriodo(prisma, ref);
  return {
    clave: 'ferias-pendientes',
    titulo: REPORTES['ferias-pendientes'],
    subtitulo: `${r.periodo.etiqueta} · $${r.tarifa_usd} por trabajador · tasa ${r.tasa}`,
    columnas: ['Feria', 'Responsable', 'Teléfono', 'Trabajadores', 'Pagados', 'Pendientes', 'Pendiente USD', 'Pendiente Bs', 'Estado'],
    filas: r.ferias.map((f) => [
      etiquetaFeria(f.feria),
      f.feria.responsable ?? '',
      f.feria.telefono ?? '',
      f.total,
      f.pagados,
      f.pendientes,
      f.monto_pendiente_usd,
      f.monto_pendiente_bs,
      ESTADO_FERIA[f.estado],
    ]),
    totales: [
      { etiqueta: 'Ferias con deuda', valor: r.totales.ferias_con_deuda },
      { etiqueta: 'Trabajadores pendientes', valor: r.totales.trabajadores_pendientes },
      { etiqueta: 'Monto pendiente USD', valor: r.totales.monto_pendiente_usd },
    ],
  };
};

// ============================================
// RF-REP-02 · Pagos de salud (un renglón por trabajador)
// ============================================

const pagosSalud = async (p: Parametros): Promise<Reporte> => {
  const where: Prisma.PagoSaludTrabajadorWhereInput = {};
  const filtros: string[] = [];

  if (texto(p, 'feria_id')) where.feria_id = Number(texto(p, 'feria_id'));
  if (texto(p, 'estado')) {
    if (p.estado !== 'vigente' && p.estado !== 'anulado') throw new BadRequestError('Estado inválido');
    where.estado = p.estado;
    filtros.push(p.estado === 'vigente' ? 'vigentes' : 'anulados');
  }
  if (texto(p, 'anio')) {
    const ref = await periodoDesdeParametros({ tipo: p.tipo, anio: p.anio, numero: p.numero || '1' });
    where.periodo = { anio: ref.anio, tipo: ref.tipo, ...(texto(p, 'numero') ? { numero: ref.numero } : {}) };
    filtros.push(texto(p, 'numero') ? etiquetaPeriodo(ref) : `año ${ref.anio}`);
  }
  if (texto(p, 'desde') || texto(p, 'hasta')) {
    const desde = texto(p, 'desde') ? fechaDia(texto(p, 'desde'), 'Desde') : undefined;
    const hasta = texto(p, 'hasta') ? fechaDia(texto(p, 'hasta'), 'Hasta') : undefined;
    where.pago = { fecha_pago: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } };
    filtros.push(`pagados ${desde ? `desde ${diaBD(desde)} ` : ''}${hasta ? `hasta ${diaBD(hasta)}` : ''}`.trim());
  }
  const trabajador = texto(p, 'trabajador');
  if (trabajador) {
    const digitos = trabajador.replace(/\D/g, '');
    where.trabajador = {
      OR: [
        { codigo_trabajador: { contains: trabajador, mode: insensible } },
        ...(digitos.length >= 3 ? [{ persona: { numero_identificacion: { contains: digitos } } }] : []),
        { persona: { apellidos: { contains: trabajador, mode: insensible } } },
      ],
    };
    filtros.push(`trabajador "${trabajador}"`);
  }

  acotar(await prisma.pagoSaludTrabajador.count({ where }));
  const renglones = await prisma.pagoSaludTrabajador.findMany({
    where,
    include: {
      pago: { select: { id: true, fecha_pago: true, referencia: true } },
      feria: { select: { codigo: true, nombre: true, direccion: true } },
      periodo: true,
      trabajador: {
        select: {
          codigo_trabajador: true,
          persona: { select: { tipo_identificacion: true, numero_identificacion: true, nombres: true, apellidos: true } },
        },
      },
    },
    orderBy: [{ pago: { fecha_pago: 'desc' } }, { pago_id: 'desc' }, { id: 'asc' }],
  });

  const vigentes = renglones.filter((r) => r.estado === 'vigente');
  const anulados = renglones.filter((r) => r.estado === 'anulado');
  const suma = (lista: typeof renglones) => redondear(lista.reduce((s, r) => s + Number(r.monto_usd), 0));

  return {
    clave: 'pagos-salud',
    titulo: REPORTES['pagos-salud'],
    subtitulo: filtros.length ? filtros.join(' · ') : 'Todos los pagos',
    columnas: ['Fecha de pago', 'Pago #', 'Feria', 'Período', 'Código', 'Trabajador', 'Identificación', 'Monto USD', 'Estado', 'Referencia'],
    filas: renglones.map((r) => [
      diaBD(r.pago.fecha_pago),
      r.pago.id,
      etiquetaFeria(r.feria),
      etiquetaPeriodo(r.periodo),
      r.trabajador.codigo_trabajador,
      `${r.trabajador.persona.apellidos}, ${r.trabajador.persona.nombres}`,
      `${r.trabajador.persona.tipo_identificacion}-${r.trabajador.persona.numero_identificacion}`,
      Number(r.monto_usd),
      r.estado === 'vigente' ? 'Pagado' : 'Anulado',
      r.pago.referencia ?? '',
    ]),
    totales: [
      { etiqueta: 'Trabajadores pagados', valor: vigentes.length },
      { etiqueta: 'Pagos distintos', valor: new Set(vigentes.map((r) => r.pago.id)).size },
      { etiqueta: 'Monto vigente USD', valor: suma(vigentes) },
      { etiqueta: 'Renglones anulados', valor: anulados.length },
      { etiqueta: 'Monto anulado USD', valor: suma(anulados) },
    ],
  };
};

// ============================================
// RF-REP-01 · Trabajadores por feria
// ============================================

const trabajadoresFeria = async (p: Parametros): Promise<Reporte> => {
  const feriaId = texto(p, 'feria_id') ? Number(texto(p, 'feria_id')) : null;

  const [ferias, abiertas, retirados] = await Promise.all([
    prisma.ubicacion.findMany({
      where: feriaId ? { id: feriaId } : { tipo: 'feria' },
      orderBy: { codigo: 'asc' },
      select: { id: true, codigo: true, nombre: true, direccion: true, responsable: true, estado: true },
    }),
    // Feria actual de los que siguen asociados
    prisma.trabajadorFeria.findMany({
      where: { fecha_fin: null },
      select: { feria_id: true, trabajador: { select: { estado: true } } },
    }),
    // Los retirados cuentan en la última feria donde estuvieron
    prisma.socioTrabajador.findMany({
      where: { estado: 'retirado' },
      select: { ferias: { orderBy: { fecha_inicio: 'desc' }, take: 1, select: { feria_id: true } } },
    }),
  ]);

  const cuenta = new Map<number, { activo: number; suspendido: number; inactivo: number; retirado: number }>();
  const de = (id: number) => {
    if (!cuenta.has(id)) cuenta.set(id, { activo: 0, suspendido: 0, inactivo: 0, retirado: 0 });
    return cuenta.get(id)!;
  };
  for (const a of abiertas) {
    const estado = a.trabajador.estado;
    if (estado === 'activo' || estado === 'suspendido' || estado === 'inactivo') de(a.feria_id)[estado]++;
  }
  for (const r of retirados) {
    const ultima = r.ferias[0];
    if (ultima) de(ultima.feria_id).retirado++;
  }

  const filas = ferias
    .map((f) => ({ f, c: cuenta.get(f.id) ?? { activo: 0, suspendido: 0, inactivo: 0, retirado: 0 } }))
    .filter(({ f, c }) => f.estado || c.activo + c.suspendido + c.inactivo + c.retirado > 0);
  const total = (k: 'activo' | 'suspendido' | 'inactivo' | 'retirado') => filas.reduce((s, { c }) => s + c[k], 0);

  return {
    clave: 'trabajadores-feria',
    titulo: REPORTES['trabajadores-feria'],
    subtitulo: 'Salud asignada: trabajadores activos con la feria como feria actual',
    columnas: ['Feria', 'Responsable', 'Activos', 'Suspendidos', 'Inactivos', 'Retirados', 'Con salud asignada', 'Estado de la feria'],
    filas: filas.map(({ f, c }) => [
      etiquetaFeria(f),
      f.responsable ?? '',
      c.activo,
      c.suspendido,
      c.inactivo,
      c.retirado,
      c.activo,
      f.estado ? 'Activa' : 'Inactiva',
    ]),
    totales: [
      { etiqueta: 'Trabajadores activos', valor: total('activo') },
      { etiqueta: 'Suspendidos e inactivos', valor: total('suspendido') + total('inactivo') },
      { etiqueta: 'Retirados', valor: total('retirado') },
    ],
  };
};

// ============================================
// RF-REP-06 · Cartera de préstamos
// ============================================

const carteraPrestamosReporte = async (p: Parametros): Promise<Reporte> => {
  const r = await carteraPrestamos(texto(p, 'vista') || 'por_cobrar');
  return {
    clave: 'cartera-prestamos',
    titulo: REPORTES['cartera-prestamos'],
    subtitulo: VISTAS_CARTERA[r.vista],
    columnas: ['Préstamo', 'Expediente', 'Socio', 'Cédula', 'Tipo', 'Otorgado USD', 'Deuda USD', 'Mora USD', 'Cuotas pagadas', 'Cuotas vencidas', 'Estado', 'Desembolso'],
    filas: r.filas.map((f) => [
      f.numero_prestamo,
      f.codigo_socio,
      f.socio,
      f.cedula,
      f.tipo,
      f.monto_original_usd,
      f.deuda_total_usd,
      f.saldo_mora_usd,
      `${f.cuotas_pagadas} de ${f.cuotas_totales}`,
      f.cuotas_vencidas,
      f.estado,
      diaBD(f.fecha_desembolso),
    ]),
    totales: [
      { etiqueta: 'Préstamos', valor: r.resumen.cantidad },
      { etiqueta: 'Otorgado USD', valor: r.resumen.otorgado_usd },
      { etiqueta: 'Saldo por cobrar USD', valor: r.resumen.por_cobrar_usd },
      { etiqueta: 'Mora USD', valor: r.resumen.mora_usd },
      { etiqueta: 'Cuotas pendientes', valor: r.resumen.cuotas_pendientes },
    ],
  };
};

// ============================================
// RF-REP-05 · Semanas adelantadas
// ============================================

const filtroSocio = (valor: string): Prisma.SocioWhereInput => ({
  OR: [
    { codigo_socio: valor },
    { cedula: { contains: valor.replace(/\D/g, '') || valor } },
    { apellido: { contains: valor, mode: insensible } },
  ],
});

const semanasAdelantadas = async (p: Parametros): Promise<Reporte> => {
  const rango = rangoLocal(p);
  const socio = texto(p, 'socio');

  const where: Prisma.DetalleColectaWhereInput = {
    servicio: { in: ['funeraria', 'salud'] },
    es_reintegro: false,
    semanas: { gt: 0 },
    cobertura_ano_antes: { not: null },
    cobertura_ano_despues: { not: null },
    colecta: {
      reversada: false,
      fecha_colecta: { gte: rango.desde, lte: rango.hasta },
      ...(socio ? { socio: filtroSocio(socio) } : {}),
    },
  };
  acotar(await prisma.detalleColecta.count({ where }));

  const detalles = await prisma.detalleColecta.findMany({
    where,
    include: {
      colecta: {
        select: {
          id: true,
          fecha_colecta: true,
          socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true } },
        },
      },
    },
    orderBy: [{ colecta: { fecha_colecta: 'desc' } }, { id: 'asc' }],
  });

  const filas = detalles.flatMap((d) => {
    const adelanto = adelantoDelRenglon(
      semanaDeFecha(d.colecta.fecha_colecta),
      { ano: d.cobertura_ano_antes!, semana: d.cobertura_semana_antes! },
      { ano: d.cobertura_ano_despues!, semana: d.cobertura_semana_despues! }
    );
    if (!adelanto) return [];
    return [{ d, adelanto }];
  });

  return {
    clave: 'semanas-adelantadas',
    titulo: REPORTES['semanas-adelantadas'],
    subtitulo: `Cobros ${rango.texto}${socio ? ` · socio "${socio}"` : ''}`,
    columnas: ['Fecha', 'Colecta #', 'Expediente', 'Socio', 'Servicio', 'Semana inicial', 'Semana final', 'Semanas pagadas', 'Adelantadas', 'Monto USD'],
    filas: filas.map(({ d, adelanto }) => [
      diaLocal(d.colecta.fecha_colecta),
      d.colecta.id,
      d.colecta.socio.codigo_socio,
      `${d.colecta.socio.apellido}, ${d.colecta.socio.nombre}`,
      d.servicio === 'salud' ? 'Salud' : 'Funeraria',
      formatearPeriodo(adelanto.desde),
      formatearPeriodo(adelanto.hasta),
      d.semanas ?? 0,
      adelanto.adelantadas,
      Number(d.monto_usd),
    ]),
    totales: [
      { etiqueta: 'Renglones con adelanto', valor: filas.length },
      { etiqueta: 'Socios', valor: new Set(filas.map(({ d }) => d.colecta.socio.codigo_socio)).size },
      { etiqueta: 'Semanas adelantadas', valor: filas.reduce((s, { adelanto }) => s + adelanto.adelantadas, 0) },
      { etiqueta: 'Monto USD', valor: redondear(filas.reduce((s, { d }) => s + Number(d.monto_usd), 0)) },
    ],
  };
};

// ============================================
// RF-REP-04 · Colectas
// ============================================

const colectas = async (p: Parametros): Promise<Reporte> => {
  const rango = rangoLocal(p);
  const socio = texto(p, 'socio');
  const where: Prisma.ColectaWhereInput = { fecha_colecta: { gte: rango.desde, lte: rango.hasta } };
  const filtros = [rango.texto];

  if (socio) {
    where.socio = filtroSocio(socio);
    filtros.push(`socio "${socio}"`);
  }
  if (texto(p, 'anio') && texto(p, 'semana')) {
    where.ano_cobro = Number(texto(p, 'anio'));
    where.semana_cobro = Number(texto(p, 'semana'));
    filtros.push(`semana cobrada ${formatearPeriodo({ ano: where.ano_cobro, semana: where.semana_cobro })}`);
  }
  if (texto(p, 'estado') === 'vigentes') where.reversada = false;
  if (texto(p, 'estado') === 'reversadas') where.reversada = true;

  acotar(await prisma.colecta.count({ where }));
  const lista = await prisma.colecta.findMany({
    where,
    include: {
      socio: { select: { codigo_socio: true, nombre: true, apellido: true } },
      usuario: { select: { username: true } },
    },
    orderBy: { fecha_colecta: 'desc' },
  });

  const vigentes = lista.filter((c) => !c.reversada);
  const reversadas = lista.filter((c) => c.reversada);
  const suma = (l: typeof lista, campo: 'monto_total_usd' | 'monto_total_bs') => redondear(l.reduce((s, c) => s + Number(c[campo]), 0));

  return {
    clave: 'colectas',
    titulo: REPORTES.colectas,
    subtitulo: filtros.join(' · '),
    columnas: ['Fecha', 'Colecta #', 'Expediente', 'Socio', 'Semana cobrada', 'Semanas', 'Total USD', 'Total Bs', 'Cajero', 'Estado'],
    filas: lista.map((c) => [
      diaLocal(c.fecha_colecta),
      c.id,
      c.socio.codigo_socio,
      `${c.socio.apellido}, ${c.socio.nombre}`,
      c.ano_cobro && c.semana_cobro ? formatearPeriodo({ ano: c.ano_cobro, semana: c.semana_cobro }) : '',
      c.semanas_cobradas,
      Number(c.monto_total_usd),
      Number(c.monto_total_bs),
      c.usuario.username,
      c.reversada ? `Reversada: ${c.motivo_reverso ?? ''}` : 'Vigente',
    ]),
    totales: [
      { etiqueta: 'Colectas vigentes', valor: vigentes.length },
      { etiqueta: 'Total vigente USD', valor: suma(vigentes, 'monto_total_usd') },
      { etiqueta: 'Total vigente Bs', valor: suma(vigentes, 'monto_total_bs') },
      { etiqueta: 'Colectas reversadas', valor: reversadas.length },
      { etiqueta: 'Monto reversado USD', valor: suma(reversadas, 'monto_total_usd') },
    ],
  };
};

// ============================================
// Socios por semanas de atraso (morosidad, Sprint F)
// ============================================
//
// Reglas confirmadas por la cooperativa: el atraso se cuenta sin pagar NADA de
// la colecta, porque salud y funeraria van juntas. Al caer en la semana 6 hay
// 3 días de suspensión; en la 11, un mes en funeraria y 7 días en salud; en la
// 41 el socio lo pierde todo. Hoy revisan la lista a mano antes de retirar a
// nadie: este reporte es esa lista y no cambia ningún estado.

const atrasoSocios = async (p: Parametros): Promise<Reporte> => {
  const nivel = texto(p, 'nivel') || '41';
  const rango =
    nivel === 'todos'
      ? { desde: 6, hasta: Infinity, texto: 'Todos con 6 semanas de atraso o más' }
      : NIVELES_ATRASO.find((n) => n.clave === nivel);
  if (!rango) throw new BadRequestError('Nivel de atraso inválido');
  const feriaId = texto(p, 'feria_id');
  const actual = semanaActual();

  const candidatos = (await atrasoPorSocio(prisma, actual))
    .filter((c) => c.semanas_atraso >= rango.desde && c.semanas_atraso <= rango.hasta)
    .map((c) => ({ socioId: c.socio_id, cobertura: c.cobertura, servicios: c.servicios, suspendido: c.suspendido, atraso: c.semanas_atraso }));
  acotar(candidatos.length);

  const socios = candidatos.length
    ? await prisma.socio.findMany({
        where: {
          id: { in: candidatos.map((c) => c.socioId) },
          estado: 'activo',
          ...(feriaId ? { ubicacion_id: Number(feriaId) } : {}),
        },
        select: {
          id: true,
          codigo_socio: true,
          nombre: true,
          apellido: true,
          cedula: true,
          telefono: true,
          ubicacion: { select: { codigo: true, nombre: true, direccion: true } },
        },
      })
    : [];
  const datos = new Map(socios.map((s) => [s.id, s]));
  const filas = candidatos
    .flatMap((c) => {
      const socio = datos.get(c.socioId);
      return socio ? [{ ...c, socio }] : [];
    })
    .sort((a, b) => b.atraso - a.atraso || a.socio.codigo_socio.localeCompare(b.socio.codigo_socio, 'es', { numeric: true }));

  const cuantos = (clave: string) => filas.filter((f) => nivelDeAtraso(f.atraso)?.clave === clave).length;

  return {
    clave: 'atraso-socios',
    titulo: REPORTES['atraso-socios'],
    subtitulo: `${rango.texto} · semana en curso ${formatearPeriodo(actual)}${feriaId ? ' · una feria' : ''}`,
    columnas: ['Expediente', 'Socio', 'Cédula', 'Teléfono', 'Feria', 'Cubierto hasta', 'Semanas de atraso', 'Situación', 'Servicios'],
    filas: filas.map((f) => [
      f.socio.codigo_socio,
      `${f.socio.apellido}, ${f.socio.nombre}`,
      f.socio.cedula,
      f.socio.telefono ?? '',
      f.socio.ubicacion ? etiquetaFeria(f.socio.ubicacion) : '',
      formatearPeriodo(f.cobertura),
      f.atraso,
      nivelDeAtraso(f.atraso)?.texto ?? '',
      `${f.servicios.join(' y ')}${f.suspendido ? ' (con suspensión registrada)' : ''}`,
    ]),
    totales: [
      { etiqueta: 'Socios', valor: filas.length },
      ...(nivel === 'todos'
        ? [
            { etiqueta: '41 semanas o más', valor: cuantos('41') },
            { etiqueta: 'Próximos (36 a 40)', valor: cuantos('36') },
            { etiqueta: '11 a 35', valor: cuantos('11') },
            { etiqueta: '6 a 10', valor: cuantos('6') },
          ]
        : []),
    ],
  };
};

// Conversión de los préstamos vigentes (Sprint C)
// ============================================
//
// La cooperativa pidió pasar los préstamos que ya están dados al cálculo nuevo.
// Eso cambia saldos, así que esto es la lista para revisar ANTES de convertir:
// el reporte no cambia ningún préstamo.

const conversionPrestamos = async (): Promise<Reporte> => {
  const r = await conversionDePrestamos(prisma);
  acotar(r.filas.length);
  return {
    clave: 'conversion-prestamos',
    titulo: REPORTES['conversion-prestamos'],
    subtitulo:
      `Comparación al ${diaBD(r.hasta)} · ${r.totales.prestamos} préstamo(s) con el cálculo anterior · ` +
      'informativo: no cambia nada',
    columnas: [
      'Préstamo', 'Expediente', 'Socio', 'Tipo', 'Otorgado USD', 'Desembolso', 'Abonado USD',
      'Deuda hoy USD', 'Deuda con el cálculo nuevo USD', 'Diferencia USD', 'Cuotas hoy', 'Cuotas nuevas', 'Observación',
    ],
    filas: r.filas.map((f) => [
      f.numero_prestamo,
      f.codigo_socio,
      f.socio,
      f.tipo,
      f.monto_original_usd,
      diaBD(f.fecha_desembolso),
      f.abonado_usd,
      f.deuda_actual_usd,
      f.deuda_nueva_usd,
      f.diferencia_usd,
      f.cuotas_actuales,
      f.cuotas_nuevas ?? 'fuera de la tabla',
      f.observacion,
    ]),
    totales: [
      { etiqueta: 'Préstamos', valor: r.totales.prestamos },
      { etiqueta: 'Deuda hoy USD', valor: r.totales.deuda_actual_usd },
      { etiqueta: 'Deuda con el cálculo nuevo USD', valor: r.totales.deuda_nueva_usd },
      { etiqueta: 'Diferencia USD', valor: r.totales.diferencia_usd },
      { etiqueta: 'Quedan debiendo menos', valor: r.totales.bajan },
      { etiqueta: 'Quedan debiendo más', valor: r.totales.suben },
    ],
  };
};

// Retiros por pasividad: soporte para archivar (Sprint F)
// ============================================
//
// Confirmado: en la semana 41 el sistema retira solo al socio, pero la
// cooperativa quiere un reporte de esos retiros para archivar como soporte. Sale
// del historial de estados, que guarda cada retiro con su fecha y motivo.

const retirosSemana41 = async (p: Parametros): Promise<Reporte> => {
  const rango = rangoLocal(p);
  const historial = await prisma.historialEstadoSocio.findMany({
    where: {
      estado_nuevo: 'retirado',
      motivo: { startsWith: MOTIVO_RETIRO },
      fecha: { gte: rango.desde, lte: rango.hasta },
    },
    include: {
      socio: {
        select: {
          id: true, codigo_socio: true, nombre: true, apellido: true, cedula: true, telefono: true,
          ubicacion: { select: { codigo: true, nombre: true, direccion: true } },
          cuentas_ahorro: { select: { saldo_usd: true } },
          prestamos: { where: { estado: { in: ['solicitado', 'aprobado', 'activo', 'moroso'] } }, select: { numero_prestamo: true } },
        },
      },
    },
    orderBy: { fecha: 'asc' },
  });
  acotar(historial.length);

  const filas = historial.map((h) => {
    const ahorro = redondear(h.socio.cuentas_ahorro.reduce((a, c) => a + Number(c.saldo_usd), 0));
    const limite = new Date(h.fecha.getTime() + DIAS_PARA_RETIRAR_AHORRO * 86_400_000);
    const prestamos = h.socio.prestamos.map((x) => x.numero_prestamo);
    return {
      fecha: h.fecha,
      socio: h.socio,
      semanas: h.semanas_atraso,
      ahorro,
      limite,
      prestamos,
    };
  });

  return {
    clave: 'retiros-semana-41',
    titulo: REPORTES['retiros-semana-41'],
    subtitulo: `${rango.texto} · motivo: ${MOTIVO_RETIRO}`,
    columnas: [
      'Fecha de retiro', 'Expediente', 'Socio', 'Cédula', 'Teléfono', 'Feria', 'Semanas sin pagar',
      'Ahorro USD', 'Puede retirar su ahorro hasta', 'Préstamos abiertos',
    ],
    filas: filas.map((f) => [
      diaLocal(f.fecha),
      f.socio.codigo_socio,
      `${f.socio.apellido}, ${f.socio.nombre}`,
      f.socio.cedula,
      f.socio.telefono ?? '',
      f.socio.ubicacion ? etiquetaFeria(f.socio.ubicacion) : '',
      f.semanas ?? '',
      f.ahorro,
      f.ahorro > 0 ? diaLocal(f.limite) : '',
      f.prestamos.length ? `${f.prestamos.join(', ')}: llevar a la reunión de delegados` : '',
    ]),
    totales: [
      { etiqueta: 'Socios retirados', valor: filas.length },
      { etiqueta: 'Ahorro por devolver USD', valor: redondear(filas.reduce((a, f) => a + f.ahorro, 0)) },
      { etiqueta: 'Con préstamo abierto', valor: filas.filter((f) => f.prestamos.length > 0).length },
    ],
  };
};

// ============================================

/**
 * Socios suspendidos hoy: desde cuándo, hasta cuándo y por qué. Es la lista
 * para la oficina, que hasta ahora sólo veía la suspensión servicio por
 * servicio (RF-REP-07).
 */
const sociosSuspendidos = async (p: Parametros): Promise<Reporte> => {
  const feriaId = Number(texto(p, 'feria_id')) || undefined;
  const hoy = hoyDia();

  const socios = await prisma.socio.findMany({
    where: { estado: 'suspendido', ...(feriaId ? { ubicacion_id: feriaId } : {}) },
    select: {
      id: true, codigo_socio: true, nombre: true, apellido: true, cedula: true, telefono: true,
      suspendido_desde: true, suspendido_hasta: true,
      ubicacion: { select: { codigo: true, nombre: true } },
    },
    orderBy: [{ suspendido_desde: 'asc' }, { codigo_socio: 'asc' }],
  });
  acotar(socios.length);

  // El último movimiento de cada uno dice por qué quedó suspendido
  const historial = socios.length
    ? await prisma.historialEstadoSocio.findMany({
        where: { socio_id: { in: socios.map((s) => s.id) }, estado_nuevo: 'suspendido' },
        orderBy: { fecha: 'desc' },
        select: { socio_id: true, motivo: true, semanas_atraso: true, origen: true },
      })
    : [];
  const ultimo = new Map<number, (typeof historial)[number]>();
  for (const h of historial) if (!ultimo.has(h.socio_id)) ultimo.set(h.socio_id, h);

  const dias = (desde: Date | null) =>
    desde ? Math.max(0, Math.round((hoy.getTime() - desde.getTime()) / 86_400_000)) : '';
  const cumplidos = socios.filter((s) => s.suspendido_hasta !== null && s.suspendido_hasta <= hoy).length;

  return {
    clave: 'socios-suspendidos',
    titulo: REPORTES['socios-suspendidos'],
    subtitulo: `Al ${diaLocal(hoy)}${feriaId ? ' · una feria' : ''}`,
    columnas: [
      'Expediente', 'Socio', 'Cédula', 'Teléfono', 'Feria', 'Suspendido desde', 'Hasta',
      'Días suspendido', 'Semanas sin pagar', 'Motivo', 'Origen',
    ],
    filas: socios.map((s) => {
      const h = ultimo.get(s.id);
      return [
        s.codigo_socio,
        `${s.apellido}, ${s.nombre}`,
        s.cedula,
        s.telefono ?? '',
        s.ubicacion ? etiquetaFeria(s.ubicacion) : '',
        diaBD(s.suspendido_desde),
        s.suspendido_hasta ? diaBD(s.suspendido_hasta) : 'sin fecha',
        dias(s.suspendido_desde),
        h?.semanas_atraso ?? '',
        h?.motivo ?? '',
        h?.origen === 'manual' ? 'a mano' : 'automático',
      ];
    }),
    totales: [
      { etiqueta: 'Socios suspendidos', valor: socios.length },
      { etiqueta: 'Ya cumplieron sus días y siguen sin pagar', valor: cumplidos },
    ],
  };
};

// ============================================
// Saldos de ahorro (Ahorro → "Saldos Ahorros" del sistema anterior)
// ============================================
//
// El sistema anterior lista, por tipo de cuenta, cada cuenta no retirada con
// su saldo guardado en Bs y en USD y un total al pie. Incluye las de saldo 0 y
// las negativas. Aquí se agrega el filtro por sector o feria, ocultar saldo 0
// y el orden por número de cuenta, que el anterior no tenía.

const saldosAhorro = async (p: Parametros): Promise<Reporte> => {
  const codigoTipo = texto(p, 'tipo_cuenta');
  const feriaId = Number(texto(p, 'feria_id')) || undefined;
  const sinCeros = texto(p, 'sin_ceros') === 'si';

  // Saldo a una fecha pasada (confirmado el 23/10 como mejora). Se reconstruye
  // hacia atrás desde el saldo de hoy, deshaciendo los movimientos posteriores
  // al corte: así sirve aunque una cuenta migrada no traiga su historial viejo.
  const corteTexto = texto(p, 'fecha_corte');
  if (corteTexto) fechaDia(corteTexto, 'Fecha de corte');
  const finCorte = corteTexto ? new Date(`${corteTexto}T23:59:59.999`) : null;
  if (finCorte && finCorte > new Date()) throw new BadRequestError('La fecha de corte no puede ser futura');

  const tipo = codigoTipo
    ? await prisma.tipoCuentaAhorro.findFirst({ where: { codigo: codigoTipo }, select: { id: true, codigo: true, nombre: true } })
    : null;
  if (codigoTipo && !tipo) throw new BadRequestError(`No existe el tipo de cuenta ${codigoTipo}`);

  const where: Prisma.CuentaAhorroWhereInput = {
    estado: true,
    ...(tipo ? { tipo_cuenta_id: tipo.id } : {}),
    ...(feriaId ? { socio: { ubicacion_id: feriaId } } : {}),
    // Una cuenta abierta después del corte no existía en esa fecha
    // (fecha_apertura es columna DATE: se compara en UTC para no correr el día)
    ...(corteTexto ? { fecha_apertura: { lte: new Date(`${corteTexto}T00:00:00.000Z`) } } : {}),
    ...(sinCeros && !finCorte ? { NOT: { saldo_bs: 0, saldo_usd: 0 } } : {}),
  };
  acotar(await prisma.cuentaAhorro.count({ where }));

  const cuentas = await prisma.cuentaAhorro.findMany({
    where,
    select: {
      id: true,
      numero_cuenta: true,
      saldo_bs: true,
      saldo_usd: true,
      monto_bloqueado_usd: true,
      tipo_cuenta: { select: { codigo: true, nombre: true } },
      socio: {
        select: {
          codigo_socio: true,
          cedula: true,
          nombre: true,
          apellido: true,
          ubicacion: { select: { codigo: true, nombre: true, direccion: true } },
        },
      },
    },
    orderBy: { numero_cuenta: 'asc' },
  });

  // Lo que se movió después del corte, por cuenta: depósitos suman, retiros restan
  const posterior = new Map<number, { usd: number; bs: number }>();
  if (finCorte && cuentas.length > 0) {
    const movidos = await prisma.movimientoAhorro.groupBy({
      by: ['cuenta_id', 'tipo_movimiento'],
      where: { cuenta_id: { in: cuentas.map((c) => c.id) }, fecha_movimiento: { gt: finCorte } },
      _sum: { monto_usd: true, monto_bs: true },
    });
    for (const m of movidos) {
      const signo = m.tipo_movimiento === 'retiro' ? -1 : 1;
      const a = posterior.get(m.cuenta_id) ?? { usd: 0, bs: 0 };
      a.usd += signo * Number(m._sum.monto_usd ?? 0);
      a.bs += signo * Number(m._sum.monto_bs ?? 0);
      posterior.set(m.cuenta_id, a);
    }
  }

  const saldos = cuentas
    .map((c) => {
      const mov = posterior.get(c.id) ?? { usd: 0, bs: 0 };
      return { c, usd: redondear(Number(c.saldo_usd) - mov.usd), bs: redondear(Number(c.saldo_bs) - mov.bs) };
    })
    .filter((x) => !(sinCeros && finCorte && x.usd === 0 && x.bs === 0));

  const totalBs = redondear(saldos.reduce((t, x) => t + x.bs, 0));
  const totalUsd = redondear(saldos.reduce((t, x) => t + x.usd, 0));
  const negativas = saldos.filter((x) => x.bs < 0 || x.usd < 0).length;
  const ubicacion = feriaId
    ? await prisma.ubicacion.findUnique({ where: { id: feriaId }, select: { codigo: true, nombre: true, direccion: true } })
    : null;

  return {
    clave: 'saldos-ahorro',
    titulo: REPORTES['saldos-ahorro'],
    subtitulo:
      `${tipo ? `${tipo.codigo} ${tipo.nombre}` : 'Todos los tipos de cuenta'}` +
      `${ubicacion ? ` · ${etiquetaFeria(ubicacion)}` : ''}` +
      ` · Saldos al ${corteTexto ? corteTexto.split('-').reverse().join('/') : diaLocal(new Date())}`,
    columnas: [
      'N° cuenta', 'Apellidos y nombres', 'Cédula', 'Expediente', 'Tipo', 'Sector o feria',
      'Saldo Bs', 'Saldo USD', ...(finCorte ? [] : ['Bloqueado USD']),
    ],
    filas: saldos.map(({ c, usd, bs }) => [
      c.numero_cuenta,
      `${c.socio.apellido}, ${c.socio.nombre}`,
      c.socio.cedula,
      c.socio.codigo_socio,
      c.tipo_cuenta.codigo,
      c.socio.ubicacion ? etiquetaFeria(c.socio.ubicacion) : '',
      bs,
      usd,
      // El bloqueo por fianza no tiene historial: sólo se muestra el de hoy
      ...(finCorte ? [] : [Number(c.monto_bloqueado_usd)]),
    ]),
    totales: [
      { etiqueta: 'Cuentas', valor: saldos.length },
      { etiqueta: 'Total saldo Bs', valor: totalBs },
      { etiqueta: 'Total saldo USD', valor: totalUsd },
      { etiqueta: 'Cuentas con saldo negativo', valor: negativas },
    ],
  };
};

// ============================================
// Inasistencia a asambleas (pedido del 15/10)
// ============================================
//
// La asamblea sectorial se hace en 3 a 5 fechas al año (desde marzo), para que
// cada socio vaya al menos a una. Haber ido a cualquiera cuenta como asistencia
// del año.
//   - Un año sin ir a ninguna: paga la multa (MULTA_INASISTENCIA_ASAMBLEA_USD).
//   - Dos años seguidos sin ir: la oficina puede retirarlo por pasividad. No
//     es automático; el reporte sólo dice quiénes son.
// Un año sin asambleas cargadas no cuenta como falta: nadie pudo asistir.

const inasistenciaAsambleas = async (p: Parametros): Promise<Reporte> => {
  const ano = Number(texto(p, 'anio')) || new Date().getFullYear();
  const dosAnos = texto(p, 'modo') === 'dos_anos';
  const feriaId = Number(texto(p, 'feria_id')) || undefined;
  const anos = dosAnos ? [ano - 1, ano] : [ano];

  const conAsambleas = await prisma.asamblea.groupBy({
    by: ['ano'],
    where: { ano: { in: anos }, estado: true },
    _count: true,
  });
  const sinCargar = anos.filter((a) => !conAsambleas.some((c) => c.ano === a));
  if (sinCargar.length > 0) {
    throw new BadRequestError(
      `No hay asambleas cargadas en ${sinCargar.join(' ni ')}: no se puede saber quién faltó.`
    );
  }

  const multa = await leerParametroNumerico('MULTA_INASISTENCIA_ASAMBLEA_USD');

  const where: Prisma.SocioWhereInput = {
    estado: { in: ['activo', 'suspendido'] },
    // Quien se inscribió después de la última asamblea del primer año no tuvo
    // ocasión de ir; queda fuera
    fecha_inscripcion: {
      lte: (await prisma.asamblea.findFirst({
        where: { ano: anos[0], estado: true },
        orderBy: { fecha: 'desc' },
        select: { fecha: true },
      }))!.fecha,
    },
    ...(feriaId ? { ubicacion_id: feriaId } : {}),
    AND: anos.map((a) => ({ asistencias_asamblea: { none: { asistio: true, asamblea: { ano: a, estado: true } } } })),
  };
  acotar(await prisma.socio.count({ where }));

  // La multa sigue la misma regla que el módulo Multas: sólo después de la
  // última asamblea del año, sin los que ya la pagaron y sin los que faltaron
  // también el año anterior (a esos les toca el retiro, no otra multa)
  const deudores = dosAnos ? null : new Set((await deudoresDelAno(prisma, ano, { feriaId })).map((d) => d.id));

  const socios = (
    await prisma.socio.findMany({
      where,
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        codigo_socio: true,
        cedula: true,
        nombre: true,
        apellido: true,
        telefono: true,
        estado: true,
        fecha_inscripcion: true,
        ubicacion: { select: { codigo: true, nombre: true, direccion: true } },
      },
    })
  ).filter((s) => !deudores || deudores.has(s.id));

  return {
    clave: 'inasistencia-asambleas',
    titulo: dosAnos
      ? `Sin asistir a asambleas en ${ano - 1} ni ${ano}: candidatos a retiro`
      : `Sin asistir a asambleas en ${ano}: multa`,
    subtitulo: dosAnos
      ? 'Dos años seguidos sin ir a ninguna asamblea. La oficina decide el retiro (motivo Pasividad); no es automático.'
      : multa > 0
        ? `Multa vigente: $${multa}`
        : 'La multa no está configurada (Parámetros → MULTA_INASISTENCIA_ASAMBLEA_USD)',
    columnas: dosAnos
      ? ['Expediente', 'Socio', 'Cédula', 'Teléfono', 'Sector o feria', 'Estado', 'Inscrito']
      : ['Expediente', 'Socio', 'Cédula', 'Teléfono', 'Sector o feria', 'Estado', 'Inscrito', 'Multa USD'],
    filas: socios.map((s) => {
      const fila: (string | number)[] = [
        s.codigo_socio,
        `${s.apellido}, ${s.nombre}`,
        s.cedula,
        s.telefono ?? '',
        s.ubicacion ? etiquetaFeria(s.ubicacion) : '',
        s.estado,
        diaBD(s.fecha_inscripcion),
      ];
      if (!dosAnos) fila.push(multa);
      return fila;
    }),
    totales: dosAnos
      ? [{ etiqueta: 'Socios', valor: socios.length }]
      : [
          { etiqueta: 'Socios', valor: socios.length },
          { etiqueta: 'Total multas USD', valor: redondear(socios.length * multa) },
        ],
  };
};

// ============================================
// Corte de año (propuesta P1, aceptada el 23/10)
// ============================================
//
// Lo cobrado en el año por servicio (colectas no reversadas y multas pagadas)
// y cómo quedan los socios frente al fin de ese año, según la cobertura de sus
// acuerdos de funeraria y salud. La cobertura que se usa es la de HOY: para un
// año ya cerrado dice cómo están ahora, no cómo estaban el 31/12.

const NOMBRE_SERVICIO_CORTE: Record<string, string> = {
  ahorro: 'Ahorro',
  funeraria: 'Funeraria',
  salud: 'Salud',
  prestamo: 'Préstamos',
};

const corteAno = async (p: Parametros): Promise<Reporte> => {
  const ano = Number(texto(p, 'anio')) || new Date().getFullYear();
  if (ano < 2000 || ano > 2100) throw new BadRequestError('Año inválido');
  const desde = new Date(ano, 0, 1);
  const hasta = new Date(ano, 11, 31, 23, 59, 59, 999);

  // --- Lo cobrado ---
  const [porServicio, operaciones, multas] = await Promise.all([
    prisma.detalleColecta.groupBy({
      by: ['servicio'],
      where: { colecta: { reversada: false, fecha_colecta: { gte: desde, lte: hasta } } },
      _sum: { monto_usd: true, monto_bs: true },
      _count: true,
    }),
    prisma.colecta.aggregate({
      where: { reversada: false, fecha_colecta: { gte: desde, lte: hasta } },
      _count: true,
      _sum: { monto_total_usd: true, monto_total_bs: true },
    }),
    prisma.multaAsamblea.aggregate({
      where: { estado: 'pagada', fecha_pago: { gte: desde, lte: hasta } },
      _count: true,
      _sum: { monto_usd: true, monto_bs: true },
    }),
  ]);

  const filas: (string | number)[][] = ['ahorro', 'funeraria', 'salud', 'prestamo'].map((servicio) => {
    const g = porServicio.find((x) => x.servicio === servicio);
    return [
      NOMBRE_SERVICIO_CORTE[servicio]!,
      g?._count ?? 0,
      redondear(Number(g?._sum.monto_bs ?? 0)),
      redondear(Number(g?._sum.monto_usd ?? 0)),
    ];
  });
  filas.push(['Multas por inasistencia', multas._count, redondear(Number(multas._sum.monto_bs ?? 0)), redondear(Number(multas._sum.monto_usd ?? 0))]);
  const totalBs = redondear(Number(operaciones._sum.monto_total_bs ?? 0) + Number(multas._sum.monto_bs ?? 0));
  const totalUsd = redondear(Number(operaciones._sum.monto_total_usd ?? 0) + Number(multas._sum.monto_usd ?? 0));

  // --- Cómo quedan los socios frente al fin de año ---
  // Por socio manda su acuerdo MENOS cubierto: es el que decide si está al día
  const finDeAno: Periodo = { ano, semana: semanasEnAno(ano) };
  const actual = semanaActual();
  const seleccion = {
    ano_pagado_hasta: true,
    semana_pagada_hasta: true,
    fecha_ultimo_pago: true,
    semanas_sin_pago: true,
    fecha_inicio: true,
    estado: true,
    beneficiario: { select: { socio_id: true } },
  } as const;
  const vigentes = { estado: { in: ['activo', 'suspendido'] as ('activo' | 'suspendido')[] }, beneficiario: { socio: { estado: { in: ['activo', 'suspendido'] as ('activo' | 'suspendido')[] } } } };
  const [funerarias, saludes] = await Promise.all([
    prisma.acuerdoFuneraria.findMany({ where: vigentes, select: seleccion }),
    prisma.acuerdoSalud.findMany({ where: vigentes, select: seleccion }),
  ]);
  const menorPorSocio = new Map<number, number>();
  for (const a of [...funerarias, ...saludes]) {
    const cobertura = coberturaDe(a, actual);
    if (!cobertura) continue;
    const ordinal = aOrdinal(cobertura);
    const previo = menorPorSocio.get(a.beneficiario.socio_id);
    if (previo === undefined || ordinal < previo) menorPorSocio.set(a.beneficiario.socio_id, ordinal);
  }
  const ordinales = [...menorPorSocio.values()];
  const ordFin = aOrdinal(finDeAno);
  const ordHoy = aOrdinal(actual);
  const cubiertosAlCierre = ordinales.filter((o) => o >= ordFin).length;
  const adelantadosSiguiente = ordinales.filter((o) => o > ordFin).length;
  const alDiaHoy = ordinales.filter((o) => o >= ordHoy).length;
  const atrasadosHoy = ordinales.length - alDiaHoy;

  return {
    clave: 'corte-ano',
    titulo: `Corte del año ${ano}`,
    subtitulo:
      `Cobrado del 01/01/${ano} al 31/12/${ano} (colectas no reversadas y multas pagadas). ` +
      `Situación de los socios con funeraria o salud, según su cobertura al ${diaLocal(new Date())}.`,
    columnas: ['Servicio', 'Operaciones', 'Cobrado Bs', 'Cobrado USD'],
    filas,
    totales: [
      { etiqueta: 'Colectas del año', valor: operaciones._count },
      { etiqueta: 'Total cobrado Bs', valor: totalBs },
      { etiqueta: 'Total cobrado USD', valor: totalUsd },
      { etiqueta: 'Socios con funeraria o salud', valor: ordinales.length },
      { etiqueta: `Cubiertos hasta el fin de ${ano} (${formatearPeriodo(finDeAno)})`, valor: cubiertosAlCierre },
      { etiqueta: `Adelantados a ${ano + 1}`, valor: adelantadosSiguiente },
      { etiqueta: `Al día hoy (${formatearPeriodo(actual)})`, valor: alDiaHoy },
      { etiqueta: 'Atrasados hoy', valor: atrasadosHoy },
    ],
  };
};

// ============================================
// Beneficiarios retirados (propuesta P2, sugerida el 23/10)
// ============================================
//
// La ficha del socio muestra los beneficiarios activos y suspendidos; los
// retirados van aquí, por servicio, con fecha y motivo del retiro.

const beneficiariosRetirados = async (p: Parametros): Promise<Reporte> => {
  const servicio = texto(p, 'servicio');
  const feriaId = Number(texto(p, 'feria_id')) || undefined;
  const desdeTexto = texto(p, 'desde');
  const hastaTexto = texto(p, 'hasta');
  if (desdeTexto) fechaDia(desdeTexto, 'Desde');
  if (hastaTexto) fechaDia(hastaTexto, 'Hasta');
  // fecha_retiro es columna DATE: se compara en UTC para no correr el día
  const fecha = {
    ...(desdeTexto ? { gte: new Date(`${desdeTexto}T00:00:00.000Z`) } : {}),
    ...(hastaTexto ? { lte: new Date(`${hastaTexto}T00:00:00.000Z`) } : {}),
  };
  const where = {
    estado: 'retirado' as const,
    ...(desdeTexto || hastaTexto ? { fecha_retiro: fecha } : {}),
    ...(feriaId ? { beneficiario: { socio: { ubicacion_id: feriaId } } } : {}),
  };
  const seleccion = {
    numero_acuerdo: true,
    fecha_retiro: true,
    motivo_retiro: true,
    beneficiario: {
      select: {
        cedula: true,
        nombre: true,
        apellido: true,
        parentesco: true,
        socio: {
          select: {
            codigo_socio: true,
            nombre: true,
            apellido: true,
            ubicacion: { select: { codigo: true, nombre: true, direccion: true } },
          },
        },
      },
    },
  } as const;

  const incluirFuneraria = servicio !== 'salud';
  const incluirSalud = servicio !== 'funeraria';
  const [nF, nS] = await Promise.all([
    incluirFuneraria ? prisma.acuerdoFuneraria.count({ where }) : 0,
    incluirSalud ? prisma.acuerdoSalud.count({ where }) : 0,
  ]);
  acotar(nF + nS);
  const [funerarias, saludes] = await Promise.all([
    incluirFuneraria ? prisma.acuerdoFuneraria.findMany({ where, select: seleccion, orderBy: { fecha_retiro: 'desc' } }) : [],
    incluirSalud ? prisma.acuerdoSalud.findMany({ where, select: seleccion, orderBy: { fecha_retiro: 'desc' } }) : [],
  ]);

  const fila = (nombreServicio: string) => (a: (typeof funerarias)[number]) => [
    nombreServicio,
    a.beneficiario.socio.codigo_socio,
    `${a.beneficiario.socio.apellido}, ${a.beneficiario.socio.nombre}`,
    a.beneficiario.socio.ubicacion ? etiquetaFeria(a.beneficiario.socio.ubicacion) : '',
    `${a.beneficiario.apellido}, ${a.beneficiario.nombre}`,
    a.beneficiario.cedula,
    a.beneficiario.parentesco,
    a.numero_acuerdo ?? '',
    diaBD(a.fecha_retiro),
    a.motivo_retiro ?? '',
  ];

  return {
    clave: 'beneficiarios-retirados',
    titulo: REPORTES['beneficiarios-retirados'],
    subtitulo:
      `${servicio === 'funeraria' ? 'Funeraria' : servicio === 'salud' ? 'Salud' : 'Funeraria y salud'}` +
      `${desdeTexto || hastaTexto ? ` · retirados ${desdeTexto ? `desde ${desdeTexto.split('-').reverse().join('/')}` : ''}${hastaTexto ? ` hasta ${hastaTexto.split('-').reverse().join('/')}` : ''}` : ''}`,
    columnas: [
      'Servicio', 'Expediente', 'Socio', 'Sector o feria', 'Beneficiario', 'Cédula', 'Parentesco',
      'N° acuerdo', 'Fecha retiro', 'Motivo',
    ],
    filas: [...funerarias.map(fila('Funeraria')), ...saludes.map(fila('Salud'))],
    totales: [
      { etiqueta: 'Retirados de funeraria', valor: funerarias.length },
      { etiqueta: 'Retirados de salud', valor: saludes.length },
    ],
  };
};

// ============================================

const GENERADORES: Record<ClaveReporte, (p: Parametros) => Promise<Reporte>> = {
  'ferias-pendientes': feriasPendientes,
  'pagos-salud': pagosSalud,
  'trabajadores-feria': trabajadoresFeria,
  'cartera-prestamos': carteraPrestamosReporte,
  'semanas-adelantadas': semanasAdelantadas,
  colectas,
  'atraso-socios': atrasoSocios,
  'conversion-prestamos': conversionPrestamos,
  'retiros-semana-41': retirosSemana41,
  'socios-suspendidos': sociosSuspendidos,
  'saldos-ahorro': saldosAhorro,
  'inasistencia-asambleas': inasistenciaAsambleas,
  'corte-ano': corteAno,
  'beneficiarios-retirados': beneficiariosRetirados,
};

export const esClaveReporte = (clave: string): clave is ClaveReporte => clave in GENERADORES;

export const generarReporte = (clave: ClaveReporte, parametros: Parametros): Promise<Reporte> =>
  GENERADORES[clave](parametros).then(nombresEnMayusculas);
