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
  Sparkles
} from 'lucide-react'

/**
 * Página de Dashboard principal
 */
export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  const stats = [
    {
      title: 'Total Socios',
      value: '9,585',
      change: '+12',
      trend: 'up',
      icon: Users,
      color: 'primary'
    },
    {
      title: 'Préstamos Activos',
      value: '$145.5K',
      change: '+5.2%',
      trend: 'up',
      icon: DollarSign,
      color: 'secondary'
    },
    {
      title: 'Ahorros Total',
      value: '$892.3K',
      change: '+8.1%',
      trend: 'up',
      icon: Wallet,
      color: 'accent'
    },
    {
      title: 'Colectas Hoy',
      value: '247',
      change: '-3',
      trend: 'down',
      icon: ClipboardList,
      color: 'neutral'
    }
  ]

  const recentActivity = [
    { type: 'Colecta', socio: 'Juan Pérez', monto: '$45.00', fecha: 'Hace 5 min' },
    { type: 'Préstamo', socio: 'María González', monto: '$2,500.00', fecha: 'Hace 12 min' },
    { type: 'Nuevo Socio', socio: 'Carlos Ramírez', monto: '-', fecha: 'Hace 23 min' },
    { type: 'Ahorro', socio: 'Ana Martínez', monto: '$100.00', fecha: 'Hace 35 min' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(255,247,237,0.9))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-8">
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
              <p className="mt-2 text-2xl font-semibold text-neutral-900">9,585</p>
            </div>
            <div className="border-x border-neutral-200 px-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Préstamos</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">$145K</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Hoy</p>
              <p className="mt-2 text-2xl font-semibold text-secondary-700">247</p>
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
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div 
                key={index}
                className="flex cursor-pointer items-center justify-between rounded-2xl border border-transparent p-3 transition-colors group hover:border-primary-100 hover:bg-white"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,_rgba(255,107,28,0.14),_rgba(255,184,28,0.18))] text-sm font-semibold text-primary-700">
                    {activity.socio.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">
                      {activity.socio}
                    </p>
                    <p className="text-sm text-neutral-500">{activity.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-neutral-900 font-mono-numbers">{activity.monto}</p>
                  <p className="text-sm text-neutral-500">{activity.fecha}</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" className="mt-4 w-full bg-white/70">
            Ver todas las transacciones
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
