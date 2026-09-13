/**
 * ============================================
 * PAGE: AUDITORIA
 * ============================================
 * FE-025 / RF-SEG-03. Quien hizo que, cuando y sobre que registro, con los
 * valores anteriores y nuevos. Solo lectura y solo para administradores.
 */

import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, ScrollText, Search } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import apiClient, { getErrorMessage } from '../services/api'

interface Registro {
  id: number
  accion: string
  modulo: string
  registro_id: number | null
  datos_antes: unknown
  datos_despues: unknown
  ip_address: string | null
  created_at: string
  usuario: { id: number; username: string; nombre_completo: string } | null
}

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

// Mismo diseño de combo que el formulario de Socios
const selectClass = `${controlClass} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%207l3%203%203-3%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[center_right_0.5rem] bg-no-repeat pr-10`
const labelClass = 'block text-sm font-medium text-neutral-700'

const filtrosVacios = { usuario: '', modulo: '', accion: '', registro_id: '', desde: '', hasta: '' }

const Json = ({ titulo, valor }: { titulo: string; valor: unknown }) => (
  <div className="min-w-0 flex-1">
    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{titulo}</p>
    <pre className="max-h-72 overflow-auto rounded-lg bg-neutral-900 p-3 text-xs text-neutral-100">
      {valor === null || valor === undefined ? '—' : JSON.stringify(valor, null, 2)}
    </pre>
  </div>
)

export default function AuditoriaPage() {
  const [opciones, setOpciones] = useState<{ modulos: string[]; acciones: string[] }>({ modulos: [], acciones: [] })
  const [filtros, setFiltros] = useState(filtrosVacios)
  const [aplicados, setAplicados] = useState(filtrosVacios)
  const [pagina, setPagina] = useState(1)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [total, setTotal] = useState(0)
  const [paginas, setPaginas] = useState(1)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient
      .get('/auditoria/opciones')
      .then((r) => setOpciones(r.data.data))
      .catch((err) => setError(getErrorMessage(err) || 'No tiene acceso a la auditoria'))
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const params = Object.fromEntries(Object.entries(aplicados).filter(([, v]) => v.trim() !== ''))
      const r = await apiClient.get('/auditoria', { params: { ...params, page: pagina, limit: 30 } })
      setRegistros(r.data.data)
      setTotal(r.data.meta.total)
      setPaginas(Math.max(1, r.data.meta.totalPages))
    } catch (err) {
      setError(getErrorMessage(err) || 'No fue posible consultar la auditoria')
    } finally {
      setCargando(false)
    }
  }, [aplicados, pagina])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const buscar = () => {
    setPagina(1)
    setAplicados(filtros)
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-neutral-900">
          <ScrollText className="h-6 w-6 text-primary-600" />
          Auditoria
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Quien hizo que y cuando, con los valores anteriores y nuevos.</p>
      </div>

      <Card className="p-4">
        <div
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3 lg:grid-cols-7"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); buscar() } }}
        >
          <label className={labelClass}>
            <span className="mb-1.5 block">Usuario</span>
            <input value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} className={controlClass} />
          </label>
          <label className={labelClass}>
            <span className="mb-1.5 block">Modulo</span>
            <select value={filtros.modulo} onChange={(e) => setFiltros({ ...filtros, modulo: e.target.value })} className={selectClass}>
              <option value="">Todos</option>
              {opciones.modulos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            <span className="mb-1.5 block">Accion</span>
            <select value={filtros.accion} onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })} className={selectClass}>
              <option value="">Todas</option>
              {opciones.acciones.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            <span className="mb-1.5 block">Registro #</span>
            <input type="number" value={filtros.registro_id} onChange={(e) => setFiltros({ ...filtros, registro_id: e.target.value })} className={controlClass} />
          </label>
          <label className={labelClass}>
            <span className="mb-1.5 block">Desde</span>
            <input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} className={controlClass} />
          </label>
          <label className={labelClass}>
            <span className="mb-1.5 block">Hasta</span>
            <input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} className={controlClass} />
          </label>
          <Button onClick={buscar}><Search className="h-4 w-4" /> Buscar</Button>
        </div>
      </Card>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Usuario</th>
                <th className="px-3 py-3">Modulo</th>
                <th className="px-3 py-3">Accion</th>
                <th className="px-3 py-3">Registro</th>
                <th className="px-3 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {cargando ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-neutral-400" /></td></tr>
              ) : registros.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-500">Sin registros con estos filtros</td></tr>
              ) : (
                registros.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="cursor-pointer hover:bg-primary-50/40" onClick={() => setAbierto(abierto === r.id ? null : r.id)}>
                      <td className="px-3 py-2 text-neutral-400">{abierto === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString('es-VE')}</td>
                      <td className="px-3 py-2">{r.usuario ? `${r.usuario.nombre_completo} (${r.usuario.username})` : 'Proceso automatico'}</td>
                      <td className="px-3 py-2">{r.modulo}</td>
                      <td className="px-3 py-2 font-medium">{r.accion}</td>
                      <td className="px-3 py-2">{r.registro_id ?? '—'}</td>
                      <td className="px-3 py-2 text-neutral-500">{r.ip_address ?? '—'}</td>
                    </tr>
                    {abierto === r.id && (
                      <tr>
                        <td colSpan={7} className="bg-neutral-50 px-4 py-4">
                          <div className="flex flex-col gap-4 lg:flex-row">
                            <Json titulo="Valores anteriores" valor={r.datos_antes} />
                            <Json titulo="Valores nuevos" valor={r.datos_despues} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600">
          <span>{total} registro(s)</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((x) => x - 1)}>Anterior</Button>
            <span>Pagina {pagina} de {paginas}</span>
            <Button variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => setPagina((x) => x + 1)}>Siguiente</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
