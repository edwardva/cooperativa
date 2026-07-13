/**
 * ============================================
 * PÁGINA: PARÁMETROS DEL SISTEMA
 * ============================================
 * Gestión de configuraciones operativas de la cooperativa
 * (tasa de cambio, semanas de suspensión, etc.)
 */

import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Save, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Parametro {
  id: number;
  clave: string;
  valor: string;
  descripcion?: string;
  tipo_dato: 'string' | 'number' | 'boolean' | 'json';
  updated_at: string;
}

export const ParametrosPage = () => {
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  
  // Mock data - reemplazar con llamada a API
  const [parametros, setParametros] = useState<Parametro[]>([
    {
      id: 1,
      clave: 'TASA_DIVISA',
      valor: '700.22',
      descripcion: 'Tasa de cambio USD/Bs actual',
      tipo_dato: 'number',
      updated_at: '2026-07-10T10:30:00Z',
    },
    {
      id: 2,
      clave: 'SEMANAS_SUSPENSION_FUNERARIA',
      valor: '6',
      descripcion: 'Semanas de morosidad antes de suspender servicio funerario',
      tipo_dato: 'number',
      updated_at: '2026-01-15T08:00:00Z',
    },
    {
      id: 3,
      clave: 'SEMANAS_SUSPENSION_SALUD',
      valor: '11',
      descripcion: 'Semanas de morosidad antes de suspender servicio de salud',
      tipo_dato: 'number',
      updated_at: '2026-01-15T08:00:00Z',
    },
    {
      id: 4,
      clave: 'PORCENTAJE_AHORRO_FIADOR',
      valor: '30',
      descripcion: 'Porcentaje mínimo de ahorro requerido para ser fiador',
      tipo_dato: 'number',
      updated_at: '2026-01-15T08:00:00Z',
    },
  ]);

  const parametrosFiltrados = parametros.filter(p =>
    p.clave.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleGuardar = (id: number) => {
    // TODO: Implementar llamada a API
    console.log('Guardando parámetro:', id);
    setEditando(null);
  };

  const handleEliminar = (id: number) => {
    if (confirm('¿Está seguro de eliminar este parámetro?')) {
      // TODO: Implementar llamada a API
      setParametros(parametros.filter(p => p.id !== id));
    }
  };

  const handleCrear = () => {
    // TODO: Implementar formulario de creación
    console.log('Crear nuevo parámetro');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Parámetros del Sistema</h1>
        <p className="mt-2 text-neutral-600">
          Gestión de configuraciones operativas de la cooperativa
        </p>
      </div>

      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Búsqueda */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <Input
              type="text"
              placeholder="Buscar parámetros..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Acciones */}
          <Button onClick={handleCrear}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Parámetro
          </Button>
        </div>
      </Card>

      {/* Tabla de Parámetros */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                  Clave
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                  Valor
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                  Descripción
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900">
                  Última Actualización
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-neutral-900">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {parametrosFiltrados.map((parametro) => (
                <tr
                  key={parametro.id}
                  className="hover:bg-neutral-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <code className="px-2 py-1 bg-neutral-100 text-neutral-900 rounded text-sm font-mono">
                      {parametro.clave}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    {editando === parametro.id ? (
                      <Input
                        type="text"
                        defaultValue={parametro.valor}
                        className="max-w-xs"
                      />
                    ) : (
                      <span className="font-mono text-sm text-neutral-900">
                        {parametro.valor}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-neutral-600">
                      {parametro.descripcion || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-primary-50 text-primary-700">
                      {parametro.tipo_dato}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-neutral-600">
                      {formatearFecha(parametro.updated_at)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {editando === parametro.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleGuardar(parametro.id)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditando(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditando(parametro.id)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEliminar(parametro.id)}
                          >
                            <Trash2 className="h-4 w-4 text-error-600" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {parametrosFiltrados.length === 0 && (
            <div className="text-center py-12">
              <p className="text-neutral-500">
                {busqueda
                  ? 'No se encontraron parámetros con ese criterio'
                  : 'No hay parámetros registrados'}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
