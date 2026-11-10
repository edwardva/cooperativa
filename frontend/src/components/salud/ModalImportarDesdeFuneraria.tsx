import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import * as funerariaService from '../../services/funerariaService'
import * as saludService from '../../services/saludService'
import * as sociosService from '../../services/sociosService'
import { getErrorMessage } from '../../services/api'
import { formatearFecha, nombreEnMayusculas } from '../../utils/formatters'

export interface ModalImportarDesdeFunerariaProps {
  open: boolean
  onClose: () => void
  /** Se llama al cerrar la ventana de resultado si se copió algo, para recargar el detalle */
  onCompletado: () => void
  /** Acuerdo de salud abierto: es el destino */
  numeroAcuerdoSalud: string
  socio: { id: number; codigo_socio: string; nombre_completo: string }
}

const esTitular = (parentesco: string) => parentesco.trim().toLowerCase() === 'titular'

/**
 * "Importar" desde el detalle de un acuerdo de salud: TRAE beneficiarios de un
 * acuerdo de funeraria del mismo titular y los copia a ESTE acuerdo de salud.
 * En Funeraria no cambia nada. Salud no tiene tope de beneficiarios; quien ya
 * está en este acuerdo no se repite y quien fue retirado de él se reincorpora.
 */
export const ModalImportarDesdeFuneraria = ({
  open,
  onClose,
  onCompletado,
  numeroAcuerdoSalud,
  socio,
}: ModalImportarDesdeFunerariaProps) => {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acuerdos, setAcuerdos] = useState<funerariaService.AcuerdoFunerariaPorSocio[]>([])
  const [acuerdoElegido, setAcuerdoElegido] = useState<number | null>(null)
  const [fichas, setFichas] = useState<sociosService.Beneficiario[]>([])
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ exito: boolean; mensaje: string } | null>(null)

  // Al abrir: acuerdos de funeraria vigentes del titular y las fichas de su expediente
  useEffect(() => {
    if (!open) return
    setError(null)
    setResultado(null)
    setAcuerdoElegido(null)
    setSeleccionados([])
    setCargando(true)
    void (async () => {
      try {
        const [respuestaAcuerdos, respuestaFichas] = await Promise.all([
          funerariaService.obtenerAcuerdosPorSocio(socio.id),
          sociosService.obtenerBeneficiarios(socio.id, true),
        ])
        const vigentes = (respuestaAcuerdos.data ?? []).filter((a) => a.estado !== 'retirado')
        setAcuerdos(vigentes)
        setFichas(respuestaFichas.data ?? [])
        if (vigentes.length === 1) setAcuerdoElegido(vigentes[0]!.id)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setCargando(false)
      }
    })()
  }, [open, socio.id])

  // Vivos y vigentes en el acuerdo de funeraria elegido (el titular ya es el dueño del de salud)
  const candidatos = acuerdoElegido
    ? sociosService
        .beneficiariosEnAcuerdoFuneraria(fichas, acuerdoElegido)
        .filter((b) => b.fecha_retiro_funeraria === null && b.estado === 'activo' && !esTitular(b.parentesco))
    : []
  const todos = candidatos.length > 0 && candidatos.every((b) => seleccionados.includes(b.id))

  // Al cambiar de acuerdo, todos marcados
  useEffect(() => {
    if (!acuerdoElegido) return
    setSeleccionados(
      sociosService
        .beneficiariosEnAcuerdoFuneraria(fichas, acuerdoElegido)
        .filter((b) => b.fecha_retiro_funeraria === null && b.estado === 'activo' && !esTitular(b.parentesco))
        .map((b) => b.id)
    )
  }, [acuerdoElegido, fichas])

  const numeroFuneraria = acuerdos.find((a) => a.id === acuerdoElegido)?.numero_acuerdo || 'sin número'

  const copiar = async () => {
    if (!acuerdoElegido || seleccionados.length === 0) return
    setEnviando(true)
    setError(null)
    try {
      const respuesta = await saludService.importarDesdeFuneraria(numeroAcuerdoSalud, {
        beneficiario_ids: seleccionados,
        acuerdo_funeraria_id: acuerdoElegido,
      })
      const { copiados, ya_estaban, omitidos } = respuesta.data
      setResultado({
        exito: true,
        mensaje: [
          `${copiados.length} beneficiario(s) copiado(s) del acuerdo de funeraria ${numeroFuneraria} al acuerdo de salud ${numeroAcuerdoSalud}${copiados.length ? `: ${copiados.join(', ')}` : ''}.`,
          ya_estaban.length ? `Ya estaban en este acuerdo: ${ya_estaban.join(', ')}.` : '',
          omitidos.length ? `No se copiaron (titular o no activos): ${omitidos.join(', ')}.` : '',
          'En Funeraria no se cambió nada.',
        ]
          .filter(Boolean)
          .join(' '),
      })
    } catch (err) {
      setError(`No se copió ningún beneficiario. Motivo: ${getErrorMessage(err)}`)
    } finally {
      setEnviando(false)
    }
  }

  const cerrar = () => {
    if (resultado?.exito) onCompletado()
    else onClose()
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={resultado ? 'Importación desde Funeraria completada' : 'Importar desde Funeraria'}
      description={
        resultado
          ? undefined
          : `Trae beneficiarios de un acuerdo de funeraria del titular y los copia al acuerdo de salud ${numeroAcuerdoSalud}. En Funeraria no se borra nada.`
      }
      size="md"
      footer={
        resultado ? (
          <Button onClick={cerrar}>Volver al acuerdo de salud</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => void copiar()} isLoading={enviando} disabled={cargando || !acuerdoElegido || seleccionados.length === 0}>
              Importar a este acuerdo
            </Button>
          </>
        )
      }
    >
      {resultado ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">{resultado.mensaje}</div>
      ) : (
        <div className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-sm font-semibold text-neutral-900">{nombreEnMayusculas(socio.nombre_completo)}</p>
            <p className="text-xs text-neutral-500">Titular • Exp. {socio.codigo_socio}</p>
          </div>

          {cargando && (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando...
            </div>
          )}

          {!cargando && acuerdos.length === 0 && !error && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              El titular no tiene acuerdos de funeraria vigentes: no hay nada que importar.
            </p>
          )}

          {acuerdos.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">¿De qué acuerdo de funeraria?</p>
              <div className="space-y-2">
                {acuerdos.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2.5 text-sm cursor-pointer hover:bg-neutral-50"
                  >
                    <input
                      type="radio"
                      name="importar-desde-funeraria-origen"
                      checked={acuerdoElegido === a.id}
                      onChange={() => setAcuerdoElegido(a.id)}
                    />
                    <span className="font-mono font-medium">{a.numero_acuerdo || 'sin número'}</span>
                    <span className="text-neutral-500">
                      • desde {formatearFecha(a.fecha_inicio)} • {a.estado}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {acuerdoElegido && !cargando && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-neutral-700">
                  Beneficiarios del acuerdo de funeraria {numeroFuneraria} ({seleccionados.length} de {candidatos.length})
                </p>
                {candidatos.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setSeleccionados(todos ? [] : candidatos.map((b) => b.id))}>
                    {todos ? 'Quitar todos' : 'Seleccionar todos'}
                  </Button>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {candidatos.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-neutral-500">Ese acuerdo de funeraria no tiene beneficiarios activos para importar.</p>
                )}
                {candidatos.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2.5 text-sm cursor-pointer hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(b.id)}
                      onChange={(e) =>
                        setSeleccionados((prev) => (e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id)))
                      }
                    />
                    <span>
                      {b.nombre} {b.apellido} • {b.parentesco}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Quien ya está en otro acuerdo de salud también puede entrar a este. Quien ya está en este acuerdo no se repite.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
