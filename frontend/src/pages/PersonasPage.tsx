/**
 * ============================================
 * PAGE: PERSONAS
 * ============================================
 * Buscador de personas: la entrada a la ficha integral, donde se ve todo lo de
 * una persona con cada expediente por separado.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Contact, Loader2, Search } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { getErrorMessage } from '../services/api'
import * as personasService from '../services/personasService'
import type { PersonaListada } from '../services/personasService'

export default function PersonasPage() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [aplicada, setAplicada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [personas, setPersonas] = useState<PersonaListada[]>([])
  const [total, setTotal] = useState(0)
  const [paginas, setPaginas] = useState(1)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const espera = setTimeout(() => {
      setAplicada(busqueda.trim())
      setPagina(1)
    }, 350)
    return () => clearTimeout(espera)
  }, [busqueda])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError('')
    personasService
      .listarPersonas({ busqueda: aplicada || undefined, page: pagina, limit: 20 })
      .then((r) => {
        if (!vigente) return
        setPersonas(r.data)
        setTotal(r.meta?.total ?? r.data.length)
        setPaginas(Math.max(1, r.meta?.totalPages ?? 1))
      })
      .catch((err) => vigente && setError(getErrorMessage(err) || 'No fue posible buscar'))
      .finally(() => vigente && setCargando(false))
    return () => { vigente = false }
  }, [aplicada, pagina])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-neutral-900">
          <Contact className="h-6 w-6 text-primary-600" />
          Personas
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Una persona puede ser trabajador de feria y ahorrista a la vez. La ficha muestra cada expediente por separado.
        </p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Cedula, nombre o apellido"
            autoFocus
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </Card>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Identificacion</th>
                <th className="px-4 py-3">Persona</th>
                <th className="px-4 py-3">Telefono</th>
                <th className="px-4 py-3">Expedientes</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {cargando ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-neutral-400" /></td></tr>
              ) : personas.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-neutral-500">Sin resultados</td></tr>
              ) : (
                personas.map((p) => (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    onClick={() => navigate(`/personas/${p.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/personas/${p.id}`) }}
                    className="cursor-pointer hover:bg-primary-50/40 focus:bg-primary-50/40 focus:outline-none"
                  >
                    <td className="px-4 py-3 text-neutral-700">{p.tipo_identificacion}-{p.numero_identificacion}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{p.apellidos}, {p.nombres}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.telefono ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p._count.socios > 0 && <Badge variant="info">Ahorrista{p._count.socios > 1 ? ` ×${p._count.socios}` : ''}</Badge>}
                        {p._count.trabajadores > 0 && <Badge variant="purple">Trabajador{p._count.trabajadores > 1 ? ` ×${p._count.trabajadores}` : ''}</Badge>}
                        {p._count.socios + p._count.trabajadores === 0 && <span className="text-neutral-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">{p.estado === 'activo' ? <Badge variant="success">Activa</Badge> : <Badge variant="neutral">{p.estado}</Badge>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600">
          <span>{total} persona(s)</span>
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
