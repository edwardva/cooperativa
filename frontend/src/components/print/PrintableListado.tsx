import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { nombreEnMayusculas } from '../../utils/formatters';
import { EncabezadoImpresion } from './EncabezadoImpresion';

interface FiltroResumen {
  label: string;
  value: string;
}

interface ResumenImpresion {
  label: string;
  value: string;
}

interface PrintableListadoProps {
  titulo: string;
  subtitulo: string;
  filtros: FiltroResumen[];
  columnas: string[];
  filas: string[][];
  resumenes?: ResumenImpresion[];
  /** Columnas con nombres de socios/beneficiarios: sus celdas se imprimen en MAYUSCULAS. */
  columnasMayusculas?: string[];
  nota?: string;
  children?: ReactNode;
  /**
   * Muestra en pantalla la hoja tal como va a salir, con Imprimir y Cerrar.
   * La cooperativa pidio ver los reportes antes de mandarlos a la impresora
   * (observacion del 07/11); antes el boton imprimia directo.
   */
  vistaPrevia?: boolean;
  onCerrarVistaPrevia?: () => void;
}

export const PrintableListado = ({
  titulo,
  subtitulo,
  filtros,
  columnas,
  filas,
  resumenes = [],
  columnasMayusculas = [],
  nota,
  children,
  vistaPrevia = false,
  onCerrarVistaPrevia,
}: PrintableListadoProps) => {
  // Esc cierra la vista previa
  useEffect(() => {
    if (!vistaPrevia || !onCerrarVistaPrevia) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrarVistaPrevia();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [vistaPrevia, onCerrarVistaPrevia]);

  return (
    <>
      <style>{`
        @media screen {
          .cooperativa-print-root {
            display: none;
          }
        }

        @media print {
          body * {
            visibility: hidden;
          }

          .cooperativa-print-root,
          .cooperativa-print-root * {
            visibility: visible;
          }

          .cooperativa-print-root {
            display: block;
            position: absolute;
            inset: 0;
            width: 100%;
            padding: 24px;
            color: #111827;
            background: #ffffff;
          }

        }

        /* Aspecto de la hoja: el mismo en la impresion y en la vista previa */
        .cooperativa-print-root .cooperativa-print-no-break,
        .cooperativa-preview .cooperativa-print-no-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        .cooperativa-print-root .cooperativa-print-table,
        .cooperativa-preview .cooperativa-print-table {
            width: 100%;
            border-collapse: collapse;
          }
        .cooperativa-print-root .cooperativa-print-table th,
        .cooperativa-print-root .cooperativa-print-table td,
        .cooperativa-preview .cooperativa-print-table th,
        .cooperativa-preview .cooperativa-print-table td {
            border: 1px solid #d1d5db;
            padding: 8px 10px;
            font-size: 11px;
            vertical-align: top;
          }
        .cooperativa-print-root .cooperativa-print-table th,
        .cooperativa-preview .cooperativa-print-table th {
            background: #f3f4f6;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
        .cooperativa-print-root .cooperativa-print-header,
        .cooperativa-preview .cooperativa-print-header {
            border-bottom: 2px solid #d1d5db;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
        .cooperativa-print-root .cooperativa-print-filters,
        .cooperativa-preview .cooperativa-print-filters {
            display: grid;
            gap: 8px;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          }
        .cooperativa-print-root .cooperativa-print-chip,
        .cooperativa-preview .cooperativa-print-chip {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 8px 10px;
            background: #f9fafb;
          }
      `}</style>

      <div className="cooperativa-print-root">{contenido()}</div>

      {vistaPrevia &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Vista previa: ${titulo}`}
            className="fixed inset-0 z-[300] flex flex-col bg-neutral-900/60 print:hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Vista previa de impresión</p>
                <p className="text-xs text-neutral-500">
                  {titulo} · {filas.length} registro{filas.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onCerrarVistaPrevia}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <X className="h-4 w-4" />
                  Cerrar
                </button>
                <button
                  onClick={() => window.print()}
                  autoFocus
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-4 py-6">
              {/* Ancho de una hoja carta: lo que se ve es lo que sale */}
              <div className="cooperativa-preview mx-auto w-full max-w-[216mm] bg-white p-6 text-neutral-900 shadow-xl sm:p-10">
                {contenido()}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );

  function contenido() {
    return (
      <>
        <div className="cooperativa-print-header">
          <EncabezadoImpresion titulo={titulo} subtitulo={subtitulo} />

          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Filtros aplicados
            </div>
            <div className="cooperativa-print-filters">
              {filtros.length > 0 ? (
                filtros.map((filtro) => (
                  <div key={`${filtro.label}-${filtro.value}`} className="cooperativa-print-chip">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      {filtro.label}
                    </div>
                    <div className="mt-1 text-sm font-medium text-neutral-900">{filtro.value}</div>
                  </div>
                ))
              ) : (
                <div className="cooperativa-print-chip text-sm text-neutral-600">
                  Sin filtros activos
                </div>
              )}
            </div>
          </div>
        </div>

        {resumenes.length > 0 && (
          <div className="cooperativa-print-no-break mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {resumenes.map((resumen) => (
              <div key={resumen.label} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {resumen.label}
                </div>
                <div className="mt-1 text-lg font-bold text-neutral-900">{resumen.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-neutral-200">
          <table className="cooperativa-print-table">
            <thead>
              <tr>
                {columnas.map((columna) => (
                  <th key={columna}>{columna}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.length > 0 ? (
                filas.map((fila, index) => (
                  <tr key={`${index}-${fila.join('-')}`}>
                    {fila.map((celda, celdaIndex) => (
                      <td key={`${index}-${celdaIndex}`}>
                        {columnasMayusculas.includes(columnas[celdaIndex] ?? '') ? nombreEnMayusculas(celda) : celda}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columnas.length} className="text-center text-neutral-500">
                    No hay registros para imprimir.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {nota && (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
            {nota}
          </div>
        )}

        {children}
      </>
    );
  }
};