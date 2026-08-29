import { useCallback, useEffect, useState } from 'react'

export type Tema = 'claro' | 'nocturno'

const CLAVE_ALMACENAMIENTO = 'cooperativa:tema'

const prefiereNocturno = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

/** Tema guardado por el usuario; si nunca eligio, el del sistema operativo. */
export const temaInicial = (): Tema => {
  try {
    const guardado = window.localStorage.getItem(CLAVE_ALMACENAMIENTO)
    if (guardado === 'claro' || guardado === 'nocturno') {
      return guardado
    }
  } catch {
    // localStorage puede fallar en navegacion privada; se cae al tema del sistema
  }
  return prefiereNocturno() ? 'nocturno' : 'claro'
}

export const aplicarTema = (tema: Tema): void => {
  document.documentElement.classList.toggle('dark', tema === 'nocturno')
}

export const useTema = () => {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    aplicarTema(tema)
    try {
      window.localStorage.setItem(CLAVE_ALMACENAMIENTO, tema)
    } catch {
      // sin persistencia el tema igual funciona durante la sesion
    }
  }, [tema])

  // Si el usuario nunca eligio explicitamente, seguir los cambios del sistema
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiar = (evento: MediaQueryListEvent) => {
      try {
        if (window.localStorage.getItem(CLAVE_ALMACENAMIENTO)) return
      } catch {
        return
      }
      setTema(evento.matches ? 'nocturno' : 'claro')
    }
    media.addEventListener('change', alCambiar)
    return () => media.removeEventListener('change', alCambiar)
  }, [])

  const alternarTema = useCallback(() => {
    setTema((actual) => (actual === 'nocturno' ? 'claro' : 'nocturno'))
  }, [])

  return { tema, setTema, alternarTema }
}
