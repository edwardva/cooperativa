import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PrintableListado } from '../components/print/PrintableListado';
import { Edit2, Trash2, Save, X, Plus, Wallet, Loader2 } from 'lucide-react';
import * as ahorroService from '../services/ahorroService';
import { formatearFechaCorta } from '../utils/formatters';

interface TipoCuentaAhorro {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  estado: boolean;
  _count?: {
    cuentas: number;
  };
  created_at?: string;
}

export const TiposCuentaPage = () => {
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<TipoCuentaAhorro>>({});
  const [tiposCuenta, setTiposCuenta] = useState<TipoCuentaAhorro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar tipos de cuenta desde API
  useEffect(() => {
    const cargarTipos = async () => {
      setLoading(true);
      setError(null);
      try {
        // Usar endpoint que trae TODOS los tipos (incluyendo inactivos con conteo)
        const response = await ahorroService.obtenerTodosTiposCuenta();
        if (response.success) {
          setTiposCuenta(response.data as TipoCuentaAhorro[]);
        }
      } catch (err: any) {
        console.error('Error al cargar tipos:', err);
        setError('Error al cargar tipos de cuenta');
      } finally {
        setLoading(false);
      }
    };
    void cargarTipos();
  }, []);

  const tiposCuentaFiltrados = tiposCuenta.filter((tipo) =>
    tipo.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    tipo.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
    tipo.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const filtrosImpresion = [{ label: 'Búsqueda', value: busqueda || 'Sin búsqueda' }];

  const filasImpresion = tiposCuentaFiltrados.map((tipo) => [
    tipo.codigo,
    tipo.nombre,
    tipo.descripcion || 'Sin descripción',
    String(tipo._count?.cuentas ?? 0),
    tipo.estado ? 'Activo' : 'Inactivo',
    tipo.created_at ? formatearFechaCorta(tipo.created_at) : '-',
  ]);

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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando tipos de cuenta...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tipos de Cuenta de Ahorro</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de tipos de cuenta y productos de ahorro
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Imprimir listado
          </Button>
          <Button onClick={handleCrear} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Tipo de Cuenta
          </Button>
        </div>
      </div>

      <PrintableListado
        titulo="Tipos de Cuenta de Ahorro"
        subtitulo="Listado generado con los filtros actuales"
        filtros={filtrosImpresion}
        columnas={['Código', 'Nombre', 'Descripción', 'Cuentas activas', 'Estado', 'Registrado']}
        filas={filasImpresion}
      />

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
                    {tipo.created_at ? formatearFechaCorta(tipo.created_at) : '-'}
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
