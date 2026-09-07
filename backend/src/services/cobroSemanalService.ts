// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Paquete semanal de la colecta
// ============================================
//
// Requisitos 1 y 2 de la reunión.
//
// La regla que el cliente repitió: la colecta semanal es UN paquete. El cajero
// escribe cuántas semanas paga el socio y el sistema calcula el importe de todo
// lo que tiene contratado más el ahorro obligatorio:
//
//   - con funeraria y salud  ->  ahorro + funeraria + salud
//   - con un solo servicio   ->  ahorro + ese servicio
//
//   "No permitir seleccionar únicamente uno de los servicios contratados para
//    pagar esa semana."
//
// Las tarifas NO se editan aquí: vienen de parámetros y llegan a la pantalla
// como sólo lectura. Lo único que el cajero decide es la cantidad de semanas.

import { aplicarPago, calcularSituacion, type SituacionServicio } from './coberturaService';
import type { TarifasColecta } from './tarifasService';
import { type Periodo, formatearPeriodo, rangoDeSemana } from '../utils/calendarioSemanal';

/** Redondeo a céntimos, el mismo criterio en todo el módulo de colecta. */
export const redondear = (valor: number): number => Math.round(valor * 100) / 100;

export type ServicioColecta = 'ahorro' | 'funeraria' | 'salud';

/** Un acuerdo cobrable, ya resuelto desde la base. */
export interface AcuerdoCobrable {
  servicio: 'funeraria' | 'salud';
  referencia_id: number;
  titulo: string;
  detalle: string;
  numero_acuerdo: string | null;
  /** Tarifa propia del plan; si es 0 se usa la tarifa general del parámetro */
  monto_plan_usd: number;
  situacion: SituacionServicio;
}

/** Un renglón del paquete: qué se cobra, por cuántas semanas y a qué tarifa. */
export interface RenglonPaquete {
  servicio: ServicioColecta;
  referencia_id: number;
  titulo: string;
  semanas: number;
  tarifa_unitaria_usd: number;
  monto_usd: number;
  monto_bs: number;
  /** Cobertura del acuerdo antes y después de este renglón */
  cobertura_antes: Periodo | null;
  cobertura_despues: Periodo | null;
}

export interface PaqueteSemanal {
  semanas: number;
  tasa: number;
  renglones: RenglonPaquete[];
  totales: {
    ahorro_usd: number;
    funeraria_usd: number;
    salud_usd: number;
    total_usd: number;
    ahorro_bs: number;
    funeraria_bs: number;
    salud_bs: number;
    total_bs: number;
  };
  /** Cosas que el cajero debe ver pero que no impiden cobrar */
  advertencias: string[];
}

/**
 * Tarifa semanal que aplica a un acuerdo.
 *
 * Manda la tarifa GENERAL del parámetro. La cooperativa cobra una sola cuota
 * por servicio y la multiplica por la cantidad de acuerdos del socio — es lo
 * que hace el sistema actual, donde la pantalla tiene un único campo por
 * servicio (`bs_fun`, `bs_sal`) multiplicado por `nu_fun` / `nu_sal`.
 *
 * El `monto_usd` del tipo de acuerdo queda como respaldo, por si el parámetro
 * llegara vacío o en cero. Antes tenía precedencia, y eso cobraba de más: el
 * catálogo trae valores de relleno (USD 5,00 en funeraria) frente a los USD
 * 0,75 que cobra la cooperativa de verdad.
 */
export function tarifaDeAcuerdo(acuerdo: AcuerdoCobrable, tarifas: TarifasColecta): number {
  const general = acuerdo.servicio === 'funeraria' ? tarifas.funeraria_usd : tarifas.salud_usd;
  if (general > 0) return general;
  return acuerdo.monto_plan_usd;
}

/**
 * Semanas que se sugieren cobrar para dejar al socio al día.
 *
 * Es el mayor atraso entre sus servicios: pagar menos dejaría alguno atrasado y
 * pagar esa cantidad los pone a todos al corriente.
 */
export function semanasParaPonerseAlDia(acuerdos: AcuerdoCobrable[]): number {
  return Math.max(0, ...acuerdos.map((a) => a.situacion.semanas_pendientes));
}

/**
 * Arma el paquete de cobro.
 *
 * `semanas` es el driver único: multiplica por igual el ahorro y cada servicio
 * contratado. No se calcula un subtotal por semana adeudada — el cliente pidió
 * expresamente un resumen por servicio, no una fila por semana.
 */
