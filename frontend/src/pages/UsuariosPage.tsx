import { useEffect, useMemo, useState } from 'react'
import { KeyRound, Loader2, Plus, Shield, UserCog, Users } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import * as usuariosService from '../services/usuariosService'
import type { RolResumen, Usuario } from '../services/usuariosService'
import { getErrorMessage } from '../services/api'
import { useAuthStore, usePermissions } from '../store/authStore'
import { formatearFecha } from '../utils/formatters'

type Formulario = {
  username: string
  nombre_completo: string
  email: string
  rol_id: string
  password: string
}

const VACIO: Formulario = { username: '', nombre_completo: '', email: '', rol_id: '', password: '' }

const CLAVE_MINIMA = 8

/**
 * Usuarios del sistema. Hasta ahora las altas y los cambios de clave se hacían
 * por consola: la cooperativa no podía dar de alta a un cajero sin nosotros.
 */
export const UsuariosPage = () => {
  const { hasPermission } = usePermissions()
  const yo = useAuthStore((s) => s.user)
  const puedeCrear = hasPermission('usuarios', 'create')
  const puedeEditar = hasPermission('usuarios', 'update')

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<RolResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const [modal, setModal] = useState<'nuevo' | 'editar' | 'clave' | null>(null)
  const [seleccionado, setSeleccionado] = useState<Usuario | null>(null)
  const [form, setForm] = useState<Formulario>(VACIO)
  const [clave, setClave] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      const [u, r] = await Promise.all([usuariosService.listarUsuarios(), usuariosService.listarRoles()])
      if (u.success) setUsuarios(u.data)
      if (r.success) setRoles(r.data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return usuarios
    return usuarios.filter((u) =>
      [u.username, u.nombre_completo, u.email ?? '', u.rol.nombre].some((c) => c.toLowerCase().includes(t))
    )
  }, [usuarios, busqueda])

  const abrirNuevo = () => {
    setForm({ ...VACIO, rol_id: String(roles.find((r) => r.nombre === 'cajero')?.id ?? roles[0]?.id ?? '') })
    setSeleccionado(null)
    setModal('nuevo')
  }

  const abrirEditar = (u: Usuario) => {
    setSeleccionado(u)
    setForm({
      username: u.username,
      nombre_completo: u.nombre_completo,
      email: u.email ?? '',
      rol_id: String(u.rol.id),
      password: '',
    })
    setModal('editar')
  }

  const abrirClave = (u: Usuario) => {
    setSeleccionado(u)
    setClave('')
    setModal('clave')
  }

  const cerrar = () => {
    setModal(null)
    setSeleccionado(null)
    setForm(VACIO)
    setClave('')
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      if (modal === 'nuevo') {
        const r = await usuariosService.crearUsuario({
          username: form.username.trim().toLowerCase(),
          nombre_completo: form.nombre_completo.trim(),
          email: form.email.trim() || undefined,
          rol_id: Number(form.rol_id),
          password: form.password,
        })
        if (r.success) setAviso(`Usuario ${r.data.username} creado`)
      } else if (modal === 'editar' && seleccionado) {
        const r = await usuariosService.actualizarUsuario(seleccionado.id, {
          nombre_completo: form.nombre_completo.trim(),
          email: form.email.trim() || null,
          rol_id: Number(form.rol_id),
        })
        if (r.success) setAviso(`Usuario ${r.data.username} actualizado`)
      } else if (modal === 'clave' && seleccionado) {
        const r = await usuariosService.restablecerClave(seleccionado.id, clave)
        if (r.success) setAviso(r.data.message)
      }
      cerrar()
      await cargar()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  const cambiarEstado = async (u: Usuario) => {
    const nuevo = u.estado === 'activo' ? 'inactivo' : 'activo'
    if (!window.confirm(`¿${nuevo === 'inactivo' ? 'Desactivar' : 'Activar'} a ${u.username}?`)) return
    setError(null)
    try {
      await usuariosService.actualizarUsuario(u.id, { estado: nuevo })
      setAviso(`${u.username} quedó ${nuevo}`)
      await cargar()
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  const formValido =
    modal === 'clave'
      ? clave.length >= CLAVE_MINIMA
      : form.nombre_completo.trim().length >= 3 &&
        !!form.rol_id &&
        (modal === 'editar' || (form.username.trim().length >= 3 && form.password.length >= CLAVE_MINIMA))

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-neutral-900">
              <Users className="h-7 w-7 text-primary-600" />
              Usuarios
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Quién entra al sistema y con qué rol. La clave no se puede consultar: si alguien la olvida, se
              restablece.
            </p>
          </div>
          {puedeCrear && (
            <Button onClick={abrirNuevo} disabled={roles.length === 0}>
              <Plus className="h-4 w-4" />
              Nuevo usuario
            </Button>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {aviso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {aviso}
        </div>
      )}

      <Card>
        <div className="mb-4 max-w-md">
          <Input
            placeholder="Buscar por usuario, nombre o rol"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando usuarios…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Último acceso</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtrados.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {u.username}
                      {yo?.id === u.id && <span className="ml-2 text-xs text-neutral-400">(usted)</span>}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {u.nombre_completo}
                      {u.email && <div className="text-xs text-neutral-400">{u.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-neutral-700">
                        <Shield className="h-3.5 w-3.5 text-neutral-400" />
                        {u.rol.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.estado === 'activo' ? 'success' : 'neutral'}>{u.estado}</Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {u.ultimo_acceso ? formatearFecha(u.ultimo_acceso) : 'nunca entró'}
                    </td>
                    <td className="px-4 py-3">
                      {puedeEditar && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => abrirEditar(u)}>
                            <UserCog className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => abrirClave(u)}>
                            <KeyRound className="h-4 w-4" />
                            Clave
                          </Button>
                          {yo?.id !== u.id && (
                            <Button variant="outline" size="sm" onClick={() => void cambiarEstado(u)}>
                              {u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                      No hay usuarios para esa búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {roles.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900">Qué puede hacer cada rol</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <div key={r.id} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-900">{r.nombre}</span>
                  <span className="text-xs text-neutral-500">{r.usuarios} usuario(s)</span>
                </div>
                {r.descripcion && <p className="mt-1 text-xs text-neutral-500">{r.descripcion}</p>}
                <p className="mt-2 text-xs text-neutral-600">{r.modulos.join(', ')}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={modal === 'nuevo' || modal === 'editar'}
        onClose={cerrar}
        title={modal === 'nuevo' ? 'Nuevo usuario' : `Editar ${seleccionado?.username ?? ''}`}
        description={
          modal === 'nuevo'
            ? 'El usuario entra con el nombre que se elija aquí y la clave que se le asigne.'
            : 'El nombre de usuario no cambia. Para la clave, use el botón Clave.'
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={!formValido || guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {modal === 'nuevo' && (
            <Input
              label="Usuario"
              autoFocus
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="por ejemplo, caja2"
              helperText="Letras, números, punto, guion y guion bajo"
            />
          )}
          <Input
            label="Nombre completo"
            autoFocus={modal === 'editar'}
            value={form.nombre_completo}
            onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
          />
          <Input
            label="Correo (opcional)"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Rol</label>
            <select
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={form.rol_id}
              onChange={(e) => setForm({ ...form, rol_id: e.target.value })}
              disabled={modal === 'editar' && yo?.id === seleccionado?.id}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            {modal === 'editar' && yo?.id === seleccionado?.id && (
              <p className="mt-1 text-xs text-neutral-500">No puede cambiarse su propio rol.</p>
            )}
          </div>
          {modal === 'nuevo' && (
            <Input
              label="Clave"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              helperText={`Al menos ${CLAVE_MINIMA} caracteres`}
            />
          )}
        </div>
      </Modal>

      <Modal
        open={modal === 'clave'}
        onClose={cerrar}
        title={`Clave de ${seleccionado?.username ?? ''}`}
        description="La clave anterior no se puede consultar; se reemplaza por esta."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={!formValido || guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Restablecer'}
            </Button>
          </div>
        }
      >
        <Input
          label="Clave nueva"
          type="password"
          autoFocus
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          helperText={`Al menos ${CLAVE_MINIMA} caracteres`}
        />
      </Modal>
    </div>
  )
}

export default UsuariosPage
