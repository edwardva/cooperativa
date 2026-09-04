import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PrintableListado } from '../components/print/PrintableListado';
import { SortableHeader } from '../components/ui/SortableHeader';
import { Edit2, Trash2, Save, X, Plus, MapPin } from 'lucide-react';
import * as feriasService from '../services/feriasService';
import type { Ubicacion } from '../services/feriasService';
import { formatearFechaCorta } from '../utils/formatters';

export const FeriasPage = () => {
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Ubicacion>>({});
  const [ferias, setFerias] = useState<Ubicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de ordenamiento
  const [sortField, setSortField] = useState<string>('codigo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Función para manejar el ordenamiento
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Cargar ferias desde la API
  useEffect(() => {
    cargarFerias();
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
      console.error('Error cargando ferias:', err);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Ordenar ferias seg\u00fan el campo seleccionado
  const feriasOrdenadas = useMemo(() => {
    const feriasCopia = [...ferias];
    
    feriasCopia.sort((a, b) => {
      let compareA: any = (a as any)[sortField];
      let compareB: any = (b as any)[sortField];

      // Manejar valores nulos
      if (compareA === null || compareA === undefined) compareA = '';
      if (compareB === null || compareB === undefined) compareB = '';

      // Comparaci\u00f3n
      if (typeof compareA === 'string') {
        compareA = compareA.toLowerCase();
        compareB = compareB.toLowerCase();
      }

      if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return feriasCopia;
  }, [ferias, sortField, sortOrder]);

  const feriasFiltradas = feriasOrdenadas.filter((feria) =>
    feria.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (feria.direccion && feria.direccion.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const filtrosImpresion = [{ label: 'Búsqueda', value: busqueda || 'Sin búsqueda' }];

  const filasImpresion = feriasFiltradas.map((feria) => [
    feria.codigo,
    feria.nombre,
    feria.direccion || '-',
    feria.telefono || '-',
    String(feria._count?.socios ?? 0),
    feria.estado ? 'Activa' : 'Inactiva',
    formatearFechaCorta(feria.created_at),
  ]);

  const handleEditar = (feria: Ubicacion) => {
    setEditando(feria.id);
    setFormData({
      direccion: feria.direccion,
      telefono: feria.telefono,
    });
  };

  const handleCancelar = () => {
    setEditando(null);
    setFormData({});
  };

  const handleGuardar = async (id: number) => {
    try {
      const response = await feriasService.actualizarUbicacion(id, {
        ...formData,
        direccion: formData.direccion ?? undefined,
        telefono: formData.telefono ?? undefined,
      });
      if (response.success) {
        await cargarFerias(); // Recargar la lista
        setEditando(null);
        setFormData({});
      } else {
        alert(response.error?.message || 'Error al guardar feria');
      }
    } catch (err) {
      console.error('Error guardando feria:', err);
      alert('Error al guardar feria');
    }
  };

  const handleEliminar = async (feria: Ubicacion) => {
    // Verificar que no tenga socios asociados
    if (feria._count && feria._count.socios > 0) {
      alert(`No se puede eliminar la feria "${feria.codigo}" porque tiene ${feria._count.socios} socios asociados`);
      return;
    }

    if (window.confirm(`¿Está seguro de desactivar la feria "${feria.codigo}"?`)) {
      try {
        const response = await feriasService.eliminarUbicacion(feria.id);
        if (response.success) {
          await cargarFerias(); // Recargar la lista
        } else {
          alert(response.error?.message || 'Error al desactivar feria');
        }
      } catch (err) {
        console.error('Error desactivando feria:', err);
        alert('Error al desactivar feria');
      }
    }
  };

  const handleCrear = () => {
    // TODO: Implementar modal de creación
    alert('Funcionalidad de creación en desarrollo');
  };

  const handleInputChange = (field: keyof Ubicacion, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ferias</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de ferias y puntos de colecta
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Imprimir listado
          </Button>
          <Button onClick={handleCrear} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nueva Feria
          </Button>
        </div>
      </div>

      <PrintableListado
        titulo="Ferias y Ubicaciones"
        subtitulo="Listado generado con los filtros actuales"
        filtros={filtrosImpresion}
        columnas={['Código', 'Nombre', 'Dirección', 'Teléfono', 'Socios', 'Estado', 'Registrada']}
        filas={filasImpresion}
      />

      {/* Búsqueda y Filtros */}
      <Card className="p-4">
        <div className="flex gap-4">
          <Input
            type="text"
            placeholder="Buscar por código o descripción..."
            value={busqueda}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
            className="flex-1"
          />
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-500">Cargando ferias...</p>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-600 text-center">{error}</p>
        </Card>
      )}

      {/* Tabla de Ferias */}
      {!loading && !error && (
        <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortableHeader
                  label="Código"
                  field="codigo"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Descripción"
                  field="direccion"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Teléfono"
                  field="telefono"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Socios
                </th>
                <SortableHeader
                  label="Estado"
                  field="activo"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Registrada"
                  field="created_at"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {feriasFiltradas.map((feria) => (
                <tr key={feria.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-mono text-gray-900">{feria.codigo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editando === feria.id ? (
                      <Input
                        type="text"
                        value={formData.direccion || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('direccion', e.target.value)
                        }
                        className="w-full"
                      />
                    ) : (
                      <span className="text-sm text-gray-600">
                        {feria.direccion || <span className="text-gray-400 italic">Sin dirección</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editando === feria.id ? (
                      <Input
                        type="tel"
                        value={formData.telefono || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('telefono', e.target.value)
                        }
                        className="w-full max-w-[150px]"
                      />
                    ) : (
                      <span className="text-sm text-gray-600">
                        {feria.telefono || <span className="text-gray-400 italic">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {feria._count?.socios.toLocaleString('es-VE') || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        feria.estado
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {feria.estado ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatearFechaCorta(feria.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editando === feria.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => handleGuardar(feria.id)}
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Save className="w-3 h-3" />
                          Guardar
                        </Button>
                        <Button
                          onClick={handleCancelar}
                          variant="secondary"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditar(feria)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminar(feria)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Desactivar"
                          disabled={feria._count && feria._count.socios > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
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

      {/* Footer Stats */}
      {!loading && !error && (
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              Total: <span className="font-medium text-gray-900">{ferias.length}</span> ferias
            </div>
            <div>
              Activas: <span className="font-medium text-green-600">{ferias.filter((f) => f.estado).length}</span>
            </div>
            <div>
              Inactivas: <span className="font-medium text-red-600">{ferias.filter((f) => !f.estado).length}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
