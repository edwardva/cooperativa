// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Correo al socio con el detalle de su cobro
// ============================================
//
// Pedido de la cooperativa el 15/10: al darle Enviar en la colecta, el socio
// recibe por correo el detalle de lo que pagó, para mantenerlo informado.
//
// Se envía DESPUÉS de registrar el cobro y sin esperarlo: si el servidor de
// correo falla, el cobro ya está hecho y la caja no se detiene. Sólo queda
// anotado en el log.
//
// Mientras no estén cargados los datos del servidor de correo (SMTP_HOST y
// compañía en el .env), no se envía nada. Así se puede desplegar sin que la
// cooperativa tenga todavía la cuenta de correo.

import nodemailer, { type Transporter } from 'nodemailer';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

let transporte: Transporter | null | undefined;

/** El transporte SMTP, o null si no está configurado */
const obtenerTransporte = (): Transporter | null => {
  if (transporte !== undefined) return transporte;
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    transporte = null;
    return null;
  }
  const puerto = Number(process.env.SMTP_PORT) || 587;
  transporte = nodemailer.createTransport({
    host,
    port: puerto,
    // 465 va cifrado desde el inicio; 587 negocia el cifrado después
    secure: puerto === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
  });
  return transporte;
};

export const correoConfigurado = (): boolean => obtenerTransporte() !== null;

const NOMBRE_SERVICIO: Record<string, string> = {
  ahorro: 'Ahorro',
  funeraria: 'Funeraria',
  salud: 'Salud',
  prestamo: 'Préstamo',
};

const bs = (v: unknown) =>
  Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Escapa lo que viene de la base antes de meterlo en el HTML */
const esc = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Manda al socio el detalle de una colecta. Devuelve a qué dirección se
 * mandará, o null si no hay a quién o con qué mandarlo.
 */
export const enviarDetalleColecta = async (colectaId: number): Promise<string | null> => {
  const t = obtenerTransporte();
  if (!t) return null;

  const colecta = await prisma.colecta.findUnique({
    where: { id: colectaId },
    include: {
      detalles: true,
      socio: { select: { codigo_socio: true, nombre: true, apellido: true, email: true } },
    },
  });
  const destino = colecta?.socio.email?.trim();
  if (!colecta || !destino) return null;

  const filas = colecta.detalles
    .map(
      (d) =>
        `<tr><td>${esc(NOMBRE_SERVICIO[d.servicio] ?? d.servicio)}${d.es_reintegro ? ' (reintegro)' : ''}</td>` +
        `<td style="text-align:center">${d.semanas ?? ''}</td>` +
        `<td style="text-align:right">Bs ${bs(d.monto_bs)}</td>` +
        `<td style="text-align:right;color:#059669">$${bs(d.monto_usd)}</td></tr>`
    )
    .join('');

  const fecha = colecta.fecha_colecta.toLocaleString('es-VE');
  const nombre = `${colecta.socio.nombre} ${colecta.socio.apellido}`;
  const html = `
    <p>Estimado(a) ${esc(nombre)} (expediente ${esc(colecta.socio.codigo_socio)}):</p>
    <p>Le confirmamos el pago registrado en la Cooperativa El Triunfo el ${esc(fecha)}.</p>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px" border="1">
      <thead><tr><th>Concepto</th><th>Semanas</th><th>Bolívares</th><th>Dólares</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><th colspan="2" style="text-align:right">Total</th>
        <th style="text-align:right">Bs ${bs(colecta.monto_total_bs)}</th>
        <th style="text-align:right;color:#059669">$${bs(colecta.monto_total_usd)}</th></tr></tfoot>
    </table>
    <p>Tasa del día: ${bs(colecta.tasa_cambio)} Bs/USD. Operación N° ${colecta.id}${
      colecta.referencia ? ` · Referencia ${esc(colecta.referencia)}` : ''
    }.</p>
    <p>Si no reconoce este pago, comuníquese con la oficina de la cooperativa.</p>`;

  await t.sendMail({
    from: process.env.CORREO_REMITENTE || process.env.SMTP_USER,
    to: destino,
    subject: `Cooperativa El Triunfo · Pago N° ${colecta.id}`,
    html,
  });
  return destino;
};

/**
 * Avisa al socio que un cobro suyo se reversó: el dinero de esa operación no
 * quedó aplicado. Pedido de la cooperativa el 23/10.
 */
export const enviarAvisoReverso = async (colectaId: number): Promise<string | null> => {
  const t = obtenerTransporte();
  if (!t) return null;

  const colecta = await prisma.colecta.findUnique({
    where: { id: colectaId },
    include: { socio: { select: { codigo_socio: true, nombre: true, apellido: true, email: true } } },
  });
  const destino = colecta?.socio.email?.trim();
  if (!colecta || !destino || !colecta.reversada) return null;

  const nombre = `${colecta.socio.nombre} ${colecta.socio.apellido}`;
  const html = `
    <p>Estimado(a) ${esc(nombre)} (expediente ${esc(colecta.socio.codigo_socio)}):</p>
    <p>Le informamos que la operación N° ${colecta.id} del ${esc(colecta.fecha_colecta.toLocaleString('es-VE'))},
    por <strong>Bs ${bs(colecta.monto_total_bs)}</strong>
    (<span style="color:#059669">$${bs(colecta.monto_total_usd)}</span>), fue <strong>reversada</strong>
    y no quedó aplicada a sus servicios.</p>
    ${colecta.motivo_reverso ? `<p>Motivo: ${esc(colecta.motivo_reverso)}</p>` : ''}
    <p>Si tiene dudas, comuníquese con la oficina de la cooperativa.</p>`;

  await t.sendMail({
    from: process.env.CORREO_REMITENTE || process.env.SMTP_USER,
    to: destino,
    subject: `Cooperativa El Triunfo · Operación N° ${colecta.id} reversada`,
    html,
  });
  return destino;
};

export const enviarAvisoReversoEnSegundoPlano = (colectaId: number): void => {
  enviarAvisoReverso(colectaId)
    .then((destino) => {
      if (destino) logger.info(`Colecta ${colectaId}: aviso de reverso enviado a ${destino}`);
    })
    .catch((error) => logger.error(`Colecta ${colectaId}: no se pudo enviar el aviso de reverso`, error));
};

/** Lo mismo, sin esperar y sin dejar que un error llegue a la caja */
export const enviarDetalleColectaEnSegundoPlano = (colectaId: number): void => {
  enviarDetalleColecta(colectaId)
    .then((destino) => {
      if (destino) logger.info(`Colecta ${colectaId}: detalle enviado a ${destino}`);
    })
    .catch((error) => logger.error(`Colecta ${colectaId}: no se pudo enviar el correo`, error));
};
