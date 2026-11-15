import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Alert } from '../ui/Alert'
import * as saludService from '../../services/saludService'
import { getErrorCode, getErrorDetalles, getErrorMessage } from '../../services/api'
import { formatearFecha, nombreEnMayusculas } from '../../utils/formatters'
import { valorEnMayusculas } from '../../utils/mayusculas'

export interface ModalImportarDesdeSaludProps {
  open: boolean
  onClose: () => void
  /** Se llama al cerrar la ventana de resultado si se copió algo, para recargar el detalle */
  onCompletado: () => void
  /** Acuerdo de funeraria abierto: es el destino */
  acuerdo: { id: number; numero_acuerdo: string | null }
  socio: { id: number; codigo_socio: string; nombre_completo: string }
}

type GrupoTitular = { numero_acuerdo: string; estado: string; fecha_inicio: string }

// El titular ya es el dueño del acuerdo de funeraria; quien no está activo no ocupa cupo
const seleccionable = (m: saludService.MiembroGrupoSalud, cedulaTitular: string | undefined) =>
  m.estado_persona === 'activo' && m.estado_acuerdo !== 'retirado' && m.cedula !== cedulaTitular

/**
 * "Importar" desde el detalle de un acuerdo de funeraria: TRAE personas de un
 * acuerdo de salud del mismo titular y las copia a ESTE acuerdo de funeraria.
 * En Salud no cambia nada. Mantiene el tope de 8 beneficiarios por acuerdo:
 * si no caben, ofrece abrir un acuerdo adicional del titular con los que
 * sobran (número propuesto expediente-N, editable).
 */