export function armarPaquete(opciones: {
  semanas: number;
  acuerdos: AcuerdoCobrable[];
  tarifas: TarifasColecta;
  tasa: number;
  /** Cuenta que recibe el ahorro obligatorio; sin ella no se cobra ahorro */
  cuentaAhorroId: number | null;
  /** Ahorro voluntario que el socio agrega en el mismo cobro */
  ahorroAdicionalUsd?: number;
}): PaqueteSemanal {
  const { semanas, acuerdos, tarifas, tasa, cuentaAhorroId } = opciones;
  const ahorroAdicional = redondear(Math.max(0, opciones.ahorroAdicionalUsd ?? 0));

  const renglones: RenglonPaquete[] = [];
  const advertencias: string[] = [];

  // --- Ahorro obligatorio: va siempre que el socio tenga cuenta ---
  const ahorroObligatorio = redondear(tarifas.ahorro_usd * semanas);
  const montoAhorro = redondear(ahorroObligatorio + ahorroAdicional);

  if (cuentaAhorroId === null) {
    if (ahorroObligatorio > 0) {
      advertencias.push(
        'El socio no tiene cuenta de ahorro activa: no se cobra el ahorro obligatorio'
      );
    }
  } else if (montoAhorro > 0) {
    renglones.push({
      servicio: 'ahorro',
      referencia_id: cuentaAhorroId,
      titulo: ahorroAdicional > 0 ? 'Ahorro obligatorio + adicional' : 'Ahorro obligatorio',
      semanas,
      tarifa_unitaria_usd: tarifas.ahorro_usd,
      monto_usd: montoAhorro,
      monto_bs: redondear(montoAhorro * tasa),
      cobertura_antes: null,
      cobertura_despues: null,
    });
  }

  // --- Servicios contratados: todos, no una selección ---
  for (const acuerdo of acuerdos) {
    const tarifa = tarifaDeAcuerdo(acuerdo, tarifas);
    const monto = redondear(tarifa * semanas);
    const antes = acuerdo.situacion.cobertura;

    renglones.push({
      servicio: acuerdo.servicio,
      referencia_id: acuerdo.referencia_id,
      titulo: acuerdo.titulo,
      semanas,
      tarifa_unitaria_usd: tarifa,
      monto_usd: monto,
      monto_bs: redondear(monto * tasa),
      cobertura_antes: antes,
      // Adonde queda la cobertura si se cobra este renglon. El cruce de anio
      // sale solo: es una suma sobre el calendario, no sobre el numero de semana.
      cobertura_despues: antes ? aplicarPago(antes, semanas) : null,
    });
  }

  // --- Advertencia de adelanto ---
  // El cliente describe una política de hasta 10 semanas que aplica el
  // personal. Se advierte; bloquear o no está pendiente de confirmación y se
  // decide con el parámetro BLOQUEAR_ADELANTO_EXCEDIDO.
  const pendientes = semanasParaPonerseAlDia(acuerdos);
  const adelantadas = Math.max(0, semanas - pendientes);
  if (adelantadas > tarifas.max_semanas_adelanto) {
    advertencias.push(
      `Se están adelantando ${adelantadas} semanas y la política admite ` +
        `${tarifas.max_semanas_adelanto} (${pendientes} pendiente(s) + ` +
        `${tarifas.max_semanas_adelanto} adelantadas = ` +
        `${pendientes + tarifas.max_semanas_adelanto} semanas)`
    );
  }

  const sumar = (servicio: ServicioColecta, campo: 'monto_usd' | 'monto_bs'): number =>
    redondear(renglones.filter((r) => r.servicio === servicio).reduce((a, r) => a + r[campo], 0));

  const totalUsd = redondear(renglones.reduce((a, r) => a + r.monto_usd, 0));

  return {
    semanas,
    tasa,
    renglones,
    totales: {
      ahorro_usd: sumar('ahorro', 'monto_usd'),
      funeraria_usd: sumar('funeraria', 'monto_usd'),
      salud_usd: sumar('salud', 'monto_usd'),
      total_usd: totalUsd,
      ahorro_bs: sumar('ahorro', 'monto_bs'),
      funeraria_bs: sumar('funeraria', 'monto_bs'),
      salud_bs: sumar('salud', 'monto_bs'),
      total_bs: redondear(totalUsd * tasa),
    },
    advertencias,
  };
}

// ============================================
// INTEGRIDAD DEL PAQUETE
// ============================================

export interface ProblemaIntegridad {
  codigo: 'SERVICIO_FALTANTE' | 'ADELANTO_EXCEDIDO' | 'SEMANAS_DISPARES';
  mensaje: string;
}

