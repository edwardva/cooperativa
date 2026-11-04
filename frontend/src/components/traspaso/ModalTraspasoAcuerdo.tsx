import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Repeat, Search } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Alert } from '../ui/Alert'
import * as funerariaService from '../../services/funerariaService'
import * as saludService from '../../services/saludService'
import * as sociosService from '../../services/sociosService'
import {
  MOTIVOS_TRASPASO,
  type AccionPersonaTraspaso,
  type MotivoTraspaso,
  type ResultadoTraspaso,
  type VistaPreviaTraspaso,
} from '../../services/traspasoAcuerdo'
import { getErrorMessage } from '../../services/api'
import { formatearFecha, nombreEnMayusculas } from '../../utils/formatters'
import { valorEnMayusculas } from '../../utils/mayusculas'

/** Acuerdo a traspasar: en Funeraria se identifica por id, en Salud por número */
export interface AcuerdoATraspasar {
  clave: number | string
  numero_acuerdo: string | null
  estado: string
  fecha_inicio: string
}

export interface ModalTraspasoAcuerdoProps {
  open: boolean
  onClose: () => void
  modulo: 'funeraria' | 'salud'
  /** Si se abre desde un acuerdo ya elegido (p. ej. desde "Nuevo acuerdo"), salta la búsqueda del titular actual */
  acuerdoInicial?: AcuerdoATraspasar | null
  titularInicial?: { codigo_socio: string; nombre: string; apellido: string } | null
  /** Después de traspasar, para recargar la pantalla */
  onCompletado: (resultado: ResultadoTraspaso) => void
}

type Paso = 'origen' | 'destino' | 'revision' | 'resultado'

