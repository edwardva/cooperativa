/**
 * Cierre del año del calendario de colecta: 52 o 53 semanas.
 *
 * Confirmado por la cooperativa el 10/11/2026: lo decide la funeraria cada
 * diciembre. Sin aviso de la funeraria el año cierra en 52 y la semana que
 * cruza el año es la 1 del siguiente. Este componente tiene dos formas:
 *
 * - `aviso`: banda que aparece desde el 1 de diciembre mientras el año no esté
 *   confirmado. Va en Colecta y en Semanas de colecta.
 * - `panel`: el bloque de Semanas de colecta para confirmar lo que avisó la
 *   funeraria (o volver atrás).
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarRange, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import * as semanasService from '../../services/semanasColectaService'
import type { EstadoCierreAno } from '../../services/semanasColectaService'
import { getErrorMessage } from '../../services/api'
import { usePermissions } from '../../store/authStore'
import { fechaCorta } from './presentacion'

const fecha = (iso: string) => fechaCorta(iso, true)

interface Props {
  modo: 'aviso' | 'panel'
  /** Tras confirmar: la pantalla recarga sus semanas */
  onCambio?: () => void
}

export const CierreDelAno = ({ modo, onCambio }: Props) => {
  const { hasPermission } = usePermissions()
  const puedeConfirmar = hasPermission('semanas_colecta', 'update')

  const [estado, setEstado] = useState<EstadoCierreAno | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    try {
      const r = await semanasService.obtenerCierreAno()
      if (r.success) setEstado(r.data)
    } catch {
      // Sin el dato no se muestra nada: el calendario sigue la regla igual
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const confirmar = async (semanas: 52 | 53) => {
    if (!estado) return
    const cambia = semanas !== estado.semanas
    if (
      cambia &&
      !window.confirm(
        semanas === 53
          ? `¿La funeraria pidió cerrar ${estado.ano} en la semana 53?\n\n` +
              `La semana del ${fecha(estado.semana_en_disputa.inicio)} al ${fecha(estado.semana_en_disputa.fin)} ` +
              `pasa a ser la S53/${estado.ano} y la semana 1 de ${estado.ano + 1} arranca una semana después. ` +
              'Los adelantos ya cobrados conservan las fechas que cubren.'
          : `¿Cerrar ${estado.ano} en la semana 52?\n\n` +
              `La semana del ${fecha(estado.semana_en_disputa.inicio)} al ${fecha(estado.semana_en_disputa.fin)} ` +
              `pasa a ser la semana 1 de ${estado.ano + 1}.`
      )
    ) {
      return
    }

    setGuardando(true)
    setError('')
    setMensaje('')
    try {
      const r = await semanasService.confirmarCierreAno(estado.ano, semanas, 'Aviso de la funeraria')
      if (r.success) {
        setEstado(r.data.estado)
        setMensaje(
          cambia
            ? `Listo: ${estado.ano} cierra en la semana ${semanas}.`
            : `Quedó confirmado que ${estado.ano} cierra en la semana ${semanas}.`
        )
        onCambio?.()
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (!estado) return null

  const textoCierre =
    `${estado.ano} cierra en la semana ${estado.semanas} el domingo ${fecha(estado.cierra_el)} · ` +
    `la semana 1 de ${estado.ano + 1} arranca el lunes ${fecha(estado.siguiente_arranca_el)}`

  if (modo === 'aviso') {
    if (!estado.mostrar_aviso) return null
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            Confirme con la funeraria si {estado.ano} cierra en la semana 52 o en la 53
          </p>
          <p className="mt-0.5">
            Si no se confirma, {textoCierre}.
          </p>
        </div>
        {puedeConfirmar && (
          <Link to="/semanas-colecta" className="self-center text-sm font-medium underline hover:no-underline">
            Confirmar
          </Link>
        )}
      </div>
    )
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <CalendarRange className="h-5 w-5 text-primary-600" />
            Cierre del año {estado.ano}
          </p>
          <p className="mt-1 text-sm text-neutral-700">{textoCierre}.</p>
          <p className="mt-1 text-xs text-neutral-500">
            {estado.confirmado
              ? `Confirmado${estado.confirmado_por ? ` por ${estado.confirmado_por}` : ''}${
                  estado.fecha_confirmacion ? ` el ${fecha(estado.fecha_confirmacion)}` : ''
                }.`
              : `Sin confirmar: rige la regla de siempre (${estado.semanas_por_regla} semanas). Lo decide la funeraria.`}
          </p>
          {!estado.puede_cambiar && (
            <p className="mt-1 text-xs text-neutral-500">
              La semana del {fecha(estado.semana_en_disputa.inicio)} ya empezó: el cierre ya no se puede cambiar.
            </p>
          )}
        </div>

        {puedeConfirmar && estado.puede_cambiar && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={estado.semanas === 52 ? 'primary' : 'outline'}
              disabled={guardando}
              onClick={() => void confirmar(52)}
            >
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              {estado.semanas === 52 && !estado.confirmado ? 'Confirmar 52 semanas' : 'Cerrar en 52'}
            </Button>
            <Button
              variant={estado.semanas === 53 ? 'primary' : 'outline'}
              disabled={guardando}
              onClick={() => void confirmar(53)}
            >
              {estado.semanas === 53 ? 'Confirmar 53 semanas' : 'La funeraria pidió semana 53'}
            </Button>
          </div>
        )}
      </div>

      {mensaje && <p className="mt-3 text-sm font-medium text-emerald-700">{mensaje}</p>}
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </Card>
  )
}
