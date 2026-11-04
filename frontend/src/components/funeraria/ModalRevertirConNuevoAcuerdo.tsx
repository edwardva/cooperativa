import { useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Alert } from '../ui/Alert'
import * as funerariaService from '../../services/funerariaService'
import * as sociosService from '../../services/sociosService'
import { getErrorMessage } from '../../services/api'
import { formatearFecha, nombreEnMayusculas } from '../../utils/formatters'
import { valorEnMayusculas } from '../../utils/mayusculas'

export interface ModalRevertirConNuevoAcuerdoProps {
  open: boolean
  onClose: () => void
  /** Se llama después de crear el acuerdo y revertir, para recargar la pantalla */
  onCompletado: (numeroAcuerdo: string | null) => void
  socio: { id: number; codigo_socio: string; nombre_completo: string; cedula: string }
  beneficiario: { id: number; nombre: string; apellido: string; parentesco: string }
}

/**
 * Revertir un "fallecido" marcado por error cuando su acuerdo de funeraria ya
 * tiene los 8 beneficiarios activos: ofrece abrir otro acuerdo a nombre del
 * mismo titular y pasar ahí a la persona. Se usa desde Funeraria y desde Salud
 * (el estado es de la persona: se revierte en los dos módulos).
 */
export const ModalRevertirConNuevoAcuerdo = ({
  open,
  onClose,
  onCompletado,
  socio,
  beneficiario,
}: ModalRevertirConNuevoAcuerdoProps) => {
  const [cargando, setCargando] = useState(false)
  const [acuerdoOrigen, setAcuerdoOrigen] = useState<funerariaService.AcuerdoFunerariaPorSocio | null>(null)
  const [numeroAcuerdo, setNumeroAcuerdo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setCargando(true)
    void (async () => {
      try {
        const [acuerdos, beneficiarios] = await Promise.all([
          funerariaService.obtenerAcuerdosPorSocio(socio.id),
          sociosService.obtenerBeneficiarios(socio.id, true),
        ])
        const existentes = acuerdos.data ?? []
        const actual = beneficiarios.data?.find((b) => b.id === beneficiario.id)
        setAcuerdoOrigen(existentes.find((a) => a.id === actual?.acuerdo_funeraria_id) ?? null)
        // Mismo criterio que "Nuevo acuerdo": expediente-N con el primer N libre
        const usados = new Set(existentes.map((a) => a.numero_acuerdo))
        let sufijo = 0
        while (usados.has(`${socio.codigo_socio}-${sufijo}`)) sufijo++
        setNumeroAcuerdo(`${socio.codigo_socio}-${sufijo}`)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setCargando(false)
      }
    })()
  }, [open, socio.id, socio.codigo_socio, beneficiario.id])

  const nombreBeneficiario = nombreEnMayusculas(`${beneficiario.nombre} ${beneficiario.apellido}`)
  const numeroOrigen = acuerdoOrigen?.numero_acuerdo || 'sin número'
  const numeroNuevo = numeroAcuerdo.trim() || 'sin número'

  const confirmar = async () => {
    setEnviando(true)
    setError(null)
    try {
      const respuesta = await funerariaService.revertirFallecidoConNuevoAcuerdo(beneficiario.id, {
        numero_acuerdo: numeroAcuerdo.trim() || undefined,
      })
      if (!respuesta.success) throw new Error('No fue posible crear el acuerdo')
      onCompletado(respuesta.data.numero_acuerdo)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Acuerdo de funeraria lleno"
      description="Para revertir el fallecimiento se abrirá otro acuerdo a nombre del mismo titular"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} isLoading={enviando} disabled={cargando}>
            <RotateCcw className="w-4 h-4" />
            Crear acuerdo y revertir
          </Button>
        </>
      }
    >
      {cargando ? (
        <div className="flex justify-center items-center gap-2 py-8 text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Cargando acuerdos del socio...
        </div>
      ) : (
        <div className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            El acuerdo <span className="font-mono font-medium">{numeroOrigen}</span> ya tiene 8 beneficiarios activos.
            Para revertir a <span className="font-medium">{nombreBeneficiario}</span> ({beneficiario.parentesco}) se
            abrirá un acuerdo nuevo a nombre del mismo titular.
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-sm font-semibold text-neutral-900">{nombreEnMayusculas(socio.nombre_completo)}</p>
            <p className="text-xs text-neutral-500">
              Titular • {socio.codigo_socio} • {socio.cedula}
            </p>
          </div>

          <Input
            label="N° de acuerdo de funeraria"
            value={numeroAcuerdo}
            onChange={(e) => setNumeroAcuerdo(valorEnMayusculas(e))}
            helperText="Propuesto como expediente-número; puedes modificarlo"
          />

          <div className="rounded-lg border border-neutral-200 p-4 space-y-2 text-sm">
            <p className="font-semibold text-neutral-800">Al confirmar:</p>
            <ul className="list-disc space-y-1 pl-5 text-neutral-700">
              <li>
                Se crea el acuerdo <span className="font-mono font-medium">{numeroNuevo}</span>, con su propia cuota y
                sus propios pagos.
              </li>
              <li>
                Conserva la fecha de inicio del acuerdo {numeroOrigen}
                {acuerdoOrigen ? ` (${formatearFecha(acuerdoOrigen.fecha_inicio)})` : ''}: no hay período de espera.
              </li>
              <li>
                {nombreBeneficiario} sale de {numeroOrigen}, pasa al acuerdo nuevo y vuelve a estar activo.
              </li>
              <li>El fallecimiento también se revierte en Salud.</li>
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}
