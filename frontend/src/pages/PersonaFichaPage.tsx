/**
 * ============================================
 * PAGE: FICHA INTEGRAL DE LA PERSONA
 * ============================================
 * HU-20 / FE-021. Todo lo de una persona, con cada expediente por separado:
 * lo que hizo como trabajador de feria no se mezcla con lo que hizo como
 * ahorrista. Solo lectura: cada accion se hace desde su modulo.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Contact, Loader2 } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { getErrorMessage } from '../services/api'
import * as personasService from '../services/personasService'
import type { FichaPersona } from '../services/personasService'

type Pestana = 'general' | 'trabajo' | 'salud' | 'ahorro' | 'colectas' | 'prestamos' | 'servicios' | 'historial'

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'general', texto: 'General' },
  { id: 'trabajo', texto: 'Trabajo' },
  { id: 'salud', texto: 'Salud' },
  { id: 'ahorro', texto: 'Ahorro' },
  { id: 'colectas', texto: 'Colectas' },
  { id: 'prestamos', texto: 'Prestamos' },
  { id: 'servicios', texto: 'Servicios' },
  { id: 'historial', texto: 'Historial' },
]

/** Columnas DATE: tal cual, sin zona horaria */
const dia = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
/** Marcas de tiempo: en la hora local */
const momento = (iso: string) => new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
const money = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const badgeEstado = (estado: string) => {
  if (['activo', 'vigente', 'pagada'].includes(estado)) return <Badge variant="success">{estado}</Badge>
  if (['suspendido', 'atrasado', 'moroso'].includes(estado)) return <Badge variant="warning">{estado}</Badge>
  if (['retirado', 'anulado', 'invalido', 'fallecido'].includes(estado)) return <Badge variant="error">{estado}</Badge>
  return <Badge variant="neutral">{estado}</Badge>
}

const Tabla = ({ columnas, children, vacio }: { columnas: string[]; children: React.ReactNode; vacio?: boolean }) => (
  <div className="overflow-x-auto rounded-lg border border-neutral-200">
    <table className="w-full text-sm">
      <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
        <tr>{columnas.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {vacio ? <tr><td colSpan={columnas.length} className="px-3 py-6 text-center text-neutral-500">Sin registros</td></tr> : children}
      </tbody>
    </table>
  </div>
)

const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-neutral-500">{titulo}</p>
    <div className="mt-1 text-sm font-medium text-neutral-900">{children}</div>
  </div>
)

const Aviso = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">{children}</p>
)

