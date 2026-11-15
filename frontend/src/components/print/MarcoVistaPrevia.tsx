import { useEffect, type ReactNode } from 'react'
import { Printer, X } from 'lucide-react'

/**
 * Hoja de vista previa para los impresos con formato propio (recibos, fichas,
 * libreta, listados agrupados). La cooperativa pidio que TODA impresion pase
 * antes por la hoja en pantalla y alli se decida imprimir o no (07/11 y 16/11).
 *
 * Cada impreso sigue montado como hasta ahora (oculto en pantalla y visible al
 * imprimir). Con `activa`, su contenedor se deja ver en pantalla y este marco
 * lo pone como una hoja sobre la pagina, con Imprimir y Cerrar. Los estilos
 * del marco son solo de pantalla y la barra lleva print:hidden: al imprimir
 * sale exactamente lo mismo que antes.
 *
 * PrintableListado tiene su propia vista previa (renderiza el contenido dos
 * veces); este marco es para los impresos que no se pueden duplicar asi.
 */
interface MarcoVistaPreviaProps {
  activa: boolean
  /** Que se va a imprimir: se muestra en la barra */
  titulo: string
  onCerrar?: () => void
  /** Ancho de la hoja en pantalla (la libreta es mas angosta que una carta) */
  anchoHoja?: string
  children: ReactNode
}

export const MarcoVistaPrevia = ({ activa, titulo, onCerrar, anchoHoja = '216mm', children }: MarcoVistaPreviaProps) => {
  // Esc cierra la vista previa
  useEffect(() => {
    if (!activa || !onCerrar) return
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [activa, onCerrar])

  if (!activa) return <>{children}</>

  return (
    <div className="marco-vista-previa" role="dialog" aria-modal="true" aria-label={`Vista previa: ${titulo}`}>
      <style>{`
        @media screen {
          .marco-vista-previa {
            position: fixed;
            inset: 0;
            z-index: 300;
            display: flex;
            flex-direction: column;
            background: rgb(23 23 23 / 0.6);
          }
          .marco-vista-previa__fondo {
            flex: 1;
            overflow: auto;
            padding: 24px 16px;
          }
          .marco-vista-previa__hoja {
            margin: 0 auto;
            width: 100%;
            max-width: ${anchoHoja};
            background: #ffffff;
            color: #111827;
            padding: 32px;
            box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.25);
          }
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3 shadow-sm print:hidden">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Vista previa de impresión</p>
          <p className="text-xs text-neutral-500">{titulo}</p>
        </div>
        <div className="flex gap-2">
          {onCerrar && (
            <button
              onClick={onCerrar}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <X className="h-4 w-4" />
              Cerrar
            </button>
          )}
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
      <div className="marco-vista-previa__fondo">
        <div className="marco-vista-previa__hoja">{children}</div>
      </div>
    </div>
  )
}