/**
 * Comprueba que lo que llega a cobrarse sea un paquete completo.
 *
 * Es una validación de BACKEND a propósito: la pantalla ya no deja armar un
 * cobro parcial, pero la regla es del negocio y no puede depender de que el
 * cliente HTTP se porte bien.
 */
export function validarIntegridadDelPaquete(opciones: {
  /** Acuerdos vigentes del socio */
  acuerdosDelSocio: AcuerdoCobrable[];
  /** Renglones de servicio que llegaron a cobrar, sin contar reintegros */
  cobrados: { servicio: 'funeraria' | 'salud'; referencia_id: number; semanas: number }[];
  tarifas: TarifasColecta;
  semanasSolicitadas: number;
}): ProblemaIntegridad[] {
  const { acuerdosDelSocio, cobrados, tarifas, semanasSolicitadas } = opciones;
  const problemas: ProblemaIntegridad[] = [];

  // Si no se cobra ningún servicio, no hay paquete que validar: puede ser un
  // depósito de ahorro suelto o un abono a préstamo, que son voluntarios.
  if (cobrados.length === 0) return problemas;

  const cobradosIds = new Set(cobrados.map((c) => `${c.servicio}-${c.referencia_id}`));

  // Un acuerdo suspendido puede quedar fuera: reactivarlo es otra decisión
  const exigibles = acuerdosDelSocio.filter((a) => a.situacion.estado_registrado === 'activo');

  const faltantes = exigibles.filter((a) => !cobradosIds.has(`${a.servicio}-${a.referencia_id}`));
  if (faltantes.length > 0) {
    const nombres = faltantes.map((f) => `${f.servicio} (${f.detalle})`).join(', ');
    problemas.push({
      codigo: 'SERVICIO_FALTANTE',
      mensaje:
        `El socio tiene contratado ${nombres} y no se está cobrando. ` +
        'Los servicios contratados se pagan juntos en la colecta semanal.',
    });
  }

  // Todos los renglones de servicio cubren las mismas semanas
  const dispares = cobrados.filter((c) => c.semanas !== semanasSolicitadas);
  if (dispares.length > 0) {
    problemas.push({
      codigo: 'SEMANAS_DISPARES',
      mensaje: `Todos los servicios deben cubrir las mismas ${semanasSolicitadas} semana(s) del cobro`,
    });
  }

  // Adelanto por encima de la política: sólo bloquea si está configurado así
  if (tarifas.bloquear_adelanto_excedido) {
    const pendientes = semanasParaPonerseAlDia(acuerdosDelSocio);
    const adelantadas = Math.max(0, semanasSolicitadas - pendientes);
    if (adelantadas > tarifas.max_semanas_adelanto) {
      problemas.push({
        codigo: 'ADELANTO_EXCEDIDO',
        mensaje:
          `No se pueden adelantar ${adelantadas} semanas: la política admite ` +
          `${tarifas.max_semanas_adelanto}`,
      });
    }
  }

  return problemas;
}

/**
 * Resumen por servicio para la cabecera del socio.
 *
 * "Mostrar un resumen por servicio, aunque existan varias semanas pendientes.
 *  No es necesario generar una fila por cada semana adeudada."
 */
export function resumirServicio(acuerdo: AcuerdoCobrable, tarifas: TarifasColecta) {
  const tarifa = tarifaDeAcuerdo(acuerdo, tarifas);
  const s = acuerdo.situacion;

  return {
    servicio: acuerdo.servicio,
    referencia_id: acuerdo.referencia_id,
    titulo: acuerdo.titulo,
    detalle: acuerdo.detalle,
    numero_acuerdo: acuerdo.numero_acuerdo,
    tarifa_semanal_usd: tarifa,
    // Los dos datos que el cliente pidió no confundir
    fecha_ultimo_pago: s.fecha_ultimo_pago,
    pagado_hasta: s.cobertura,
    pagado_hasta_texto: formatearPeriodo(s.cobertura),
    // El sistema actual muestra la semana Y la fecha hasta la que cubre
    // ("Sem 35 / 2026" junto a "Hasta 30/08/2026"). Son el mismo dato dicho de
    // dos formas, y el personal usa las dos: la semana para el calculo y la
    // fecha para explicarsela al socio.
    pagado_hasta_fecha: s.cobertura ? rangoDeSemana(s.cobertura).fin : null,
    semanas_pendientes: s.semanas_pendientes,
    semanas_adelantadas: s.semanas_adelantadas,
    estado: s.estado_registrado,
    estado_calculado: s.estado_calculado,
    requiere_revision: s.requiere_revision,
    // Lo que costaría ponerse al día ahora mismo
    monto_al_dia_usd: redondear(tarifa * s.semanas_pendientes),
  };
}

export { calcularSituacion };
