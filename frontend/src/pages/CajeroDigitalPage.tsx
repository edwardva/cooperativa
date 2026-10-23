/**
 * ============================================
 * PAGE: cajero digital — revisión de la caja
 * ============================================
 *
 * Confirmado por la cooperativa: "el cajero digital la gente lo paga desde el
 * celular... al ingresar solo accede a un formulario que llena con datos del
 * pago, donde carga la información del pago".
 *
 * Esta es la otra mitad: lo que el socio declaró llega aquí para cotejarlo
 * contra el banco. Mientras está PENDIENTE no ha movido ningún saldo — es un
 * aviso, no un cobro. Conciliarlo deja constancia de que el dinero entró; el
 * cobro se registra en Colecta, con el cajero delante.
 *
 * Esa separación es a propósito: mover dinero a partir de lo que escribió
 * alguien desde fuera, sin que una persona lo mire, no es algo que deba pasar.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, Smartphone, X } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import * as servicio from '../services/cajeroDigitalService'
import type { EstadoPagoWeb, PagoWeb } from '../services/cajeroDigitalService'
import { getErrorMessage } from '../services/api'
import { usePermissions } from '../store/authStore'
import { nombreEnMayusculas } from '../utils/formatters'

const money = (v: string | number): string =>
  Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const dia = (v: string): string => new Date(v).toLocaleDateString('es-VE')

const insignia = (estado: EstadoPagoWeb) => {
  if (estado === 'conciliado') return <Badge variant="success">Conciliado</Badge>
  if (estado === 'rechazado') return <Badge variant="error">Rechazado</Badge>
  return <Badge variant="warning">Pendiente</Badge>
}

const queEs = (p: PagoWeb): string => {
  if (p.destino === 'semanas') return `${p.semanas} semana(s) de funeraria y salud`
  if (p.destino === 'prestamo') return `Abono al préstamo ${p.prestamo?.numero_prestamo ?? ''}`
  return 'Depósito a su ahorro'
}

export default function CajeroDigitalPage() {
  const { hasPermission } = usePermissions()
  const puedeRevisar = hasPermission('colecta', 'update')

  const [filtro, setFiltro] = useState<EstadoPagoWeb | 'todos'>('pendiente')
  const [pagos, setPagos] = useState<PagoWeb[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // El pago que se está rechazando, con su motivo: un rechazo sin explicación
  // no le sirve de nada al socio, que es quien tiene que entenderlo
  const [rechazando, setRechazando] = useState<PagoWeb | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setPagos(await servicio.listarPagos(filtro === 'todos' ? undefined : filtro))
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudieron cargar los pagos')
    } finally {
      setCargando(false)
    }
  }, [filtro])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const conciliar = async (p: PagoWeb) => {
    setEnviando(true)
    try {
      await servicio.revisarPago(p.id, { conciliar: true })
      await cargar()
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo conciliar')
    } finally {
      setEnviando(false)
    }
  }

  const confirmarRechazo = async () => {
    if (!rechazando || !motivo.trim()) return
    setEnviando(true)
    try {
      await servicio.revisarPago(rechazando.id, { conciliar: false, motivo: motivo.trim() })
      setRechazando(null)
      setMotivo('')
      await cargar()
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo rechazar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-neutral-900">
          <Smartphone className="h-7 w-7 text-primary-600" />
          Cajero digital
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pagos que los socios declararon desde el celular. Coteje contra el banco antes de
          conciliar: mientras están pendientes no han movido ningún saldo.
        </p>
      </div>

      <div className="flex gap-2">
        {(['pendiente', 'conciliado', 'rechazado', 'todos'] as const).map((e) => (
          <button
            key={e}
            onClick={() => setFiltro(e)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              filtro === e
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : pagos.length === 0 ? (
        <Card className="p-10 text-center text-neutral-500">
          <Smartphone className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="font-medium">No hay pagos {filtro === 'todos' ? '' : filtro}s</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pagos.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-neutral-900">
                      {p.usuario_digital.socio.codigo_socio}
                    </span>
                    <span className="text-neutral-700">
                      {nombreEnMayusculas(
                        `${p.usuario_digital.socio.apellido}, ${p.usuario_digital.socio.nombre}`
                      )}
                    </span>
                    {insignia(p.estado)}
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{queEs(p)}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {p.banco} · ref <span className="font-mono">{p.referencia_bancaria}</span> ·
                    pagado el {dia(p.fecha_pago)}
                  </p>
                  {p.motivo_rechazo && (
                    <p className="mt-1 text-sm text-red-700">Rechazado: {p.motivo_rechazo}</p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold tabular-nums text-neutral-900">
                    {money(p.monto_bs)} Bs
                  </p>
                  <p className="text-sm text-neutral-500">${money(p.monto_usd)}</p>
                </div>
              </div>

              {p.estado === 'pendiente' && puedeRevisar && (
                <div className="mt-3 flex justify-end gap-2 border-t border-neutral-200 pt-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRechazando(p)
                      setMotivo('')
                    }}
                    disabled={enviando}
                  >
                    <X className="h-4 w-4" />
                    Rechazar
                  </Button>
                  <Button onClick={() => void conciliar(p)} disabled={enviando}>
                    <Check className="h-4 w-4" />
                    Conciliar
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Rechazo: el motivo es obligatorio, y el backend también lo exige */}
      {rechazando && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-neutral-900">Rechazar el pago</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Referencia {rechazando.referencia_bancaria} · {money(rechazando.monto_bs)} Bs
            </p>
            <label className="mt-4 block text-sm font-medium text-neutral-700">
              ¿Por qué se rechaza?
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                placeholder="Ej. La referencia no aparece en el estado de cuenta"
                className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <p className="mt-1 text-xs text-neutral-500">
              El socio verá este motivo, así que conviene que sea claro.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRechazando(null)} disabled={enviando}>
                Cancelar
              </Button>
              <Button onClick={() => void confirmarRechazo()} disabled={!motivo.trim() || enviando}>
                {enviando ? 'Rechazando...' : 'Rechazar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
