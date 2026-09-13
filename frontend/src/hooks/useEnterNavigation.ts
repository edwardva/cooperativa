/**
 * ============================================
 * HOOK: NAVEGACION CON ENTER
 * ============================================
 * RF-USA-01 a 03 / FE-022. Se pone en el contenedor del formulario:
 *
 *   const alEnter = useEnterNavigation()
 *   <div onKeyDown={alEnter}> ...campos... </div>
 *
 * Reglas:
 *  - Enter en un input o select pasa al siguiente campo, en orden del DOM
 *    (que es el orden visual de los formularios).
 *  - Tab y Shift+Tab siguen funcionando igual: no se tocan.
 *  - En un textarea, Enter es salto de linea.
 *  - Los botones conservan su Enter, pero Enter NUNCA lleva el foco a un
 *    boton: asi no se guarda ni se anula nada por accidente. En el ultimo
 *    campo, Enter no hace nada.
 *  - Se saltan los campos deshabilitados, de solo lectura u ocultos.
 *  - Un campo con su propio Enter (un buscador) llama a preventDefault() o
 *    lleva `data-enter-propio`, y el hook lo deja en paz.
 */

import { useCallback } from 'react'
import type { KeyboardEvent } from 'react'

const TIPOS_SIN_NAVEGACION = new Set(['submit', 'button', 'reset', 'file', 'image'])
const TIPOS_SELECCIONABLES = new Set(['text', 'search', 'tel', 'email', 'number', 'url', ''])

const esCampoNavegable = (el: HTMLElement): boolean => {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false
  if (el.tabIndex < 0 || el.offsetParent === null) return false
  if (el instanceof HTMLInputElement) return el.type !== 'hidden' && !el.readOnly && !TIPOS_SIN_NAVEGACION.has(el.type)
  if (el instanceof HTMLTextAreaElement) return !el.readOnly
  return el instanceof HTMLSelectElement
}

export const useEnterNavigation = () =>
  useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.nativeEvent.isComposing) return
    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return

    const origen = e.target as HTMLElement
    const esCampo =
      (origen instanceof HTMLInputElement && !TIPOS_SIN_NAVEGACION.has(origen.type)) ||
      origen instanceof HTMLSelectElement
    if (!esCampo || origen.dataset.enterPropio !== undefined) return

    e.preventDefault()

    const campos = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('input, select, textarea')
    ).filter(esCampoNavegable)
    const siguiente = campos[campos.indexOf(origen) + 1]
    if (!siguiente) return

    siguiente.focus()
    if (siguiente instanceof HTMLInputElement && TIPOS_SELECCIONABLES.has(siguiente.type)) {
      siguiente.select()
    }
  }, [])
