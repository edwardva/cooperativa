import type { ChangeEvent } from 'react'

/**
 * Lee lo escrito en un campo de texto convertido a MAYÚSCULAS. Cambia el
 * valor en el propio campo y devuelve el cursor a donde estaba, para que al
 * corregir en medio del texto no salte al final.
 *
 * Uso: onChange={(e) => setNombre(valorEnMayusculas(e))}
 */
export const valorEnMayusculas = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): string => {
  const campo = e.target
  const mayusculas = campo.value.toUpperCase()
  if (mayusculas !== campo.value) {
    const { selectionStart, selectionEnd } = campo
    campo.value = mayusculas
    // Fechas y otros campos sin cursor de texto no admiten setSelectionRange
    if (selectionStart !== null && selectionEnd !== null) {
      try {
        campo.setSelectionRange(selectionStart, selectionEnd)
      } catch {
        // sin cursor de texto: no hay nada que restaurar
      }
    }
  }
  return mayusculas
}
