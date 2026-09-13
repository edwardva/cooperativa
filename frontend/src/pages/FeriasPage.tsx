/**
 * ============================================
 * PAGE: FERIAS
 * ============================================
 * HU-05 / RF-FER-01: ficha completa de la feria, codigo unico, activar y
 * desactivar, y cuantos trabajadores activos tiene. Una feria no se borra:
 * se desactiva, y no se puede mientras tenga trabajadores activos.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PrintableListado } from '../components/print/PrintableListado';
import { SortableHeader } from '../components/ui/SortableHeader';
import { Edit2, Loader2, MapPin, Plus, Power, X } from 'lucide-react';
import * as feriasService from '../services/feriasService';
import type { Ubicacion } from '../services/feriasService';
import { getErrorMessage } from '../services/api';
import { usePermissions } from '../store/authStore';
import { useEnterNavigation } from '../hooks/useEnterNavigation';
import { formatearFechaCorta } from '../utils/formatters';

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50 disabled:text-neutral-500';

const labelClass = 'block text-sm font-medium text-neutral-700';

const formularioVacio = {
  codigo: '',
  nombre: '',
  ubicacion: '',
  direccion: '',
  responsable: '',
  telefono: '',
  observaciones: '',
};

type Formulario = typeof formularioVacio;

const trabajadoresActivos = (feria: Ubicacion) => feria._count?.trabajadores ?? 0;

export const FeriasPage = () => {
  const { hasPermission } = usePermissions();
  const puedeCrear = hasPermission('ubicaciones', 'create');
  const puedeEditar = hasPermission('ubicaciones', 'update');
  const alEnter = useEnterNavigation();

  const [busqueda, setBusqueda] = useState('');
  const [ferias, setFerias] = useState<Ubicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<string>('codigo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal de alta/edicion: null cerrado, 'nueva' o la feria que se edita
  const [editando, setEditando] = useState<Ubicacion | 'nueva' | null>(null);
  const [form, setForm] = useState<Formulario>(formularioVacio);
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  useEffect(() => {
    void cargarFerias();
  }, []);

  const cargarFerias = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await feriasService.obtenerUbicaciones();
      if (response.success && response.data) {
        setFerias(response.data);
      } else {
        setError(response.error?.message || 'Error al cargar ferias');
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const feriasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const valor = (f: Ubicacion): string | number => {
      if (sortField === 'trabajadores') return trabajadoresActivos(f);
      if (sortField === 'socios') return f._count?.socios ?? 0;
      if (sortField === 'estado') return f.estado ? 1 : 0;
      return String((f as unknown as Record<string, unknown>)[sortField] ?? '').toLowerCase();
    };

    return ferias
      .filter((f) =>
        !q ||
        [f.codigo, f.nombre, f.ubicacion, f.direccion, f.responsable]
          .some((campo) => campo?.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const va = valor(a);
        const vb = valor(b);
        if (va < vb) return sortOrder === 'asc' ? -1 : 1;
        if (va > vb) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [ferias, busqueda, sortField, sortOrder]);

  const filtrosImpresion = [{ label: 'Búsqueda', value: busqueda || 'Sin búsqueda' }];

  const filasImpresion = feriasFiltradas.map((feria) => [
    feria.codigo,
    feria.nombre,
    feria.ubicacion || '-',
    feria.responsable || '-',
    feria.telefono || '-',
    String(trabajadoresActivos(feria)),
    feria.estado ? 'Activa' : 'Inactiva',
  ]);

  const abrirNueva = () => {
    setForm(formularioVacio);
    setErrorForm('');
    setEditando('nueva');
  };

  const abrirEdicion = (feria: Ubicacion) => {
    setForm({
      codigo: feria.codigo,
      nombre: feria.nombre,
      ubicacion: feria.ubicacion ?? '',
      direccion: feria.direccion ?? '',
      responsable: feria.responsable ?? '',
      telefono: feria.telefono ?? '',
      observaciones: feria.observaciones ?? '',
    });
    setErrorForm('');
    setEditando(feria);
  };

  const cambiar = (campo: keyof Formulario, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  const guardar = async () => {
    if (!form.codigo.trim()) return setErrorForm('El código es obligatorio.');
    if (!form.nombre.trim()) return setErrorForm('El nombre es obligatorio.');

    const datos = {
      nombre: form.nombre.trim(),
      ubicacion: form.ubicacion.trim() || null,
      direccion: form.direccion.trim() || null,
      responsable: form.responsable.trim() || null,
      telefono: form.telefono.trim() || null,
      observaciones: form.observaciones.trim() || null,
    };

    setGuardando(true);
    setErrorForm('');
    try {
      if (editando === 'nueva') {
        await feriasService.crearUbicacion({ ...datos, codigo: form.codigo.trim() });
      } else if (editando) {
        await feriasService.actualizarUbicacion(editando.id, datos);
      }
      setEditando(null);
      await cargarFerias();
    } catch (err) {
      setErrorForm(getErrorMessage(err) || 'No fue posible guardar la feria');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (feria: Ubicacion) => {
    const activar = !feria.estado;
    const socios = feria._count?.socios ?? 0;
    const mensaje = activar
      ? `¿Activar la feria ${feria.codigo}?`
      : `¿Desactivar la feria ${feria.codigo}? Ya no se podrá asignar trabajadores a ella.` +
        (socios > 0 ? ` Sus ${socios} socio(s) conservan la feria en su expediente.` : '');
    if (!window.confirm(mensaje)) return;

    try {
      await feriasService.actualizarUbicacion(feria.id, { estado: activar });
      await cargarFerias();
    } catch (err) {
      alert(getErrorMessage(err) || 'No fue posible cambiar el estado de la feria');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ferias</h1>
          <p className="text-sm text-gray-500 mt-1">Ferias, responsables y trabajadores activos</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Imprimir listado
          </Button>
          {puedeCrear && (
            <Button onClick={abrirNueva} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nueva feria
            </Button>
          )}
        </div>
      </div>

      <PrintableListado
        titulo="Ferias"
        subtitulo="Listado generado con los filtros actuales"
        filtros={filtrosImpresion}
        columnas={['Código', 'Nombre', 'Ubicación', 'Responsable', 'Teléfono', 'Trabajadores', 'Estado']}
        filas={filasImpresion}
      />

      <Card className="p-4">
        <Input
          type="text"
          placeholder="Buscar por código, nombre, ubicación o responsable..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </Card>

      {loading && (
        <Card className="p-12">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary-500" />
            <p className="text-gray-500">Cargando ferias...</p>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-600 text-center">{error}</p>
        </Card>
      )}

      {!loading && !error && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortableHeader label="Código" field="codigo" currentSortField={sortField} currentSortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Nombre" field="nombre" currentSortField={sortField} currentSortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Responsable" field="responsable" currentSortField={sortField} currentSortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Teléfono" field="telefono" currentSortField={sortField} currentSortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Trabajadores activos" field="trabajadores" currentSortField={sortField} currentSortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Socios" field="socios" currentSortField={sortField} currentSortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Estado" field="estado" currentSortField={sortField} currentSortOrder={sortOrder} onSort={handleSort} />
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {feriasFiltradas.map((feria) => {
                  const activos = trabajadoresActivos(feria);
                  return (
                    <tr key={feria.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-mono text-gray-900">{feria.codigo}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{feria.nombre}</p>
                        {(feria.ubicacion || feria.direccion) && (
                          <p className="text-xs text-gray-500">{[feria.ubicacion, feria.direccion].filter(Boolean).join(' · ')}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{feria.responsable || <span className="text-gray-400">—</span>}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{feria.telefono || <span className="text-gray-400">—</span>}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{activos.toLocaleString('es-VE')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{(feria._count?.socios ?? 0).toLocaleString('es-VE')}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${feria.estado ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {feria.estado ? 'Activa' : 'Inactiva'}
                        </span>
                        <p className="mt-1 text-xs text-gray-400">desde {formatearFechaCorta(feria.created_at)}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {puedeEditar && (
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => abrirEdicion(feria)} className="text-blue-600 hover:text-blue-900 transition-colors" title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => void cambiarEstado(feria)}
                              disabled={feria.estado && activos > 0}
                              className={`transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${feria.estado ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                              title={
                                feria.estado && activos > 0
                                  ? `Tiene ${activos} trabajador(es) activo(s): trasládelos o retírelos antes de desactivarla`
                                  : feria.estado ? 'Desactivar' : 'Activar'
                              }
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {feriasFiltradas.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No se encontraron ferias</p>
            </div>
          )}
        </Card>
      )}

      {!loading && !error && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <div>Total: <span className="font-medium text-gray-900">{ferias.length}</span> ferias</div>
            <div>Activas: <span className="font-medium text-green-600">{ferias.filter((f) => f.estado).length}</span></div>
            <div>Inactivas: <span className="font-medium text-red-600">{ferias.filter((f) => !f.estado).length}</span></div>
            <div>Trabajadores activos: <span className="font-medium text-gray-900">{ferias.reduce((t, f) => t + trabajadoresActivos(f), 0)}</span></div>
          </div>
        </Card>
      )}

      {/* ================= MODAL: ALTA / EDICION ================= */}
      {editando && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card padding="none" className="w-full max-w-xl overflow-hidden border-neutral-200">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  {editando === 'nueva' ? 'Nueva feria' : `Editar feria ${editando.codigo}`}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">Enter pasa al campo siguiente.</p>
              </div>
              <button onClick={() => setEditando(null)} aria-label="Cerrar" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-2" onKeyDown={alEnter}>
              <label className={labelClass}>
                <span className="mb-1.5 block">Código *</span>
                <input
                  value={form.codigo}
                  onChange={(e) => cambiar('codigo', e.target.value.toUpperCase())}
                  disabled={editando !== 'nueva'}
                  maxLength={10}
                  autoFocus={editando === 'nueva'}
                  className={controlClass}
                />
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Nombre *</span>
                <input value={form.nombre} onChange={(e) => cambiar('nombre', e.target.value)} maxLength={100} autoFocus={editando !== 'nueva'} className={controlClass} />
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Ubicación</span>
                <input value={form.ubicacion} onChange={(e) => cambiar('ubicacion', e.target.value)} maxLength={150} placeholder="Sector, parroquia..." className={controlClass} />
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Responsable</span>
                <input value={form.responsable} onChange={(e) => cambiar('responsable', e.target.value)} maxLength={100} className={controlClass} />
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Teléfono</span>
                <input value={form.telefono} onChange={(e) => cambiar('telefono', e.target.value)} maxLength={20} className={controlClass} />
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Dirección</span>
                <input value={form.direccion} onChange={(e) => cambiar('direccion', e.target.value)} className={controlClass} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                <span className="mb-1.5 block">Observaciones</span>
                <textarea value={form.observaciones} onChange={(e) => cambiar('observaciones', e.target.value)} rows={3} className={controlClass} />
              </label>
              {editando !== 'nueva' && (
                <p className="text-xs text-neutral-500 sm:col-span-2">
                  El código no se cambia: identifica a la feria en los pagos y reportes históricos.
                </p>
              )}
            </div>

            <div className="border-t border-neutral-200 px-6 py-4">
              {errorForm && (
                <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorForm}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</Button>
                <Button onClick={() => void guardar()} disabled={guardando}>
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editando === 'nueva' ? 'Crear feria' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
