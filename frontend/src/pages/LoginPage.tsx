import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import logo from '@/logoR.png'

// Esquema de validación
const loginSchema = z.object({
  username: z.string().min(1, 'Usuario es requerido'),
  password: z.string().min(1, 'Contraseña es requerida'),
})

type LoginFormData = z.infer<typeof loginSchema>

/**
 * Página de Login
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, isLoading, error, clearError } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  // Limpiar error al desmontar
  useEffect(() => {
    return () => clearError()
  }, [clearError])

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data)
      // La redirección se maneja en el useEffect de arriba
    } catch (error) {
      // El error se maneja en el store
      console.error('Error en login:', error)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,184,28,0.18),_transparent_28%),radial-gradient(circle_at_right,_rgba(58,122,44,0.14),_transparent_24%),linear-gradient(135deg,_rgb(var(--c-fondo-1))_0%,_rgb(var(--c-fondo-2))_45%,_rgb(var(--c-primary-50))_100%)] flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-60 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-200/35 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-secondary-200/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-5xl grid overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden flex-col justify-between border-r border-neutral-200/70 bg-[linear-gradient(180deg,_rgb(var(--c-primary-50)/0.95),_rgb(var(--c-white)/0.92))] p-10 lg:flex">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-primary-200 bg-white px-4 py-2 text-sm text-primary-700 shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-secondary-500" />
              Entorno de producción
            </div>

            <div className="space-y-4">
              <h1 className="max-w-md text-4xl font-semibold tracking-tight text-neutral-900">
                Acceso seguro para la operación diaria.
              </h1>
              <p className="max-w-md text-base leading-7 text-neutral-600">
                Ingresa al sistema para gestionar socios, caja, préstamos y movimientos con una interfaz clara, estable y pensada para trabajo en producción.
              </p>
            </div>

            <div className="rounded-3xl border border-white bg-white/80 p-5 shadow-sm">
              <p className="text-sm font-semibold text-neutral-900">Uso recomendado</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Mantén esta pantalla abierta solo para personal autorizado. Toda la actividad se registra dentro del sistema de la cooperativa.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-primary-100 bg-white/85 p-5 shadow-sm">
            <p className="text-sm font-medium text-neutral-700">Cooperativa el Triunfo, R.L.</p>
            <p className="mt-2 text-xs leading-6 text-neutral-500">
              Plataforma operativa para el manejo diario de producción, con colores suaves y foco en legibilidad.
            </p>
          </div>
        </section>

        <section className="p-6 sm:p-8 lg:p-10">
          {/* Logo y título */}
          <div className="space-y-4 text-center">
            <div className="mx-auto flex items-center justify-center">
              <div className="rounded-3xl border border-primary-100 bg-white px-5 py-4 shadow-sm">
                <img src={logo} alt="Cooperativa el Triunfo" className="h-16 w-auto object-contain" />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-700">Acceso al sistema</h2>
              <h1 className="mt-2 text-3xl font-bold text-neutral-900">Iniciar Sesión</h1>
              <p className="mt-2 text-sm text-neutral-600">Cooperativa el Triunfo</p>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            {/* Error global */}
            {error && (
              <div className="rounded-2xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                {error}
              </div>
            )}

            {/* Campo Usuario */}
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-neutral-700">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                {...register('username')}
                className={`w-full rounded-2xl border bg-white px-4 py-3 text-neutral-900 shadow-sm transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 ${
                  errors.username ? 'border-error-400' : 'border-neutral-200'
                }`}
                placeholder="Ingresa tu usuario"
              />
              {errors.username && (
                <p className="mt-2 text-sm text-error-600">{errors.username.message}</p>
              )}
            </div>

            {/* Campo Contraseña */}
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-neutral-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className={`w-full rounded-2xl border bg-white px-4 py-3 pr-12 text-neutral-900 shadow-sm transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 ${
                    errors.password ? 'border-error-400' : 'border-neutral-200'
                  }`}
                  placeholder="Ingresa tu contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 transition-colors hover:text-neutral-700"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-error-600">{errors.password.message}</p>
              )}
            </div>

            {/* Botón de submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,_#ff6b1c_0%,_#ffb81c_100%)] py-3.5 font-semibold text-on-accent shadow-lg shadow-primary-200 transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Footer con usuarios de prueba (solo en desarrollo) */}
          {import.meta.env.DEV && (
            <div className="mt-6 border-t border-neutral-200 pt-4">
              <details className="text-xs text-neutral-600">
                <summary className="cursor-pointer font-medium hover:text-neutral-900">
                  Usuarios de prueba
                </summary>
                <div className="mt-2 space-y-1 rounded-2xl bg-neutral-50 p-3 font-mono">
                  <div>admin / password123</div>
                  <div>caja1 / password123</div>
                  <div>analista1 / password123</div>
                </div>
              </details>
            </div>
          )}
          <div className="mt-6 text-center text-sm text-neutral-500 lg:text-left">
            <p>© 2026 Cooperativa el Triunfo</p>
          </div>
        </section>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-neutral-500 lg:hidden">
        Cooperativa el Triunfo
      </div>
    </div>
  )
}
