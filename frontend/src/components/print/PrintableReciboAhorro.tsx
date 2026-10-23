import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import logo from '@/logoR.png';
import { nombreEnMayusculas } from '../../utils/formatters';

export interface PrintableReciboAhorroProps {
  /** Id del movimiento: es el número del recibo */
  numero: number;
  fecha: string;
  tipo: 'deposito' | 'retiro';
  /** Moneda de la cuenta: en ella van el monto y los saldos */
  moneda: 'bs' | 'usd';
  monto: number;
  saldoAnterior: number;
  saldoNuevo: number;
  tasa: number;
  /** El monto en la otra moneda, sólo como referencia */
  equivalente: number;
  cuenta: { numero: string; tipo: string };
  socio: { codigo: string; cedula: string; nombre: string };
  concepto?: string | null;
  referencia?: string | null;
  operador?: string | null;
}

const importe = (n: number, moneda: 'bs' | 'usd') =>
  moneda === 'bs'
    ? `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Recibo de un depósito o retiro de ahorro, listo para imprimir.
 *
 * Mismo patrón que PrintableFichaAcuerdo: portal directo a <body> y la clase
 * "print-portal-active" para que globals.css oculte #root al imprimir. Además
 * oculta los demás hijos de <body>, porque el recibo se imprime desde un modal
 * que también es un portal y, si no, salía impreso debajo del recibo.
 */
export const PrintableReciboAhorro = (props: PrintableReciboAhorroProps) => {
  const { numero, fecha, tipo, moneda, monto, saldoAnterior, saldoNuevo, tasa, equivalente, cuenta, socio } =
    props;

  useEffect(() => {
    document.body.classList.add('print-portal-active');
    return () => document.body.classList.remove('print-portal-active');
  }, []);

  const otra = moneda === 'bs' ? 'usd' : 'bs';

  return createPortal(
    <div className="recibo-ahorro-print-host">
      <style>{`
        @media screen {
          .recibo-ahorro-print-host {
            display: none;
          }
        }

        @media print {
          @page {
            margin: 12mm;
          }

          body > *:not(.recibo-ahorro-print-host) {
            display: none !important;
          }

          .recibo-ahorro-print-host {
            display: block;
            max-width: 150mm;
            margin: 0 auto;
            color: #111827;
            background: #ffffff;
            font-size: 12px;
          }

          .recibo-ahorro-tabla {
            width: 100%;
            border-collapse: collapse;
          }

          .recibo-ahorro-tabla td {
            border: 1px solid #d1d5db;
            padding: 6px 8px;
          }

          .recibo-ahorro-tabla td:first-child {
            width: 40%;
            background: #f3f4f6;
            font-weight: 600;
          }

          .recibo-ahorro-firma {
            border-top: 1px solid #111827;
            padding-top: 6px;
            margin-top: 44px;
            text-align: center;
          }
        }
      `}</style>

      <div className="flex items-start justify-between gap-4 border-b-2 border-neutral-300 pb-3">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Cooperativa el Triunfo" className="h-12 w-auto object-contain" />
          <div>
            <div className="text-sm font-bold uppercase tracking-wide">Cooperativa el Triunfo, R.L.</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Recibo de {tipo === 'deposito' ? 'depósito' : 'retiro'} de ahorro
            </div>
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="font-bold">Recibo N° {String(numero).padStart(6, '0')}</div>
          <div>{new Date(fecha).toLocaleString('es-VE')}</div>
        </div>
      </div>

      <table className="recibo-ahorro-tabla mt-4">
        <tbody>
          <tr>
            <td>Asociado</td>
            <td>{nombreEnMayusculas(socio.nombre)}</td>
          </tr>
          <tr>
            <td>Expediente / Cédula</td>
            <td>
              {socio.codigo} / {socio.cedula}
            </td>
          </tr>
          <tr>
            <td>Cuenta</td>
            <td>
              {cuenta.numero} · {cuenta.tipo}
            </td>
          </tr>
          <tr>
            <td>Operación</td>
            <td>{tipo === 'deposito' ? 'Depósito' : 'Retiro'}</td>
          </tr>
          <tr>
            <td>Monto</td>
            <td className="font-bold">{importe(monto, moneda)}</td>
          </tr>
          <tr>
            <td>Saldo anterior</td>
            <td>{importe(saldoAnterior, moneda)}</td>
          </tr>
          <tr>
            <td>Saldo nuevo</td>
            <td className="font-bold">{importe(saldoNuevo, moneda)}</td>
          </tr>
          <tr>
            <td>Referencia en {otra === 'usd' ? 'dólares' : 'bolívares'}</td>
            <td>
              {importe(equivalente, otra)} (tasa {tasa.toLocaleString('es-VE', { maximumFractionDigits: 4 })})
            </td>
          </tr>
          {props.concepto && (
            <tr>
              <td>Concepto</td>
              <td>{props.concepto}</td>
            </tr>
          )}
          {props.referencia && (
            <tr>
              <td>Referencia</td>
              <td>{props.referencia}</td>
            </tr>
          )}
          {props.operador && (
            <tr>
              <td>Atendido por</td>
              <td>{props.operador}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-2 gap-10">
        <div>
          <div className="recibo-ahorro-firma">Firma del Asociado</div>
          <div className="mt-2 text-center">C.I.:</div>
        </div>
        <div>
          <div className="recibo-ahorro-firma">Firma y Sello de Caja</div>
        </div>
      </div>
    </div>,
    document.body
  );
};