export default function PersonaFichaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ficha, setFicha] = useState<FichaPersona | null>(null)
  const [error, setError] = useState('')
  const [pestana, setPestana] = useState<Pestana>('general')

  useEffect(() => {
    let vigente = true
    setFicha(null)
    setError('')
    personasService
      .obtenerFicha(Number(id))
      .then((r) => vigente && setFicha(r.data))
      .catch((err) => vigente && setError(getErrorMessage(err) || 'No fue posible cargar la ficha'))
    return () => { vigente = false }
  }, [id])

  if (error) return <div className="p-6"><p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p></div>
  if (!ficha) return <div className="p-10"><Loader2 className="mx-auto h-8 w-8 animate-spin text-neutral-400" /></div>

  const { persona, trabajadores, ahorristas } = ficha
  const sinAhorrista = <Aviso>La persona no tiene expediente de ahorrista.</Aviso>
  const sinTrabajador = <Aviso>La persona no tiene expediente de trabajador de feria.</Aviso>

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-neutral-900">
              <Contact className="h-6 w-6 text-primary-600" />
              {persona.apellidos}, {persona.nombres}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {persona.tipo_identificacion}-{persona.numero_identificacion}
              {persona.telefono ? ` · ${persona.telefono}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {badgeEstado(persona.estado)}
            {ahorristas.length > 0 && <Badge variant="info">Ahorrista</Badge>}
            {trabajadores.length > 0 && <Badge variant="purple">Trabajador</Badge>}
          </div>
        </div>
      </Card>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${pestana === p.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {/* ============ GENERAL ============ */}
      {pestana === 'general' && (
        <div className="space-y-5">
          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <Dato titulo="Nacimiento">{dia(persona.fecha_nacimiento)}</Dato>
            <Dato titulo="Sexo">{persona.sexo === 'F' ? 'Femenino' : persona.sexo === 'M' ? 'Masculino' : '—'}</Dato>
            <Dato titulo="Correo">{persona.email ?? '—'}</Dato>
            <Dato titulo="Registrada">{dia(persona.created_at)}</Dato>
            <div className="col-span-2 sm:col-span-4"><Dato titulo="Direccion">{persona.direccion ?? '—'}</Dato></div>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold text-neutral-800">Como trabajador de feria</p>
              {trabajadores.length === 0 ? <p className="text-sm text-neutral-500">No es trabajador.</p> : trabajadores.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm">
                  <span className="font-mono">{t.codigo_trabajador}</span>
                  <span>{t.feria_actual ? t.feria_actual.codigo : 'sin feria'}</span>
                  {badgeEstado(t.estado)}
                </div>
              ))}
            </Card>
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold text-neutral-800">Como ahorrista</p>
              {ahorristas.length === 0 ? <p className="text-sm text-neutral-500">No es ahorrista.</p> : ahorristas.map((a) => (
                <div key={a.socio.id} className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm">
                  <span className="font-mono">{a.socio.codigo_socio}</span>
                  <span>Ahorro ${money(a.saldo_ahorro_usd)}</span>
                  <span>{a.prestamos.actuales.length} prestamo(s)</span>
                  {badgeEstado(a.socio.estado)}
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {/* ============ TRABAJO ============ */}
      {pestana === 'trabajo' && (trabajadores.length === 0 ? sinTrabajador : (
        <div className="space-y-5">
          {trabajadores.map((t) => (
            <Card key={t.id} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Dato titulo="Codigo">{t.codigo_trabajador}</Dato>
                <Dato titulo="Estado">{badgeEstado(t.estado)}</Dato>
                <Dato titulo="Ingreso">{dia(t.fecha_ingreso)}</Dato>
                <Dato titulo="Feria actual">{t.feria_actual ? `${t.feria_actual.codigo} desde ${dia(t.feria_actual.desde)}` : '—'}</Dato>
                <Dato titulo="Prueba">{t.prueba.cumplida ? `Cumplida el ${dia(t.prueba.fin_prueba)}` : `Hasta ${dia(t.prueba.fin_prueba)}`}</Dato>
                {t.fecha_salida && <Dato titulo="Salida">{dia(t.fecha_salida)} · {t.motivo_salida}</Dato>}
              </div>
              <Tabla columnas={['Feria', 'Desde', 'Hasta', 'Motivo']} vacio={t.ferias.length === 0}>
                {t.ferias.map((f) => (
                  <tr key={f.id}>
                    <td className="px-3 py-2">{f.feria.codigo} · {f.feria.nombre}</td>
                    <td className="px-3 py-2">{dia(f.fecha_inicio)}</td>
                    <td className="px-3 py-2">{f.fecha_fin ? dia(f.fecha_fin) : <Badge variant="success">Actual</Badge>}</td>
                    <td className="px-3 py-2 text-neutral-600">{f.motivo_cambio ?? '—'}</td>
                  </tr>
                ))}
              </Tabla>
              <p className="text-right text-sm"><Link to="/trabajadores" className="text-primary-700 hover:underline">Ir a Trabajadores</Link></p>
            </Card>
          ))}
        </div>
      ))}

      {/* ============ SALUD ============ */}
      {pestana === 'salud' && (
        <div className="space-y-5">
          <Card className="space-y-3 p-5">
            <p className="text-sm font-semibold text-neutral-800">Salud como trabajador (la paga la feria)</p>
            {trabajadores.length === 0 ? <p className="text-sm text-neutral-500">No es trabajador.</p> : trabajadores.map((t) => (
              <div key={t.id} className="space-y-2">
                <p className="text-sm text-neutral-600">{t.codigo_trabajador}: {t.salud.detalle}</p>
                <Tabla columnas={['Periodo', 'Feria', 'Pagado el', 'Referencia', 'Monto', 'Estado']} vacio={t.pagos_salud.length === 0}>
                  {t.pagos_salud.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2">{p.periodo}</td>
                      <td className="px-3 py-2">{p.feria.codigo}</td>
                      <td className="px-3 py-2">{dia(p.pago.fecha_pago)}</td>
                      <td className="px-3 py-2">{p.pago.referencia ?? '—'}</td>
                      <td className="px-3 py-2">${money(p.monto_usd)}</td>
                      <td className="px-3 py-2">{badgeEstado(p.estado === 'vigente' ? 'pagada' : 'anulado')}</td>
                    </tr>
                  ))}
                </Tabla>
              </div>
            ))}
          </Card>
          <Card className="space-y-3 p-5">
            <p className="text-sm font-semibold text-neutral-800">Salud voluntaria como ahorrista</p>
            {ahorristas.length === 0 ? <p className="text-sm text-neutral-500">No es ahorrista.</p> : (
              <Tabla columnas={['Expediente', 'Plan', 'Beneficiario', 'Pagado hasta', 'Pendientes', 'Estado']} vacio={!ahorristas.some((a) => a.servicios.some((s) => s.servicio === 'salud'))}>
                {ahorristas.flatMap((a) => a.servicios.filter((s) => s.servicio === 'salud').map((s) => (
                  <tr key={`${a.socio.id}-${s.acuerdo_id}`}>
                    <td className="px-3 py-2 font-mono">{a.socio.codigo_socio}</td>
                    <td className="px-3 py-2">{s.plan}</td>
                    <td className="px-3 py-2">{s.beneficiario}</td>
                    <td className="px-3 py-2">{s.pagado_hasta}</td>
                    <td className="px-3 py-2">{s.semanas_pendientes}</td>
                    <td className="px-3 py-2">{badgeEstado(s.estado)}</td>
                  </tr>
                )))}
              </Tabla>
            )}
          </Card>
        </div>
      )}

      {/* ============ AHORRO ============ */}
      {pestana === 'ahorro' && (ahorristas.length === 0 ? sinAhorrista : (
        <div className="space-y-5">
          {ahorristas.map((a) => (
            <Card key={a.socio.id} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Dato titulo="Expediente">{a.socio.codigo_socio}</Dato>
                <Dato titulo="Estado">{badgeEstado(a.socio.estado)}</Dato>
                <Dato titulo="Afiliacion">{dia(a.socio.fecha_inscripcion)}</Dato>
                <Dato titulo="Saldo de ahorro">${money(a.saldo_ahorro_usd)}</Dato>
              </div>
              <Tabla columnas={['Cuenta', 'Tipo', 'Saldo USD', 'Saldo Bs', 'Bloqueado', 'Disponible', 'Estado']} vacio={a.cuentas.length === 0}>
                {a.cuentas.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-mono">{c.numero_cuenta}</td>
                    <td className="px-3 py-2">{c.tipo}</td>
                    <td className="px-3 py-2">${money(c.saldo_usd)}</td>
                    <td className="px-3 py-2">Bs {money(c.saldo_bs)}</td>
                    <td className="px-3 py-2">${money(c.bloqueado_usd)}</td>
                    <td className="px-3 py-2">${money(c.disponible_usd)}</td>
                    <td className="px-3 py-2">{badgeEstado(c.estado ? 'activo' : 'inactivo')}</td>
                  </tr>
                ))}
              </Tabla>
            </Card>
          ))}
        </div>
      ))}

      {/* ============ COLECTAS ============ */}
      {pestana === 'colectas' && (ahorristas.length === 0 ? sinAhorrista : (
        <div className="space-y-5">
          {ahorristas.map((a) => (
            <Card key={a.socio.id} className="space-y-4 p-5">
              <p className="text-sm font-semibold text-neutral-800">Expediente {a.socio.codigo_socio}</p>
              {a.semanas ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Dato titulo="Ultima semana pagada">{a.semanas.ultima_semana_pagada}</Dato>
                  <Dato titulo="Semana actual">{a.semanas.semana_actual}</Dato>
                  <Dato titulo="Semanas pendientes">{a.semanas.semanas_pendientes}</Dato>
                  <Dato titulo="Semanas adelantadas">{a.semanas.semanas_adelantadas}</Dato>
                </div>
              ) : <p className="text-sm text-neutral-500">Sin servicios con cobertura semanal.</p>}
              <Tabla columnas={['Colecta #', 'Fecha', 'Semanas', 'Total USD', 'Estado']} vacio={a.colectas_recientes.length === 0}>
                {a.colectas_recientes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">{c.id}</td>
                    <td className="px-3 py-2">{momento(c.fecha_colecta)}</td>
                    <td className="px-3 py-2">{c.semanas_cobradas}</td>
                    <td className="px-3 py-2">${money(c.monto_total_usd)}</td>
                    <td className="px-3 py-2">{c.reversada ? <span title={c.motivo_reverso ?? ''}>{badgeEstado('anulado')}</span> : badgeEstado('vigente')}</td>
                  </tr>
                ))}
              </Tabla>
              <p className="text-xs text-neutral-500">Ultimas 10 colectas. El detalle completo esta en Reportes, en Colectas.</p>
            </Card>
          ))}
        </div>
      ))}

      {/* ============ PRESTAMOS ============ */}
      {pestana === 'prestamos' && (ahorristas.length === 0 ? sinAhorrista : (
        <div className="space-y-5">
          {ahorristas.map((a) => (
            <Card key={a.socio.id} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Dato titulo="Expediente">{a.socio.codigo_socio}</Dato>
                <Dato titulo="Saldo pendiente">${money(a.prestamos.saldo_total_usd)}</Dato>
                <Dato titulo="Cuotas pagadas">{a.prestamos.cuotas_pagadas}</Dato>
                <Dato titulo="Cuotas pendientes">{a.prestamos.cuotas_pendientes}</Dato>
              </div>
              {(['actuales', 'anteriores'] as const).map((grupo) => (
                <div key={grupo} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Prestamos {grupo}</p>
                  <Tabla columnas={['Prestamo', 'Tipo', 'Otorgado', 'Deuda', 'Cuotas', 'Vencidas', 'Desembolso', 'Estado']} vacio={a.prestamos[grupo].length === 0}>
                    {a.prestamos[grupo].map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-mono">{p.numero_prestamo}</td>
                        <td className="px-3 py-2">{p.tipo}</td>
                        <td className="px-3 py-2">${money(p.monto_original_usd)}</td>
                        <td className="px-3 py-2">${money(p.deuda_total_usd)}</td>
                        <td className="px-3 py-2">{p.cuotas_pagadas} de {p.cuotas_totales}</td>
                        <td className="px-3 py-2">{p.cuotas_vencidas}</td>
                        <td className="px-3 py-2">{dia(p.fecha_desembolso)}</td>
                        <td className="px-3 py-2">{badgeEstado(p.estado)}</td>
                      </tr>
                    ))}
                  </Tabla>
                </div>
              ))}
            </Card>
          ))}
        </div>
      ))}

      {/* ============ SERVICIOS ============ */}
      {pestana === 'servicios' && (
        <div className="space-y-5">
          {trabajadores.some((t) => t.salud.asignada) && (
            <Aviso>Como trabajador tiene salud asignada automaticamente por su feria (ver pestaña Salud).</Aviso>
          )}
          {ahorristas.length === 0 ? sinAhorrista : ahorristas.map((a) => (
            <Card key={a.socio.id} className="space-y-3 p-5">
              <p className="text-sm font-semibold text-neutral-800">Servicios contratados · expediente {a.socio.codigo_socio}</p>
              <Tabla columnas={['Servicio', 'Plan', 'Acuerdo', 'Beneficiario', 'Pagado hasta', 'Pendientes', 'Adelantadas', 'Situacion', 'Estado']} vacio={a.servicios.length === 0}>
                {a.servicios.map((s) => (
                  <tr key={`${s.servicio}-${s.acuerdo_id}`}>
                    <td className="px-3 py-2">{s.servicio === 'salud' ? 'Salud' : 'Funeraria'}</td>
                    <td className="px-3 py-2">{s.plan}</td>
                    <td className="px-3 py-2 font-mono">{s.numero_acuerdo ?? '—'}</td>
                    <td className="px-3 py-2">{s.beneficiario} <span className="text-xs text-neutral-500">({s.parentesco})</span></td>
                    <td className="px-3 py-2">{s.pagado_hasta}</td>
                    <td className="px-3 py-2">{s.semanas_pendientes}</td>
                    <td className="px-3 py-2">{s.semanas_adelantadas}</td>
                    <td className="px-3 py-2">{badgeEstado(s.estado_calculado)}</td>
                    <td className="px-3 py-2">{badgeEstado(s.estado)}</td>
                  </tr>
                ))}
              </Tabla>
            </Card>
          ))}
        </div>
      )}

      {/* ============ HISTORIAL ============ */}
      {pestana === 'historial' && (
        <div className="space-y-5">
          <Card className="space-y-3 p-5">
            <p className="text-sm font-semibold text-neutral-800">Suspensiones y retiros de servicios</p>
            <Tabla columnas={['Expediente', 'Servicio', 'Plan', 'Beneficiario', 'Suspendido', 'Retirado', 'Estado']} vacio={ficha.suspensiones.length === 0}>
              {ficha.suspensiones.map((s, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono">{s.expediente}</td>
                  <td className="px-3 py-2">{s.servicio}</td>
                  <td className="px-3 py-2">{s.plan}</td>
                  <td className="px-3 py-2">{s.beneficiario}</td>
                  <td className="px-3 py-2">{dia(s.fecha_suspension)}</td>
                  <td className="px-3 py-2">{dia(s.fecha_retiro)}{s.motivo_retiro ? ` · ${s.motivo_retiro}` : ''}</td>
                  <td className="px-3 py-2">{badgeEstado(s.estado)}</td>
                </tr>
              ))}
            </Tabla>
            <p className="text-xs text-neutral-500">La suspension y reactivacion del socio (regla de la semana 41) se agrega en el Sprint F.</p>
          </Card>
          <Card className="space-y-3 p-5">
            <p className="text-sm font-semibold text-neutral-800">Cambios registrados en sus expedientes</p>
            <Tabla columnas={['Fecha', 'Usuario', 'Modulo', 'Accion', 'Registro']} vacio={ficha.historial.length === 0}>
              {ficha.historial.map((h) => (
                <tr key={h.id}>
                  <td className="px-3 py-2">{momento(h.created_at)}</td>
                  <td className="px-3 py-2">{h.usuario?.nombre_completo ?? '—'}</td>
                  <td className="px-3 py-2">{h.modulo}</td>
                  <td className="px-3 py-2">{h.accion}</td>
                  <td className="px-3 py-2">{h.registro_id ?? '—'}</td>
                </tr>
              ))}
            </Tabla>
          </Card>
        </div>
      )}
    </div>
  )
}
