import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import logo from '@/logoR.png';

export interface BeneficiarioFichaImpresion {
  numero: number;
  nombre: string;
  cedula: string;
  parentesco: string;
  fecha_ingreso: string | null;
  fecha_nacimiento?: string | null;
  edad?: number | null;
  estado?: string;
}

export interface PrintableFichaAcuerdoProps {
  servicio: 'SALUD' | 'FUNERARIA';
  numero_acuerdo: string;
  numero_contrato?: string | null;
  fecha_inicio: string | null;
  /** Estado del acuerdo (activo/suspendido/retirado): se resalta cuando no está activo. */
  estado?: string | null;
  socio: {
    codigo: string;
    cedula: string;
    nombre: string;
    direccion?: string | null;
    telefono?: string | null;
  };
  beneficiarios: BeneficiarioFichaImpresion[];
}

const formatearFecha = (fecha: string | null | undefined): string => {
  if (!fecha) return 'N/D';
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return 'N/D';
  return valor.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Ficha imprimible de un acuerdo de beneficios (Salud o Funeraria): titular +
 * beneficiarios con derecho al servicio, lista para imprimir o guardar como
 * PDF. Se monta en un React Portal directo a document.body (hermano de
 * #root, no descendiente) y mientras está montado agrega la clase
 * "print-portal-active" a <body>, que en globals.css oculta #root por
 * completo durante la impresión. Antes se ocultaba el resto de la app con
 * "visibility: hidden" dentro del propio árbol de la página, pero eso sigue
 * ocupando espacio en el flujo del documento y el motor de paginación del
 * navegador terminaba generando una página adicional casi en blanco al
 * final (con el título del documento y la fecha como encabezado/pie nativos
 * del navegador). Al no tener ya ningún otro contenido "invisible pero con
 * espacio reservado" alrededor, no hace falta position:absolute ni el
 * truco de visibility: el root simplemente fluye normal en la página.
 */
export const PrintableFichaAcuerdo = ({
  servicio,
  numero_acuerdo,
  numero_contrato,
  fecha_inicio,
  estado,
  socio,
  beneficiarios,
}: PrintableFichaAcuerdoProps) => {
  const estadoNormalizado = (estado || 'activo').toLowerCase();
  useEffect(() => {
    document.body.classList.add('print-portal-active');
    return () => document.body.classList.remove('print-portal-active');
  }, []);

  return createPortal(
    <>
      <style>{`
        @media screen {
          .ficha-print-root {
            display: none;
          }
        }

        @media print {
          @page {
            margin: 14mm 12mm 16mm 12mm;
          }

          .ficha-print-root {
            display: block;
            width: 100%;
            padding: 0;
            color: #111827;
            background: #ffffff;
          }

          .ficha-print-no-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .ficha-print-table {
            width: 100%;
            border-collapse: collapse;
          }

          .ficha-print-table th,
          .ficha-print-table td {
            border: 1px solid #d1d5db;
            padding: 6px 8px;
            font-size: 10.5px;
            vertical-align: top;
          }

          .ficha-print-table th {
            background: #f3f4f6;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            text-align: left;
          }

          .ficha-print-firma {
            border-top: 1px solid #111827;
            padding-top: 6px;
            margin-top: 48px;
          }
        }
      `}</style>

      <div className="ficha-print-root">
        <div className="ficha-print-no-break flex items-start justify-between gap-4 border-b-2 border-neutral-300 pb-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Cooperativa el Triunfo" className="h-12 w-auto object-contain" />
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-neutral-900">
                Cooperativa el Triunfo, R.L.
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Ficha de Acuerdo de {servicio === 'SALUD' ? 'Salud' : 'Funeraria'}
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] text-neutral-500">
            <div>Generado: {new Date().toLocaleString('es-VE')}</div>
            <div>Documento generado por el sistema</div>
          </div>
        </div>

        <div className="ficha-print-no-break mt-4">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-500">
            Datos del acuerdo
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="font-semibold">Acuerdo No: </span>
              {numero_acuerdo}
            </div>
            {numero_contrato && (
              <div>
                <span className="font-semibold">N° Contrato: </span>
                {numero_contrato}
              </div>
            )}
            <div>
              <span className="font-semibold">Fecha Ingreso: </span>
              {formatearFecha(fecha_inicio)}
            </div>
            {estadoNormalizado !== 'activo' && (
              <div>
                <span className="font-semibold">Estado del Acuerdo: </span>
                <span className="font-bold uppercase text-rose-700">{estadoNormalizado}</span>
              </div>
            )}
          </div>
        </div>

        <div className="ficha-print-no-break mt-4">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-500">
            Datos del asociado
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="font-semibold">Expediente: </span>
              {socio.codigo}
            </div>
            <div>
              <span className="font-semibold">Cédula: </span>
              {socio.cedula}
            </div>
            <div className="col-span-2">
              <span className="font-semibold">Apellidos y Nombres: </span>
              {socio.nombre}
            </div>
            {socio.direccion && (
              <div className="col-span-2">
                <span className="font-semibold">Dirección: </span>
                {socio.direccion}
              </div>
            )}
            {socio.telefono && (
              <div>
                <span className="font-semibold">Teléfono: </span>
                {socio.telefono}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-500">
            Beneficiarios con derecho al servicio
          </div>
          <table className="ficha-print-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Apellidos y Nombres</th>
                <th>Cédula</th>
                <th>Parentesco</th>
                <th>F. Ingreso</th>
                <th>F. Nacimiento</th>
                <th>Edad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {beneficiarios.length > 0 ? (
                beneficiarios.map((b) => (
                  <tr key={b.numero}>
                    <td>{String(b.numero).padStart(3, '0')}</td>
                    <td>{b.nombre}</td>
                    <td>{b.cedula}</td>
                    <td>{b.parentesco}</td>
                    <td>{formatearFecha(b.fecha_ingreso)}</td>
                    <td>{formatearFecha(b.fecha_nacimiento)}</td>
                    <td>{b.edad ?? 'N/D'}</td>
                    <td>{b.estado && b.estado !== 'activo' ? b.estado.toUpperCase() : 'Activo'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center text-neutral-500">
                    Sin beneficiarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ficha-print-no-break mt-16 grid grid-cols-2 gap-10 text-sm">
          <div>
            <div className="ficha-print-firma text-center">Firma del Asociado</div>
            <div className="mt-2 text-center">C.I.:</div>
          </div>
          <div>
            <div className="ficha-print-firma text-center">Sello y Firma Autorizado</div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
