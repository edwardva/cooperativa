import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import logo from '@/logoR.png';
import type { GrupoSalud } from '../../services/saludService';

export type TipoListadoGrupos = 'activos' | 'suspendidos' | 'proximos_suspender';

export interface PrintableListadoGruposProps {
  tipo: TipoListadoGrupos;
  grupos: GrupoSalud[];
}

const TITULOS: Record<TipoListadoGrupos, string> = {
  activos: 'Listado de Socios Activos',
  suspendidos: 'Listado de Socios Suspendidos',
  proximos_suspender: 'Listado de Socios Próximos a Suspender',
};

/**
 * Listado imprimible de acuerdos de salud (uno por grupo: titular +
 * beneficiarios a su cargo) filtrado por tipo. Cada grupo se muestra como
 * una tarjeta compacta en vez de una fila plana por persona, para que el
 * titular y sus beneficiarios se lean juntos sin desorden visual. Se monta
 * en un React Portal directo a document.body (hermano de #root, no
 * descendiente) y mientras está montado agrega la clase
 * "print-portal-active" a <body>, que en globals.css oculta #root por
 * completo durante la impresión — ver el comentario en
 * PrintableFichaAcuerdo.tsx para el porqué (evita la página fantasma final
 * que dejaba el truco anterior de "visibility: hidden").
 */
export const PrintableListadoGrupos = ({ tipo, grupos }: PrintableListadoGruposProps) => {
  useEffect(() => {
    document.body.classList.add('print-portal-active');
    return () => document.body.classList.remove('print-portal-active');
  }, []);

  return createPortal(
    <>
      <style>{`
        @media screen {
          .listado-grupos-print-root {
            display: none;
          }
        }

        @media print {
          @page {
            margin: 12mm 12mm 14mm 12mm;
          }

          .listado-grupos-print-root {
            display: block;
            width: 100%;
            padding: 0;
            color: #111827;
            background: #ffffff;
          }

          .listado-grupos-card {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 8px 10px;
            margin-bottom: 8px;
          }

          .listado-grupos-chip {
            display: inline-block;
            border: 1px solid #e5e7eb;
            border-radius: 999px;
            padding: 1px 8px;
            margin: 2px 4px 0 0;
            font-size: 10px;
            color: #374151;
            background: #f9fafb;
          }
        }
      `}</style>

      <div className="listado-grupos-print-root">
        <div className="flex items-start justify-between gap-4 border-b-2 border-neutral-300 pb-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Cooperativa el Triunfo" className="h-12 w-auto object-contain" />
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-neutral-900">
                Cooperativa el Triunfo, R.L.
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                {TITULOS[tipo]} - Salud
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] text-neutral-500">
            <div>Total de grupos: {grupos.length}</div>
            <div>Generado: {new Date().toLocaleString('es-VE')}</div>
          </div>
        </div>

        <div className="mt-4">
          {grupos.length === 0 ? (
            <p className="text-center text-sm text-neutral-500">No hay grupos que coincidan con este listado.</p>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.numero_acuerdo ?? grupo.socio?.id} className="listado-grupos-card">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[11px]">
                  <div>
                    <span className="font-semibold">{grupo.socio?.nombre_completo || 'N/D'}</span>
                    <span className="ml-2 text-neutral-500">
                      Exp. {grupo.socio?.codigo_socio || 'N/D'} &middot; C.I. {grupo.socio?.cedula || 'N/D'}
                    </span>
                  </div>
                  <div className="text-neutral-600">
                    Acuerdo {grupo.numero_acuerdo || 'S/N'}
                    {' · '}
                    {(grupo.estado || 'N/D').toUpperCase()}
                    {grupo.semanas_sin_pago > 0 && ` · ${grupo.semanas_sin_pago} sem. sin pago`}
                  </div>
                </div>

                {grupo.beneficiarios.length > 0 && (
                  <div className="mt-1 border-t border-neutral-100 pt-1 text-[10px]">
                    <span className="font-semibold text-neutral-500">Beneficiarios: </span>
                    {grupo.beneficiarios.map((b) => (
                      <span key={b.beneficiario_id} className="listado-grupos-chip">
                        {b.nombre} {b.apellido} &middot; {b.parentesco}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>,
    document.body
  );
};