export const ModalImportarDesdeSalud = ({ open, onClose, onCompletado, acuerdo, socio }: ModalImportarDesdeSaludProps) => {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [grupos, setGrupos] = useState<GrupoTitular[]>([])
  const [grupoElegido, setGrupoElegido] = useState('')
  const [grupo, setGrupo] = useState<saludService.GrupoSalud | null>(null)
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [enviando, setEnviando] = useState(false)
  // No caben todos: número del acuerdo adicional para los que sobran
  const [limite, setLimite] = useState<saludService.LimiteFunerariaDetalles | null>(null)
  const [numeroAdicional, setNumeroAdicional] = useState('')
  const [resultado, setResultado] = useState<{ exito: boolean; mensaje: string } | null>(null)

  // Al abrir: los acuerdos de salud vigentes donde este socio es el titular
  useEffect(() => {
    if (!open) return
    setError(null)
    setResultado(null)
    setLimite(null)
    setGrupo(null)
    setGrupoElegido('')
    setSeleccionados([])
    setCargando(true)
    void (async () => {
      try {
        const respuesta = await saludService.obtenerAcuerdosPorSocio(socio.id)
        const lista = (respuesta.data ?? [])
          .filter((a) => a.numero_acuerdo && a.estado !== 'retirado' && a.beneficiario.parentesco.trim().toLowerCase() === 'titular')
          .map((a) => ({ numero_acuerdo: a.numero_acuerdo!, estado: a.estado, fecha_inicio: a.fecha_inicio }))
        setGrupos(lista)
        if (lista.length === 1) setGrupoElegido(lista[0]!.numero_acuerdo)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setCargando(false)
      }
    })()
  }, [open, socio.id])

  // Al elegir el acuerdo de salud: sus personas, todas marcadas
  useEffect(() => {
    if (!open || !grupoElegido) return
    setError(null)
    setLimite(null)
    setCargando(true)
    void (async () => {
      try {
        const respuesta = await saludService.obtenerGrupoPorNumeroAcuerdo(grupoElegido)
        setGrupo(respuesta.data)
        setSeleccionados(
          respuesta.data.beneficiarios.filter((m) => seleccionable(m, respuesta.data.socio?.cedula)).map((m) => m.beneficiario_id)
        )
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setCargando(false)
      }
    })()
  }, [open, grupoElegido])

  const candidatos = (grupo?.beneficiarios ?? []).filter((m) => seleccionable(m, grupo?.socio?.cedula))
  const todos = candidatos.length > 0 && candidatos.every((m) => seleccionados.includes(m.beneficiario_id))
  const suspendido = grupo?.estado === 'suspendido'
  const numeroFuneraria = acuerdo.numero_acuerdo || 'sin número'

  const copiar = async (conAdicional: boolean) => {
    if (!grupoElegido || seleccionados.length === 0) return
    if (conAdicional && !numeroAdicional.trim()) {
      setError('Escribe el número del acuerdo adicional.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const respuesta = await saludService.importarGrupoAFuneraria(grupoElegido, {
        beneficiario_ids: seleccionados,
        acuerdo_funeraria_id: acuerdo.id,
        ...(conAdicional ? { acuerdo_adicional: { numero_acuerdo: numeroAdicional.trim() } } : {}),
      })
      const { copiados, ya_estaban, omitidos, acuerdo_adicional } = respuesta.data
      setLimite(null)
      setResultado({
        exito: true,
        mensaje: [
          `${copiados.length} beneficiario(s) copiado(s) del acuerdo de salud ${grupoElegido} al acuerdo de funeraria ${numeroFuneraria}${copiados.length ? `: ${copiados.join(', ')}` : ''}.`,
          acuerdo_adicional
            ? `Se abrió el acuerdo de funeraria ${acuerdo_adicional.numero_acuerdo} con los que no cupieron: ${acuerdo_adicional.copiados.join(', ')}.`
            : '',
          ya_estaban.length ? `Ya estaban en este acuerdo: ${ya_estaban.join(', ')}.` : '',
          omitidos.length ? `No se copiaron (titular o no activos): ${omitidos.join(', ')}.` : '',
          'En Salud no se cambió nada.',
        ]
          .filter(Boolean)
          .join(' '),
      })
    } catch (err) {
      if (getErrorCode(err) === 'LIMITE_BENEFICIARIOS') {
        const detalles = getErrorDetalles<saludService.LimiteFunerariaDetalles>(err)
        if (detalles) {
          setLimite(detalles)
          setNumeroAdicional(detalles.numero_sugerido)
          return
        }
      }
      setError(getErrorMessage(err))
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
      title={resultado ? (resultado.exito ? 'Importación desde Salud completada' : 'No se completó la importación') : 'Importar desde Salud'}
      description={
        resultado
          ? undefined
          : `Trae beneficiarios de un acuerdo de salud del titular y los copia al acuerdo de funeraria ${numeroFuneraria}. En Salud no se borra nada.`
      }
      size="md"
      footer={
        resultado ? (
          <Button onClick={cerrar}>Volver al acuerdo de funeraria</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {limite ? (
              <Button onClick={() => void copiar(true)} isLoading={enviando}>
                Copiar y abrir acuerdo adicional
              </Button>
            ) : (
              <Button
                onClick={() => void copiar(false)}
                isLoading={enviando}
                disabled={cargando || !grupo || seleccionados.length === 0 || suspendido}
              >
                Importar a este acuerdo
              </Button>
            )}
          </>
        )
      }
    >
      {resultado ? (
        <div
          className={
            resultado.exito
              ? 'rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800'
              : 'rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700'
          }
        >
          {resultado.mensaje}
        </div>
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

          {!cargando && grupos.length === 0 && !error && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              El titular no tiene acuerdos de salud vigentes: no hay nada que importar.
            </p>
          )}

          {grupos.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">¿De qué acuerdo de salud?</p>
              <div className="space-y-2">
                {grupos.map((g) => (
                  <label
                    key={g.numero_acuerdo}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2.5 text-sm cursor-pointer hover:bg-neutral-50"
                  >
                    <input
                      type="radio"
                      name="importar-desde-salud-origen"
                      checked={grupoElegido === g.numero_acuerdo}
                      onChange={() => setGrupoElegido(g.numero_acuerdo)}
                    />
                    <span className="font-mono font-medium">{g.numero_acuerdo}</span>
                    <span className="text-neutral-500">
                      • desde {formatearFecha(g.fecha_inicio)} • {g.estado}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {grupo && !cargando && (
            <div>
              {suspendido && (
                <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  El acuerdo de salud {grupoElegido} está suspendido: reactívelo en Salud antes de importar.
                </p>
              )}
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-neutral-700">
                  Beneficiarios del acuerdo de salud {grupoElegido} ({seleccionados.length} de {candidatos.length})
                </p>
                {candidatos.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSeleccionados(todos ? [] : candidatos.map((m) => m.beneficiario_id))}
                  >
                    {todos ? 'Quitar todos' : 'Seleccionar todos'}
                  </Button>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {candidatos.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-neutral-500">Ese acuerdo de salud no tiene beneficiarios activos para importar.</p>
                )}
                {candidatos.map((m) => (
                  <label
                    key={m.beneficiario_id}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2.5 text-sm cursor-pointer hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(m.beneficiario_id)}
                      disabled={!!limite}
                      onChange={(e) =>
                        setSeleccionados((prev) =>
                          e.target.checked ? [...prev, m.beneficiario_id] : prev.filter((id) => id !== m.beneficiario_id)
                        )
                      }
                    />
                    <span>
                      {m.nombre} {m.apellido} • {m.parentesco}
                      {m.expediente_propio && <span className="text-neutral-500"> • exp. {m.expediente_propio}</span>}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Quien ya está en otro acuerdo de funeraria también puede entrar a este. Quien ya está en este acuerdo no se repite.
              </p>
            </div>
          )}

          {limite && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p>
                El acuerdo {numeroFuneraria} admite hasta 8 beneficiarios y solo le quedan {limite.cupos} cupo(s).
                {limite.al_elegido.length > 0 && <> Entran aquí: {limite.al_elegido.join(', ')}.</>}
              </p>
              <p>
                Para los demás ({limite.sobrantes.join(', ')}) se abrirá <strong>un acuerdo de funeraria adicional</strong> a nombre
                del mismo titular.
              </p>
              <Input
                label="N° del acuerdo adicional"
                value={numeroAdicional}
                onChange={(e) => setNumeroAdicional(valorEnMayusculas(e))}
                maxLength={20}
                helperText="Propuesto como expediente-número; puedes modificarlo"
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
