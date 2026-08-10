import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PrintableListado } from '../components/print/PrintableListado';
import { Edit2, Trash2, Save, X, Plus, DollarSign, CheckCircle2, XCircle } from 'lucide-react';

// TODO: Mover a types/index.ts cuando integremos con API
interface TipoPrestamo {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tasa_interes_anual: number;
  tasa_mora_mensual: number;
  plazo_maximo_semanas: number;
  requiere_fiadores: boolean;
  estado: boolean;
  _count?: {
    prestamos: number;
  };
  created_at: string;
}

export const TiposPrestamoPage = () => {
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<TipoPrestamo>>({});

  // TODO: Reemplazar con llamada a API real (GET /api/tipos-prestamo)
  const [tiposPrestamo] = useState<TipoPrestamo[]>([
    {
      id: 1,
      codigo: 'PERSONAL',
      nombre: 'Préstamo Personal',
      descripcion: 'Préstamo de libre disponibilidad sin garantías adicionales',
      tasa_interes_anual: 18.0,
      tasa_mora_mensual: 2.0,
      plazo_maximo_semanas: 52,
      requiere_fiadores: true,
      estado: true,
      _count: { prestamos: 842 },
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      codigo: 'EMERGENCIA',
      nombre: 'Préstamo de Emergencia',
      descripcion: 'Préstamo rápido para situaciones imprevistas',
      tasa_interes_anual: 15.0,
      tasa_mora_mensual: 2.5,
      plazo_maximo_semanas: 26,
      requiere_fiadores: true,
      estado: true,
      _count: { prestamos: 327 },
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      codigo: 'VEHICULO',
      nombre: 'Préstamo para Vehículo',
      descripcion: 'Préstamo específico para adquisición de vehículo con garantía prendaria',
      tasa_interes_anual: 12.5,
      tasa_mora_mensual: 1.5,
      plazo_maximo_semanas: 156,
      requiere_fiadores: false,
      estado: true,
      _count: { prestamos: 156 },
      created_at: new Date().toISOString(),
    },
    {
      id: 4,
      codigo: 'VIVIENDA',
      nombre: 'Préstamo para Vivienda',
      descripcion: 'Préstamo hipotecario para adquisición, construcción o mejoras de vivienda',
      tasa_interes_anual: 10.0,
      tasa_mora_mensual: 1.0,
      plazo_maximo_semanas: 260,
      requiere_fiadores: false,
      estado: true,
      _count: { prestamos: 89 },
      created_at: new Date().toISOString(),
    },
    {
      id: 5,
      codigo: 'ESTUDIOS',
      nombre: 'Préstamo Educativo',
      descripcion: 'Préstamo para pago de matrículas y estudios universitarios',
      tasa_interes_anual: 8.5,
      tasa_mora_mensual: 1.5,
      plazo_maximo_semanas: 104,
      requiere_fiadores: true,
      estado: false,
      _count: { prestamos: 0 },
      created_at: new Date().toISOString(),
    },
  ]);

  const tiposPrestamoFiltrados = tiposPrestamo.filter((tipo) =>
    tipo.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    tipo.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
    tipo.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const filtrosImpresion = [{ label: 'Búsqueda', value: busqueda || 'Sin búsqueda' }];

  const filasImpresion = tiposPrestamoFiltrados.map((tipo) => [
    tipo.codigo,
    tipo.nombre,
    tipo.descripcion || 'Sin descripción',
    `${tipo.tasa_interes_anual.toFixed(2)}%`,
    `${tipo.tasa_mora_mensual.toFixed(2)}%`,
    `${tipo.plazo_maximo_semanas} semanas`,
    tipo.requiere_fiadores ? 'Sí' : 'No',
    String(tipo._count?.prestamos ?? 0),
    tipo.estado ? 'Activo' : 'Inactivo',
  ]);

  const handleEditar = (tipo: TipoPrestamo) => {
    setEditando(tipo.id);
    setFormData({
      nombre: tipo.nombre,
      descripcion: tipo.descripcion,
      tasa_interes_anual: tipo.tasa_interes_anual,
      tasa_mora_mensual: tipo.tasa_mora_mensual,
      plazo_maximo_semanas: tipo.plazo_maximo_semanas,
    });
  };

  const handleCancelar = () => {
    setEditando(null);
    setFormData({});
  };

  const handleGuardar = (id: number) => {
    // TODO: Implementar llamada a API (PUT /api/tipos-prestamo/:id)
    console.log('Guardar tipo de préstamo', id, formData);
    setEditando(null);
    setFormData({});
  };

  const handleEliminar = (tipo: TipoPrestamo) => {
    // Verificar que no tenga préstamos asociados
    if (tipo._count && tipo._count.prestamos > 0) {
      alert(`No se puede eliminar el tipo de préstamo "${tipo.nombre}" porque tiene ${tipo._count.prestamos} préstamos asociados`);
      return;
    }

    if (window.confirm(`¿Está seguro de desactivar el tipo de préstamo "${tipo.nombre}"?`)) {
      // TODO: Implementar llamada a API (DELETE /api/tipos-prestamo/:id)
      console.log('Desactivar tipo de préstamo', tipo.id);
    }
  };

  const handleCrear = () => {
    // TODO: Implementar modal de creación
    console.log('Crear nuevo tipo de préstamo');
  };

  const handleInputChange = (field: keyof TipoPrestamo, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const semanasAMeses = (semanas: number): string => {
    const meses = Math.round((semanas * 7) / 30);
    return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tipos de Préstamo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de tipos de préstamo, tasas de interés y condiciones
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Imprimir listado
          </Button>
          <Button onClick={handleCrear} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Tipo de Préstamo
          </Button>
        </div>
      </div>

      <PrintableListado
        titulo="Tipos de Préstamo"
        subtitulo="Listado generado con los filtros actuales"
        filtros={filtrosImpresion}
        columnas={['Código', 'Nombre', 'Descripción', 'Tasa anual', 'Mora mensual', 'Plazo máximo', 'Fiadores', 'Préstamos', 'Estado']}
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

      {/* Tabla de Tipos de Préstamo */}
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
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tasa Anual
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mora Mensual
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plazo Máximo
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fiadores
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Préstamos
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tiposPrestamoFiltrados.map((tipo) => (
                <tr key={tipo.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
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
                  <td className="px-6 py-4 max-w-xs">
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
                      <span className="text-sm text-gray-600 line-clamp-2">
                        {tipo.descripcion || <span className="text-gray-400 italic">Sin descripción</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {editando === tipo.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.tasa_interes_anual || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('tasa_interes_anual', parseFloat(e.target.value))
                        }
                        className="w-20 text-center"
                      />
                    ) : (
                      <span className="text-sm font-medium text-blue-600">
                        {tipo.tasa_interes_anual.toFixed(2)}%
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {editando === tipo.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="50"
                        value={formData.tasa_mora_mensual || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('tasa_mora_mensual', parseFloat(e.target.value))
                        }
                        className="w-20 text-center"
                      />
                    ) : (
                      <span className="text-sm font-medium text-red-600">
                        {tipo.tasa_mora_mensual.toFixed(2)}%
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {editando === tipo.id ? (
                      <Input
                        type="number"
                        min="1"
                        max="260"
                        value={formData.plazo_maximo_semanas || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('plazo_maximo_semanas', parseInt(e.target.value, 10))
                        }
                        className="w-20 text-center"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">
                        <div className="font-medium">{tipo.plazo_maximo_semanas} sem</div>
                        <div className="text-xs text-gray-500">{semanasAMeses(tipo.plazo_maximo_semanas)}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {tipo.requiere_fiadores ? (
                      <span title="Requiere fiadores">
                        <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                      </span>
                    ) : (
                      <span title="No requiere fiadores">
                        <XCircle className="w-5 h-5 text-gray-400 mx-auto" />
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-medium text-gray-900">
                      {tipo._count?.prestamos.toLocaleString('es-VE') || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
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
                          disabled={tipo._count && tipo._count.prestamos > 0}
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

        {tiposPrestamoFiltrados.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron tipos de préstamo</p>
          </div>
        )}
      </Card>

      {/* Footer Stats */}
      <Card className="p-4">
        <div className="grid grid-cols-5 gap-4 text-sm text-gray-600">
          <div>
            Total: <span className="font-medium text-gray-900">{tiposPrestamo.length}</span> tipos
          </div>
          <div>
            Activos: <span className="font-medium text-green-600">{tiposPrestamo.filter((t) => t.estado).length}</span>
          </div>
          <div>
            Inactivos: <span className="font-medium text-red-600">{tiposPrestamo.filter((t) => !t.estado).length}</span>
          </div>
          <div>
            Con Fiadores: <span className="font-medium text-blue-600">{tiposPrestamo.filter((t) => t.requiere_fiadores).length}</span>
          </div>
          <div>
            Total Préstamos: <span className="font-medium text-purple-600">
              {tiposPrestamo.reduce((acc, t) => acc + (t._count?.prestamos || 0), 0).toLocaleString('es-VE')}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
