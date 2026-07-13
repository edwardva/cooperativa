import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Edit2, Trash2, Save, X, Plus, Wallet } from 'lucide-react';

// TODO: Mover a types/index.ts cuando integremos con API
interface TipoCuentaAhorro {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: boolean;
  _count?: {
    cuentas: number;
  };
  created_at: string;
}

export const TiposCuentaPage = () => {
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<TipoCuentaAhorro>>({});

  // TODO: Reemplazar con llamada a API real (GET /api/tipos-cuenta)
  const [tiposCuenta] = useState<TipoCuentaAhorro[]>([
    {
      id: 1,
      codigo: 'JUVENIL',
      nombre: 'Cuenta Juvenil',
      descripcion: 'Cuenta de ahorro para jóvenes menores de 25 años con beneficios especiales',
      estado: true,
      _count: { cuentas: 1847 },
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      codigo: 'PROGRAMADA',
      nombre: 'Cuenta Programada',
      descripcion: 'Ahorro programado con depósitos periódicos y metas establecidas',
      estado: true,
      _count: { cuentas: 3215 },
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      codigo: 'NAVIDEÑA',
      nombre: 'Cuenta Navideña',
      descripcion: 'Ahorro especial para la temporada navideña con retiro programado en diciembre',
      estado: true,
      _count: { cuentas: 2893 },
      created_at: new Date().toISOString(),
    },
    {
      id: 4,
      codigo: 'BASICA',
      nombre: 'Cuenta Básica',
      descripcion: 'Cuenta de ahorro estándar sin requisitos especiales',
      estado: true,
      _count: { cuentas: 1630 },
      created_at: new Date().toISOString(),
    },
    {
      id: 5,
      codigo: 'VIVIENDA',
      nombre: 'Ahorro para Vivienda',
      descripcion: 'Ahorro destinado a la adquisición o mejora de vivienda',
      estado: false,
      _count: { cuentas: 0 },
      created_at: new Date().toISOString(),
    },
  ]);

  const tiposCuentaFiltrados = tiposCuenta.filter((tipo) =>
    tipo.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    tipo.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
    tipo.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const handleEditar = (tipo: TipoCuentaAhorro) => {
    setEditando(tipo.id);
    setFormData({
      nombre: tipo.nombre,
      descripcion: tipo.descripcion,
    });
  };

  const handleCancelar = () => {
    setEditando(null);
    setFormData({});
  };

  const handleGuardar = (id: number) => {
    // TODO: Implementar llamada a API (PUT /api/tipos-cuenta/:id)
    console.log('Guardar tipo de cuenta', id, formData);
    setEditando(null);
    setFormData({});
  };

  const handleEliminar = (tipo: TipoCuentaAhorro) => {
    // Verificar que no tenga cuentas asociadas
    if (tipo._count && tipo._count.cuentas > 0) {
      alert(`No se puede eliminar el tipo de cuenta "${tipo.nombre}" porque tiene ${tipo._count.cuentas} cuentas asociadas`);
      return;
    }

    if (window.confirm(`¿Está seguro de desactivar el tipo de cuenta "${tipo.nombre}"?`)) {
      // TODO: Implementar llamada a API (DELETE /api/tipos-cuenta/:id)
      console.log('Desactivar tipo de cuenta', tipo.id);
    }
  };

  const handleCrear = () => {
    // TODO: Implementar modal de creación
    console.log('Crear nuevo tipo de cuenta');
  };

  const handleInputChange = (field: keyof TipoCuentaAhorro, value: string) => {
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
          <h1 className="text-2xl font-semibold text-gray-900">Tipos de Cuenta de Ahorro</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de tipos de cuenta y productos de ahorro
          </p>
        </div>
        <Button onClick={handleCrear} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Tipo de Cuenta
        </Button>
      </div>

      {/* Búsqueda */}
      <Card className="p-4">
        <Input
          type="text"
          placeholder="Buscar por código, nombre o descripción..."
          value={busqueda}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
          className="w-full"
        />
      </Card>

      {/* Tabla de Tipos de Cuenta */}
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
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cuentas Activas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registrado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tiposCuentaFiltrados.map((tipo) => (
                <tr key={tipo.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-mono text-gray-900 font-medium">{tipo.codigo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editando === tipo.id ? (
                      <Input
                        type="text"
                        value={formData.nombre || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('nombre', e.target.value)
                        }
                        className="w-full max-w-xs"
                      />
                    ) : (
                      <span className="text-sm text-gray-900 font-medium">{tipo.nombre}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editando === tipo.id ? (
                      <Input
                        type="text"
                        value={formData.descripcion || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('descripcion', e.target.value)
                        }
                        className="w-full"
                      />
                    ) : (
                      <span className="text-sm text-gray-600">
                        {tipo.descripcion || <span className="text-gray-400 italic">Sin descripción</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {tipo._count?.cuentas.toLocaleString('es-VE') || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tipo.estado
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {tipo.estado ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatearFecha(tipo.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editando === tipo.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => handleGuardar(tipo.id)}
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
                          onClick={() => handleEditar(tipo)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminar(tipo)}
                          className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Desactivar"
                          disabled={tipo._count && tipo._count.cuentas > 0}
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

        {tiposCuentaFiltrados.length === 0 && (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron tipos de cuenta</p>
          </div>
        )}
      </Card>

      {/* Footer Stats */}
      <Card className="p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Total: <span className="font-medium text-gray-900">{tiposCuenta.length}</span> tipos de cuenta
          </div>
          <div>
            Activos: <span className="font-medium text-green-600">{tiposCuenta.filter((t) => t.estado).length}</span>
          </div>
          <div>
            Inactivos: <span className="font-medium text-red-600">{tiposCuenta.filter((t) => !t.estado).length}</span>
          </div>
          <div>
            Total Cuentas: <span className="font-medium text-blue-600">
              {tiposCuenta.reduce((acc, t) => acc + (t._count?.cuentas || 0), 0).toLocaleString('es-VE')}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
