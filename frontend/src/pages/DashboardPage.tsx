import { useAuth } from '@/hooks/useAuth'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { 
  Users, 
  DollarSign, 
  Wallet,
  ClipboardList,
  UserPlus,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import * as dashboardService from '../services/dashboardService'
import type { EstadisticasDashboard, ActividadReciente } from '../services/dashboardService'

/**
 * Página de Dashboard principal
 */
export default function DashboardPage() {
  const { user } = useAuth()

  // Estados
  const [estadisticas, setEstadisticas] = useState<EstadisticasDashboard | null>(null)
  const [actividades, setActividades] = useState<ActividadReciente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar datos al montar el componente
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true)
        setError(null)

        const [estadisticasRes, actividadesRes] = await Promise.all([
          dashboardService.obtenerEstadisticas(),
          dashboardService.obtenerActividadReciente(),
        ])

        if (estadisticasRes.success) {
          setEstadisticas(estadisticasRes.data)
        } else {
          throw new Error(estadisticasRes.error?.message || 'Error al cargar estadísticas')
        }

        if (actividadesRes.success) {
          setActividades(actividadesRes.data)
        } else {
          throw new Error(actividadesRes.error?.message || 'Error al cargar actividades')
        }
      } catch (err) {
        console.error('Error cargando dashboard:', err)
        setError(err instanceof Error ? err.message : 'Error al cargar datos del dashboard')
      } finally {
        setLoading(false)
      }
    }

    void cargarDatos()
  }, [])

  if (!user) return null

  // Formatear números
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`
    }
    return `$${num.toFixed(0)}`
  }

  // Calcular cambios (dummy por ahora - en producción se debe guardar histórico)
  const calcularCambio = (_tipo: string): { change: string; trend: 'up' | 'down' } => {
    // TODO: Implementar cálculo real con histórico
    return { change: '+0', trend: 'up' }
  }

  // Estado de carga
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  // Estado de error
  if (error || !estadisticas) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent>
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-error-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar el dashboard</h3>
              <p className="text-gray-600 mb-4">{error || 'Error desconocido'}</p>
              <Button onClick={() => window.location.reload()}>
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = [
    {
      title: 'Total Socios',
      value: estadisticas.socios.total.toLocaleString(),
      change: `+${estadisticas.socios.nuevos_hoy}`,
      trend: estadisticas.socios.nuevos_hoy > 0 ? 'up' : 'down' as const,
      icon: Users,
      color: 'primary' as const
    },
    {
      title: 'Préstamos Activos',
      value: formatNumber(estadisticas.prestamos.monto_total_usd),
      change: calcularCambio('prestamos').change,
      trend: calcularCambio('prestamos').trend,
      icon: DollarSign,
      color: 'secondary' as const
    },
    {
      title: 'Ahorros Total',
      value: formatNumber(estadisticas.ahorro.total_saldo_usd),
      change: calcularCambio('ahorro').change,
      trend: calcularCambio('ahorro').trend,
      icon: Wallet,
      color: 'accent' as const
    },
    {
      title: 'Colectas Hoy',
      value: estadisticas.colectas.hoy.toString(),
      change: calcularCambio('colectas').change,
      trend: calcularCambio('colectas').trend,
      icon: ClipboardList,
      color: 'neutral' as const
    }
  ]

  // Formatear fecha relativa
  const formatearFechaRelativa = (fecha: string): string => {
    const ahora = new Date()
    const fechaMovimiento = new Date(fecha)
    const diffMs = ahora.getTime() - fechaMovimiento.getTime()
    const diffMinutos = Math.floor(diffMs / 60000)
    
    if (diffMinutos < 1) return 'Justo ahora'
    if (diffMinutos < 60) return `Hace ${diffMinutos} min`
    
    const diffHoras = Math.floor(diffMinutos / 60)
    if (diffHoras < 24) return `Hace ${diffHoras}h`
    
    const diffDias = Math.floor(diffHoras / 24)
    return `Hace ${diffDias}d`
  }

  // Formatear monto
  const formatearMonto = (actividad: ActividadReciente): string => {
    if (!actividad.monto) return '-'
    const simbolo = actividad.moneda === 'USD' ? '$' : ''
    const sufijo = actividad.moneda === 'Bs' ? ' Bs' : ''
    return `${simbolo}${actividad.monto.toFixed(2)}${sufijo}`
  }

  // Mapeo de tipos a etiquetas legibles
  const tipoLabels: Record<string, string> = {
    'colecta': 'Colecta',
    'prestamo': 'Préstamo',
    'socio': 'Nuevo Socio',
    'ahorro': 'Ahorro',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,_rgb(var(--c-white)/0.95),_rgb(var(--c-primary-50)/0.9))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white px-4 py-2 text-sm text-primary-700 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Vista general de la operación
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
                ¡Bienvenido, {user.nombre}!
              </h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-neutral-600">
                Aquí tienes el resumen de hoy para la Cooperativa el Triunfo, con una interfaz más clara y liviana para lectura rápida.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-3xl border border-white bg-white/80 p-4 shadow-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Socios</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">
                {estadisticas.socios.total.toLocaleString()}
              </p>
            </div>
            <div className="border-x border-neutral-200 px-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Préstamos</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">
                {formatNumber(estadisticas.prestamos.monto_total_usd)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Hoy</p>
              <p className="mt-2 text-2xl font-semibold text-secondary-700">
                {estadisticas.colectas.hoy}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          const colorClasses = {
            primary: 'bg-primary-100 text-primary-600',
            secondary: 'bg-secondary-100 text-secondary-600',
            accent: 'bg-accent-100 text-accent-600',
            neutral: 'bg-neutral-100 text-neutral-600'
          }
          
          return (
            <Card key={stat.title} hover className="group bg-white/90 backdrop-blur-sm">
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-600 mb-1">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-neutral-900 mb-2 font-mono-numbers">
                      {stat.value}
                    </p>
                    <div className="flex items-center gap-1 text-sm">
                      {stat.trend === 'up' ? (
                        <ArrowUpRight className="w-4 h-4 text-secondary-600" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-error-600" />
                      )}
                      <span className={stat.trend === 'up' ? 'text-secondary-600' : 'text-error-600'}>
                        {stat.change}
                      </span>
                      <span className="text-neutral-500 ml-1">vs ayer</span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl border border-white/70 ${colorClasses[stat.color as keyof typeof colorClasses]} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card glass>
        <CardHeader title="Acciones Rápidas" description="Accesos directos a las tareas más comunes" />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="primary" size="lg" className="justify-start shadow-sm">
              <ClipboardList className="w-5 h-5" />
              Nueva Colecta
            </Button>
            <Button variant="outline" size="lg" className="justify-start bg-white/80">
              <UserPlus className="w-5 h-5" />
              Registrar Socio
            </Button>
            <Button variant="outline" size="lg" className="justify-start bg-white/80">
              <FileText className="w-5 h-5" />
              Nuevo Préstamo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card glass>
        <CardHeader title="Actividad Reciente" description="Últimas transacciones del sistema" />
        <CardContent>
          {actividades.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay actividad reciente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actividades.map((actividad) => (
                <div 
                  key={`${actividad.tipo}-${actividad.id}`}
                  className="flex cursor-pointer items-center justify-between rounded-2xl border border-transparent p-3 transition-colors group hover:border-primary-100 hover:bg-white"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,_rgba(255,107,28,0.14),_rgba(255,184,28,0.18))] text-sm font-semibold text-primary-700">
                      {actividad.socio_nombre.charAt(0)}{actividad.socio_apellido.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">
                        {actividad.socio_nombre} {actividad.socio_apellido}
                      </p>
                      <p className="text-sm text-neutral-500">{tipoLabels[actividad.tipo] || actividad.tipo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-neutral-900 font-mono-numbers">
                      {formatearMonto(actividad)}
                    </p>
                    <p className="text-sm text-neutral-500">{formatearFechaRelativa(actividad.fecha)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="ghost" className="mt-4 w-full bg-white/70">
            Ver todas las transacciones
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
