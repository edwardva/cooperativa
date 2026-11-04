import type { ReactNode } from 'react';
import logo from '@/logoR.png';

export const NOMBRE_COOPERATIVA = 'Cooperativa el Triunfo, R.L.';
export const LOGO_COOPERATIVA = logo;

// El logo pesa ~300 KB: se carga desde que se abre la app para que esté listo
// cuando se imprime (si no, el diálogo de impresión podía salir sin logo).
if (typeof Image !== 'undefined') {
  new Image().src = logo;
}

interface EncabezadoImpresionProps {
  /** Qué documento es: "Ficha de Acuerdo de Salud", "Listado de ...", etc. */
  titulo: string;
  /** Línea opcional bajo el título (filtros, servicio, etc.) */
  subtitulo?: string;
  /** Datos a la derecha (N° de recibo, totales…); la fecha de generación va siempre */
  detalles?: ReactNode;
  /** Fecha de generación a mostrar (por defecto, ahora) */
  generadoEn?: Date;
}

/**
 * Encabezado único de TODO documento impreso del sistema: logo y datos de la
 * cooperativa a la izquierda, fecha de generación a la derecha. Cualquier
 * impresión nueva debe usarlo para que todas se vean iguales.
 */
export const EncabezadoImpresion = ({ titulo, subtitulo, detalles, generadoEn }: EncabezadoImpresionProps) => (
  <div
    className="flex items-start justify-between gap-4 border-b-2 border-neutral-300 pb-3"
    style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
  >
    <div className="flex items-center gap-3">
      <img src={logo} alt={NOMBRE_COOPERATIVA} className="h-12 w-auto object-contain" />
      <div>
        <div className="text-sm font-bold uppercase tracking-wide text-neutral-900">{NOMBRE_COOPERATIVA}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{titulo}</div>
        {subtitulo && <div className="mt-1 text-xs text-neutral-600">{subtitulo}</div>}
      </div>
    </div>
    <div className="text-right text-[10px] text-neutral-500">
      {detalles}
      <div>Generado: {(generadoEn ?? new Date()).toLocaleString('es-VE')}</div>
      <div>Documento generado por el sistema</div>
    </div>
  </div>
);

/**
 * Abre el diálogo de impresión cuando las imágenes del documento (el logo)
 * ya cargaron, con un máximo de espera para no bloquear si alguna falla.
 * `cancelado` permite al efecto que la llamó anularla si se desmonta antes
 * (p. ej. React StrictMode ejecuta los efectos dos veces en desarrollo).
 */
export const imprimirCuandoEsteListo = async (cancelado: () => boolean = () => false, esperaMaximaMs = 3000): Promise<void> => {
  const pendientes = Array.from(document.images).filter((img) => !img.complete);
  if (pendientes.length > 0) {
    await Promise.race([
      Promise.all(
        pendientes.map(
          (img) =>
            new Promise<void>((listo) => {
              img.addEventListener('load', () => listo(), { once: true });
              img.addEventListener('error', () => listo(), { once: true });
            })
        )
      ),
      new Promise<void>((listo) => setTimeout(listo, esperaMaximaMs)),
    ]);
  }
  // Un cuadro para que el navegador pinte el documento ya completo
  await new Promise<void>((listo) => requestAnimationFrame(() => listo()));
  if (!cancelado()) window.print();
};
