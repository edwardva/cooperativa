import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Edit2, Trash2, Save, X, Plus, MapPin } from 'lucide-react';

// TODO: Mover a types/index.ts cuando integremos con API
interface Ubicacion {
  id: number;
  codigo: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  estado: boolean;
  _count?: {
    socios: number;
  };
  created_at: string;
}

export const UbicacionesPage = () => {
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Ubicacion>>({});

  // TODO: Reemplazar con llamada a API real (GET /api/ubicaciones)
  const [ubicaciones] = useState<Ubicacion[]>([
    {
      id: 1,
      codigo: 'MATRIZ',
      nombre: 'Oficina Matriz',
      direccion: 'Av. Principal, Edificio El Triunfo',
      telefono: '0212-555-0100',
      estado: true,
      _count: { socios: 5243 },
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      codigo: 'SUC01',
      nombre: 'Sucursal Este',
      direccion: 'Centro Comercial Plaza del Este',
      telefono: '0212-555-0200',
      estado: true,
      _count: { socios: 2187 },
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      codigo: 'SUC02',
      nombre: 'Sucursal Oeste',
      direccion: 'Calle Comercio, Local 45',
      telefono: '0212-555-0300',
      estado: true,
      _count: { socios: 1893 },
      created_at: new Date().toISOString(),
    },
    {
      id: 4,
      codigo: 'KIOSCO',
      nombre: 'Kiosco Central',
      estado: false,
      _count: { socios: 262 },
      created_at: new Date().toISOString(),
    },
  ]);

  const ubicacionesFiltradas = ubicaciones.filter((ubicacion) =>
    ubicacion.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    ubicacion.codigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  const handleEditar = (ubicacion: Ubicacion) => {
    setEditando(ubicacion.id);
    setFormData({
      nombre: ubicacion.nombre,
      direccion: ubicacion.direccion,
      telefono: ubicacion.telefono,
    });
  };

  const handleCancelar = () => {
    setEditando(null);
    setFormData({});
  };

  const handleGuardar = (id: number) => {
    // TODO: Implementar llamada a API (PUT /api/ubicaciones/:id)
    console.log('Guardar ubicación', id, formData);
    setEditando(null);
    setFormData({});
  };

  const handleEliminar = (ubicacion: Ubicacion) => {
    // Verificar que no tenga socios asociados
    if (ubicacion._count && ubicacion._count.socios > 0) {
      alert(`No se puede eliminar la ubicación "${ubicacion.nombre}" porque tiene ${ubicacion._count.socios} socios asociados`);
      return;
    }

    if (window.confirm(`¿Está seguro de desactivar la ubicación "${ubicacion.nombre}"?`)) {
      // TODO: Implementar llamada a API (DELETE /api/ubicaciones/:id)
      console.log('Desactivar ubicación', ubicacion.id);
    }
  };

  const handleCrear = () => {
    // TODO: Implementar modal de creación
    console.log('Crear nueva ubicación');
  };

  const handleInputChange = (field: keyof Ubicacion, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ubicaciones y Sucursales</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de oficinas, sucursales y puntos de atención
          </p>
        </div>
        <Button onClick={handleCrear} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nueva Ubicación
        </Button>
      </div>

      {/* Búsqueda y Filtros */}
      <Card className="p-4">
        <div className="flex gap-4">
          <Input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
            className="flex-1"
          />
        </div>
      </Card>

      {/* Tabla de Ubicaciones */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dirección
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Socios
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registrada
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ubicacionesFiltradas.map((ubicacion) => (
                <tr key={ubicacion.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-mono text-gray-900">{ubicacion.codigo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editando === ubicacion.id ? (
                      <Input
                        type="text"
                        value={formData.nombre || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('nombre', e.target.value)
                        }
                        className="w-full max-w-xs"
                      />
                    ) : (
                      <span className="text-sm text-gray-900 font-medium">{ubicacion.nombre}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editando === ubicacion.id ? (
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
                        {ubicacion.direccion || <span className="text-gray-400 italic">Sin dirección</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editando === ubicacion.id ? (
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
                        {ubicacion.telefono || <span className="text-gray-400 italic">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {ubicacion._count?.socios.toLocaleString('es-VE') || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ubicacion.estado
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ubicacion.estado ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatearFecha(ubicacion.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editando === ubicacion.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => handleGuardar(ubicacion.id)}
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
                          onClick={() => handleEditar(ubicacion)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminar(ubicacion)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Desactivar"
                          disabled={ubicacion._count && ubicacion._count.socios > 0}
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

        {ubicacionesFiltradas.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron ubicaciones</p>
          </div>
        )}
      </Card>

      {/* Footer Stats */}
      <Card className="p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Total: <span className="font-medium text-gray-900">{ubicaciones.length}</span> ubicaciones
          </div>
          <div>
            Activas: <span className="font-medium text-green-600">{ubicaciones.filter((u) => u.estado).length}</span>
          </div>
          <div>
            Inactivas: <span className="font-medium text-red-600">{ubicaciones.filter((u) => !u.estado).length}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
