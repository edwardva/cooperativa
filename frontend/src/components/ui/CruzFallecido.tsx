import type { SVGProps } from 'react'

/**
 * Cruz latina rellena sobre pedestal (estilo cementerio), para marcar
 * beneficiarios fallecidos. Se usa en lugar de `Cross` de lucide porque ese
 * ícono tiene los brazos casi iguales y a simple vista se confunde con "+".
 * Toma el color de `currentColor` y el tamaño de las clases, como los íconos de lucide.
 */
export const CruzFallecido = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    {/* Brazo vertical y travesaño alto */}
    <rect x="10.25" y="1" width="3.5" height="17" rx="0.6" />
    <rect x="5.5" y="5" width="13" height="3.5" rx="0.6" />
    {/* Pedestal escalonado */}
    <rect x="7.5" y="18" width="9" height="2" rx="0.4" />
    <rect x="5" y="20" width="14" height="2.5" rx="0.4" />
  </svg>
)