const ETIQUETA_ACCION: Record<AccionPersonaTraspaso, { texto: string; clase: string }> = {
  pasa: { texto: 'Pasa al expediente nuevo', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  reutiliza: { texto: 'Ya registrada en el expediente nuevo', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  otro_expediente: { texto: 'Socio de otro expediente', clase: 'bg-sky-50 text-sky-700 border-sky-200' },
  es_nuevo_titular: { texto: 'Pasa a ser el titular', clase: 'bg-primary-50 text-primary-700 border-primary-200' },
  excluida: { texto: 'No pasa', clase: 'bg-amber-50 text-amber-800 border-amber-200' },
}

/**
 * Traspaso de un acuerdo (Funeraria o Salud) a otro socio registrado, cuando
 * el titular deja de estar (fallecimiento, migración...). Pasos:
 *   1. Expediente del titular actual -> sus acuerdos -> "Traspasar"
 *   2. Expediente del socio que recibe el acuerdo
 *   3. Revisión: número que quedará, qué pasa con cada persona y su
 *      parentesco con el nuevo titular, motivo
 *   4. Resultado
 * Nada se guarda hasta confirmar en el paso 3, y entonces es todo o nada.
 */
export const ModalTraspasoAcuerdo = ({
  open,
  onClose,
  modulo,
  acuerdoInicial,
  titularInicial,
  onCompletado,
}: ModalTraspasoAcuerdoProps) => {
  const nombreModulo = modulo === 'funeraria' ? 'funeraria' : 'salud'
  const parentescos: readonly string[] =
    modulo === 'funeraria' ? sociosService.PARENTESCOS_FUNERARIA : saludService.PARENTESCOS_BENEFICIARIO_SALUD

  const [paso, setPaso] = useState<Paso>('origen')
  const [error, setError] = useState<string | null>(null)

  // Paso 1
  const [expedienteActual, setExpedienteActual] = useState('')
  const [buscandoActual, setBuscandoActual] = useState(false)
  const [titularActual, setTitularActual] = useState<{ codigo_socio: string; nombre: string; apellido: string } | null>(null)
  const [acuerdosActual, setAcuerdosActual] = useState<AcuerdoATraspasar[] | null>(null)
  const [acuerdo, setAcuerdo] = useState<AcuerdoATraspasar | null>(null)

  // Paso 2 y 3
  const [expedienteNuevo, setExpedienteNuevo] = useState('')
  const [buscandoNuevo, setBuscandoNuevo] = useState(false)
  const [vista, setVista] = useState<VistaPreviaTraspaso | null>(null)
  const [parentescoDe, setParentescoDe] = useState<Record<number, string>>({})
  const [motivo, setMotivo] = useState<MotivoTraspaso | ''>('')
  const [detalle, setDetalle] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoTraspaso | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setExpedienteActual(titularInicial?.codigo_socio ?? '')
    setTitularActual(titularInicial ?? null)
    setAcuerdosActual(null)
    setAcuerdo(acuerdoInicial ?? null)
    setExpedienteNuevo('')
    setVista(null)
    setParentescoDe({})
    setMotivo('')
    setDetalle('')
    setResultado(null)
    setPaso(acuerdoInicial ? 'destino' : 'origen')
  }, [open, acuerdoInicial, titularInicial])

  const numeroDe = (a: { numero_acuerdo: string | null }) => a.numero_acuerdo || 'sin número'

  const buscarAcuerdosActual = async () => {
    const expediente = expedienteActual.trim()
    if (!expediente) return
    setBuscandoActual(true)
    setError(null)
    setTitularActual(null)
    setAcuerdosActual(null)
    try {
      const socio = (await sociosService.buscarSocioPorExpediente(expediente)).data
      if (!socio) throw new Error(`No se encontró el expediente ${expediente}`)
      setTitularActual(socio)
      if (modulo === 'funeraria') {
        const acuerdos = (await funerariaService.obtenerAcuerdosPorSocio(socio.id)).data ?? []
        setAcuerdosActual(
          acuerdos
            .filter((a) => a.estado !== 'retirado')
            .map((a) => ({ clave: a.id, numero_acuerdo: a.numero_acuerdo, estado: a.estado, fecha_inicio: a.fecha_inicio }))
        )
      } else {
        // Las filas titulares de sus acuerdos de salud (una por número)
        const filas = (await saludService.obtenerAcuerdosPorSocio(socio.id)).data ?? []
        setAcuerdosActual(
          filas
            .filter((f) => f.numero_acuerdo && f.estado !== 'retirado' && f.beneficiario.parentesco.toLowerCase() === 'titular')
            .map((f) => ({ clave: f.numero_acuerdo!, numero_acuerdo: f.numero_acuerdo, estado: f.estado, fecha_inicio: f.fecha_inicio }))
        )
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBuscandoActual(false)
    }
  }

  const elegirAcuerdo = (a: AcuerdoATraspasar) => {
    setAcuerdo(a)
    setExpedienteNuevo('')
    setVista(null)
    setError(null)
    setPaso('destino')
  }

  const buscarNuevoTitular = async () => {
    const expediente = expedienteNuevo.trim()
    if (!expediente || !acuerdo) return
    setBuscandoNuevo(true)
    setError(null)
    try {
      const respuesta =
        modulo === 'funeraria'
          ? await funerariaService.vistaPreviaTraspaso(Number(acuerdo.clave), expediente)
          : await saludService.vistaPreviaTraspaso(String(acuerdo.clave), expediente)
      const datos = respuesta.data
      setVista(datos)
      // Parentesco de partida: el que ya tenía, si está en la lista; si no, hay que elegirlo
      const iniciales: Record<number, string> = {}
      for (const p of datos.personas) {
        if (p.requiere_parentesco) {
          const actual = parentescos.find((x) => x.toLowerCase() === p.parentesco_actual.toLowerCase())
          iniciales[p.clave] = actual ?? ''
        }
      }
      setParentescoDe(iniciales)
      setPaso('revision')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBuscandoNuevo(false)
    }
  }

  const sinParentesco = (vista?.personas ?? []).filter((p) => p.requiere_parentesco && !parentescoDe[p.clave])
  const formularioValido = !!vista && sinParentesco.length === 0 && motivo !== '' && (motivo !== 'Otro' || detalle.trim().length >= 3)

  const confirmar = async () => {
    if (!vista || !acuerdo || !formularioValido) return
    const numeroFinal = vista.numero_final || 'sin número'
    const nuevo = `${vista.nuevo_titular.nombre} ${vista.nuevo_titular.apellido}`
    if (
      !window.confirm(
        `¿Confirmas el traspaso del acuerdo de ${nombreModulo} ${numeroDe(acuerdo)} al expediente ${vista.nuevo_titular.expediente} (${nombreEnMayusculas(nuevo)})?` +
          (numeroFinal !== numeroDe(acuerdo) ? `\n\nEl acuerdo quedará con el número ${numeroFinal}.` : '') +
          '\n\nEl titular anterior sale del acuerdo; queda registrado en el historial.'
      )
    ) {
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const datos = {
        expediente: vista.nuevo_titular.expediente,
        motivo: motivo as MotivoTraspaso,
        detalle: detalle.trim() || undefined,
        parentescos: Object.entries(parentescoDe).map(([clave, parentesco]) => ({ clave: Number(clave), parentesco })),
      }
      const respuesta =
        modulo === 'funeraria'
          ? await funerariaService.confirmarTraspaso(Number(acuerdo.clave), datos)
          : await saludService.confirmarTraspaso(String(acuerdo.clave), datos)
      if (!respuesta.success) throw new Error('No fue posible completar el traspaso')
      setResultado(respuesta.data)
      setPaso('resultado')
      onCompletado(respuesta.data)
    } catch (err) {
      const mensaje = `No se traspasó el acuerdo ${numeroDe(acuerdo)}: no se cambió nada. Motivo: ${getErrorMessage(err)}`
      setError(mensaje)
      window.alert(mensaje)
    } finally {
      setEnviando(false)
    }
  }

  const titulo = `Traspaso de acuerdo de ${nombreModulo}`
  const descripcion =
    paso === 'origen'
      ? 'Paso 1 de 3: titular actual del acuerdo'
      : paso === 'destino'
      ? 'Paso 2 de 3: socio que recibe el acuerdo'
      : paso === 'revision'
      ? 'Paso 3 de 3: revisar y confirmar'
      : 'Traspaso completado'

  return (
    <Modal open={open} onClose={onClose} title={titulo} description={descripcion} size="lg">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {paso === 'origen' && (
          <>
            <Input
              label="N° de expediente del titular actual"
              value={expedienteActual}
              onChange={(e) => setExpedienteActual(valorEnMayusculas(e))}
              helperText="El socio que falleció o que ya no estará presente"
              data-enter-propio
              onKeyDown={(e) => e.key === 'Enter' && void buscarAcuerdosActual()}
              autoFocus
            />
            <Button onClick={() => void buscarAcuerdosActual()} isLoading={buscandoActual} className="w-full">
              <Search className="w-4 h-4" />
              Buscar acuerdos
            </Button>

            {titularActual && acuerdosActual && (
              <div className="space-y-2">
                <p className="text-sm text-neutral-600">
                  Acuerdos de {nombreModulo} de{' '}
                  <span className="font-medium text-neutral-900">
                    {nombreEnMayusculas(`${titularActual.apellido}, ${titularActual.nombre}`)}
                  </span>{' '}
                  ({titularActual.codigo_socio}):
                </p>
                {acuerdosActual.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Este socio no tiene acuerdos de {nombreModulo} vigentes para traspasar.
                  </div>
                ) : (
                  acuerdosActual.map((a) => (
                    <div
                      key={String(a.clave)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                    >
                      <div className="text-sm">
                        <p className="font-mono font-medium text-neutral-900">{numeroDe(a)}</p>
                        <p className="text-xs text-neutral-500">
                          {a.estado} • desde {formatearFecha(a.fecha_inicio)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => elegirAcuerdo(a)}>
                        <Repeat className="w-4 h-4" />
                        Traspaso
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {paso === 'destino' && acuerdo && (
          <>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <p>
                <span className="text-neutral-500">Acuerdo a traspasar:</span>{' '}
                <span className="font-mono font-medium">{numeroDe(acuerdo)}</span>
              </p>
              {titularActual && (
                <p>
                  <span className="text-neutral-500">Titular actual:</span>{' '}
                  <span className="font-medium">
                    {nombreEnMayusculas(`${titularActual.apellido}, ${titularActual.nombre}`)} ({titularActual.codigo_socio})
                  </span>
                </p>
              )}
            </div>
            <Input
              label="N° de expediente del socio que recibe el acuerdo"
              value={expedienteNuevo}
              onChange={(e) => setExpedienteNuevo(valorEnMayusculas(e))}
              helperText="Debe ser un socio ya registrado y activo"
              data-enter-propio
              onKeyDown={(e) => e.key === 'Enter' && void buscarNuevoTitular()}
              autoFocus
            />
            <div className="flex gap-3">
              {!acuerdoInicial && (
                <Button variant="outline" onClick={() => setPaso('origen')} className="flex-1">
                  <ArrowLeft className="w-4 h-4" />
                  Atrás
                </Button>
              )}
              <Button onClick={() => void buscarNuevoTitular()} isLoading={buscandoNuevo} className="flex-1">
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {paso === 'revision' && vista && acuerdo && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
                <p className="text-xs text-neutral-500">Titular anterior (sale del acuerdo)</p>
                <p className="font-medium text-neutral-900">
                  {nombreEnMayusculas(`${vista.titular_anterior.apellido}, ${vista.titular_anterior.nombre}`)}
                </p>
                <p className="text-xs text-neutral-500">
                  {vista.titular_anterior.expediente} • {vista.titular_anterior.cedula}
                </p>
              </div>
              {/* Solo lectura: los datos del socio se editan en el módulo de Socios */}
              <div className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm">
                <p className="text-xs text-primary-700">Nuevo titular</p>
                <p className="font-medium text-neutral-900">
                  {nombreEnMayusculas(`${vista.nuevo_titular.apellido}, ${vista.nuevo_titular.nombre}`)}
                </p>
                <p className="text-xs text-neutral-600">
                  {vista.nuevo_titular.expediente} • {vista.nuevo_titular.cedula} • Tel. {vista.nuevo_titular.telefono || 'sin dato'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              {vista.otros_acuerdos > 0 ? (
                <>
                  El nuevo titular ya tiene {vista.otros_acuerdos} acuerdo(s) de {nombreModulo}: este quedará como un acuerdo
                  aparte con el número <span className="font-mono font-semibold">{vista.numero_final}</span>.
                </>
              ) : (
                <>
                  El acuerdo conserva su número <span className="font-mono font-semibold">{numeroDe(acuerdo)}</span>.
                </>
              )}{' '}
              Se mantienen la fecha de inicio ({formatearFecha(vista.acuerdo.fecha_inicio)}), la cobertura pagada y el historial
              de pagos.
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">
                Beneficiarios y su parentesco con el nuevo titular
              </p>
              {vista.personas.length === 0 ? (
                <p className="text-sm text-neutral-500">El acuerdo no tiene beneficiarios vigentes.</p>
              ) : (
                <div className="space-y-2">
                  {vista.personas.map((p) => (
                    <div key={p.clave} className="rounded-lg border border-neutral-200 px-3 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="text-sm">
                          <p className="font-medium text-neutral-900">
                            {nombreEnMayusculas(`${p.apellido}, ${p.nombre}`)}
                            {p.estado === 'fallecido' && <span className="ml-1 text-xs text-neutral-500">(fallecido)</span>}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {p.cedula} • antes: {p.parentesco_actual}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${ETIQUETA_ACCION[p.accion].clase}`}>
                          {ETIQUETA_ACCION[p.accion].texto}
                        </span>
                      </div>
                      {p.nota && <p className="mt-1 text-xs text-neutral-600">{p.nota}</p>}
                      {p.requiere_parentesco && (
                        <div className="mt-2">
                          <Select
                            value={parentescoDe[p.clave] ?? ''}
                            onChange={(e) => setParentescoDe((prev) => ({ ...prev, [p.clave]: e.target.value }))}
                            error={!parentescoDe[p.clave] ? 'Elige el parentesco con el nuevo titular' : undefined}
                          >
                            <option value="">Parentesco con el nuevo titular...</option>
                            {parentescos.map((x) => (
                              <option key={x} value={x}>
                                {x}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Motivo del traspaso"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoTraspaso | '')}
                required
              >
                <option value="">Selecciona...</option>
                {MOTIVOS_TRASPASO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <Input
                label={motivo === 'Otro' ? 'Detalle del motivo' : 'Detalle (opcional)'}
                value={detalle}
                onChange={(e) => setDetalle(valorEnMayusculas(e))}
                maxLength={300}
                required={motivo === 'Otro'}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setPaso('destino')} className="flex-1" disabled={enviando}>
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </Button>
              <Button onClick={() => void confirmar()} isLoading={enviando} disabled={!formularioValido} className="flex-1">
                <Repeat className="w-4 h-4" />
                Confirmar traspaso
              </Button>
            </div>
          </>
        )}

        {paso === 'resultado' && resultado && (
          <>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 space-y-1">
              <p>
                El acuerdo de {nombreModulo} <span className="font-mono font-semibold">{resultado.numero_acuerdo || 'sin número'}</span>{' '}
                ahora es de{' '}
                <span className="font-semibold">
                  {nombreEnMayusculas(`${resultado.nuevo_titular.nombre} ${resultado.nuevo_titular.apellido}`)}
                </span>{' '}
                (expediente {resultado.nuevo_titular.expediente}).
              </p>
              {resultado.numero_anterior !== resultado.numero_acuerdo && (
                <p>Antes era el número {resultado.numero_anterior || 'sin número'}.</p>
              )}
              <p>Beneficiarios que siguen en el acuerdo: {resultado.pasan}.</p>
            </div>
            {resultado.excluidas.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-medium">No pasaron al acuerdo:</p>
                <ul className="list-disc pl-5">
                  {resultado.excluidas.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={onClose} className="w-full">
              Cerrar
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
