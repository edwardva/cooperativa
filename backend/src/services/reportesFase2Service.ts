// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Reportes exportables (fase 2, Sprint E)
// ============================================
//
// RF-REP-01 a 08. Cada generador devuelve un `Reporte` (título, columnas,
// filas y totales) que la pantalla muestra y que se exporta a Excel o PDF sin
// volver a calcular nada. Las consultas son las mismas que usan las pantallas
// de cada módulo, así un total del reporte coincide con el de su pantalla.

import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError } from '../middleware/errorHandler';
import { carteraPrestamos, VISTAS_CARTERA } from './carteraService';
import { conversionDePrestamos } from './conversionPrestamosService';
import { atrasoPorSocio, NIVELES_ATRASO, nivelDeAtraso } from './atrasoSociosService';
import { DIAS_PARA_RETIRAR_AHORRO, MOTIVO_RETIRO } from './morosidadService';
import { redondear } from './cobroSemanalService';
import { feriasPendientesDelPeriodo, periodoDesdeParametros } from './saludFeriaService';
import { etiquetaFeria } from './trabajadoresService';
import { formatearPeriodo, semanaActual, semanaDeFecha } from '../utils/calendarioSemanal';
import { fechaDia } from '../utils/fechaDia';
import { etiquetaPeriodo } from '../utils/periodoSalud';
import { adelantoDelRenglon, type Reporte } from '../utils/reportes';

const prisma = new PrismaClient();

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
      where: feriaId ? { id: feriaId } : {},
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
};

export const esClaveReporte = (clave: string): clave is ClaveReporte => clave in GENERADORES;

export const generarReporte = (clave: ClaveReporte, parametros: Parametros): Promise<Reporte> =>
  GENERADORES[clave](parametros);
