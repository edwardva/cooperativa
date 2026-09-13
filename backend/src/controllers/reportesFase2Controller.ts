// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Reportes de fase 2: ver y exportar (RF-REP-08)
// ============================================
//
// Ver y exportar llaman al MISMO generador: la tabla que se ve en pantalla es
// la que baja en Excel o PDF, con los mismos totales (QA-019).

import type { Request, Response } from 'express';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { generarExcelTabla, generarPDFTabla } from '../services/reportesService';
import { esClaveReporte, generarReporte, REPORTES, type ClaveReporte } from '../services/reportesFase2Service';
import { filasParaExportar, nombreArchivo } from '../utils/reportes';
import { responderError } from '../utils/responderError';

const claveDeRuta = (req: Request): ClaveReporte => {
  const clave = String(req.params.reporte ?? '');
  if (!esClaveReporte(clave)) throw new NotFoundError(`No existe el reporte "${clave}"`);
  return clave;
};

/** La query de Express a texto plano: los generadores no reciben arreglos */
const parametros = (req: Request): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(req.query).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : v === undefined ? undefined : String(v)])
  );

/** GET /api/reportes/catalogo */
export const catalogoReportes = (_req: Request, res: Response): void => {
  res.json({ success: true, data: Object.entries(REPORTES).map(([clave, titulo]) => ({ clave, titulo })) });
};

/** GET /api/reportes/generar/:reporte?... — la tabla para mostrar en pantalla */
export const verReporte = async (req: Request, res: Response): Promise<void> => {
  try {
    const reporte = await generarReporte(claveDeRuta(req), parametros(req));
    res.json({ success: true, data: reporte });
  } catch (error) {
    responderError(res, error, 'Error al generar el reporte');
  }
};

/** GET /api/reportes/exportar/:reporte?formato=excel|pdf&... */
export const exportarReporte = async (req: Request, res: Response): Promise<void> => {
  try {
    const clave = claveDeRuta(req);
    const formato = req.query.formato;
    if (formato !== 'excel' && formato !== 'pdf') throw new BadRequestError("Indique el formato: 'excel' o 'pdf'");

    const reporte = await generarReporte(clave, parametros(req));
    const opciones = { titulo: reporte.titulo, subtitulo: reporte.subtitulo };
    const filas = filasParaExportar(reporte);

    const buffer =
      formato === 'pdf'
        ? await generarPDFTabla(opciones, reporte.columnas, filas)
        : await generarExcelTabla(opciones, reporte.columnas, filas);

    res.setHeader(
      'Content-Type',
      formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(clave, formato)}"`);
    res.send(buffer);
  } catch (error) {
    responderError(res, error, 'Error al exportar el reporte');
  }
};
