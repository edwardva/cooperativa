import type { ReactNode } from 'react';

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
  nota?: string;
  children?: ReactNode;
}

export const PrintableListado = ({
  titulo,
  subtitulo,
  filtros,
  columnas,
  filas,
  resumenes = [],
  nota,
  children,
}: PrintableListadoProps) => {
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

          .cooperativa-print-no-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .cooperativa-print-table {
            width: 100%;
            border-collapse: collapse;
          }

          .cooperativa-print-table th,
          .cooperativa-print-table td {
            border: 1px solid #d1d5db;
            padding: 8px 10px;
            font-size: 11px;
            vertical-align: top;
          }

          .cooperativa-print-table th {
            background: #f3f4f6;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .cooperativa-print-header {
            border-bottom: 2px solid #d1d5db;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }

          .cooperativa-print-filters {
            display: grid;
            gap: 8px;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          }

          .cooperativa-print-chip {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 8px 10px;
            background: #f9fafb;
          }
        }
      `}</style>

      <div className="cooperativa-print-root">
        <div className="cooperativa-print-header">
          <div className="cooperativa-print-no-break flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                Cooperativa el Triunfo, R.L.
              </div>
              <h1 className="mt-2 text-2xl font-bold text-neutral-900">{titulo}</h1>
              <p className="mt-1 text-sm text-neutral-600">{subtitulo}</p>
            </div>
            <div className="text-right text-xs text-neutral-500">
              <div>Generado: {new Date().toLocaleString('es-VE')}</div>
              <div>Vista lista para guardar como PDF</div>
            </div>
          </div>

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
                      <td key={`${index}-${celdaIndex}`}>{celda}</td>
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
      </div>
    </>
  );
};