// ============================================
// COOPERATIVA EL TRIUNFO - FRONTEND PAGE
// Semanas de Colecta (Gestión Tasa Semanal)
// ============================================

import { useState, useMemo } from 'react';
import { Calendar, DollarSign, TrendingUp, Search, Plus, Edit, Trash2, CheckCircle2, XCircle, Target } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PrintableListado } from '../components/print/PrintableListado';
import { SortableHeader } from '../components/ui/SortableHeader';

// ============================================
// TIPOS
// ============================================

interface SemanaColecta {
  id: number;
  semana: number;
  ano: number;
  tasa_usd_bs: number;
  meta_ahorro: number;
  meta_funeraria: number;
  meta_salud: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: boolean;
  _count?: {
    colectas: number;
  };
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export const SemanasColectaPage = () => {
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<SemanaColecta>>({});

  // Estados de ordenamiento
  const [sortField, setSortField] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Función para manejar el ordenamiento
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Datos mock (TODO: reemplazar con API calls)
  const semanas: SemanaColecta[] = [
    {
      id: 1,
      semana: 28,
      ano: 2026,
      tasa_usd_bs: 700.22,
      meta_ahorro: 25000.00,
      meta_funeraria: 8000.00,
      meta_salud: 6000.00,
      fecha_inicio: '2026-07-06',
      fecha_fin: '2026-07-12',
      estado: true,
      _count: { colectas: 156 }
    },
    {
      id: 2,
      semana: 27,
      ano: 2026,
      tasa_usd_bs: 698.50,
      meta_ahorro: 24500.00,
      meta_funeraria: 7800.00,
      meta_salud: 5900.00,
      fecha_inicio: '2026-06-29',
      fecha_fin: '2026-07-05',
      estado: true,
      _count: { colectas: 189 }
    },
    {
      id: 3,
      semana: 26,
      ano: 2026,
      tasa_usd_bs: 695.80,
      meta_ahorro: 24000.00,
      meta_funeraria: 7500.00,
      meta_salud: 5700.00,
      fecha_inicio: '2026-06-22',
      fecha_fin: '2026-06-28',
      estado: true,
      _count: { colectas: 201 }
    },
    {
      id: 4,
      semana: 25,
      ano: 2026,
      tasa_usd_bs: 693.15,
      meta_ahorro: 23500.00,
      meta_funeraria: 7200.00,
      meta_salud: 5500.00,
      fecha_inicio: '2026-06-15',
      fecha_fin: '2026-06-21',
      estado: false,
      _count: { colectas: 178 }
    }
  ];

  // ============================================
  // FUNCIONES
  // ============================================

  const formatearFecha = (fecha: string): string => {
    return new Date(fecha).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatearMoneda = (monto: number): string => {
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto);
  };

  const handleEditar = (semana: SemanaColecta) => {
    setEditando(semana.id);
    setFormData(semana);
  };

  const handleGuardar = () => {
    // TODO: Implementar API call para actualizar
    console.log('Guardando cambios:', formData);
    setEditando(null);
    setFormData({});
  };

  const handleCancelar = () => {
    setEditando(null);
    setFormData({});
  };

  const handleEliminar = (id: number) => {
    if (confirm('¿Está seguro que desea desactivar esta semana de colecta?')) {
      // TODO: Implementar API call para soft delete
      console.log('Eliminando semana:', id);
    }
  };

  // Filtrar semanas por búsqueda
  // Ordenar semanas según el campo seleccionado
  const semanasOrdenadas = useMemo(() => {
    const semanasCopia = [...semanas];
    
    semanasCopia.sort((a, b) => {
      let compareA: any = (a as any)[sortField];
      let compareB: any = (b as any)[sortField];

      // Manejar valores nulos
      if (compareA === null || compareA === undefined) compareA = '';
      if (compareB === null || compareB === undefined) compareB = '';

      // Comparación
      if (typeof compareA === 'string') {
        compareA = compareA.toLowerCase();
        compareB = compareB.toLowerCase();
      }

      if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return semanasCopia;
  }, [semanas, sortField, sortOrder]);

  // Filtrar semanas ordenadas
  const semanasFiltradas = semanasOrdenadas.filter((semana) => {
    const searchLower = busqueda.toLowerCase();
    return (
      semana.semana.toString().includes(searchLower) ||
      semana.ano.toString().includes(searchLower) ||
      semana.tasa_usd_bs.toString().includes(searchLower)
    );
  });

  // Calcular estadísticas
  const totalSemanas = semanas.length;
  const semanasActivas = semanas.filter(s => s.estado).length;
  const tasaActual = semanas.find(s => s.estado)?.tasa_usd_bs || 0;
  const totalColectas = semanas.reduce((sum, s) => sum + (s._count?.colectas || 0), 0);

  const filtrosImpresion = [{ label: 'Búsqueda', value: busqueda || 'Sin búsqueda' }];

  const filasImpresion = semanasFiltradas.map((semana) => [
    `${semana.semana}/${semana.ano}`,
    `${formatearFecha(semana.fecha_inicio)} - ${formatearFecha(semana.fecha_fin)}`,
    `Bs ${formatearMoneda(semana.tasa_usd_bs)}`,
    `Bs ${formatearMoneda(semana.meta_ahorro)}`,
    `Bs ${formatearMoneda(semana.meta_funeraria)}`,
    `Bs ${formatearMoneda(semana.meta_salud)}`,
    String(semana._count?.colectas ?? 0),
    semana.estado ? 'Activa' : 'Inactiva',
  ]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Semanas de Colecta
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestión de tasa semanal USD/Bs y metas de colecta
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2">
            <Calendar size={20} />
            Imprimir listado
          </Button>
          <Button className="flex items-center gap-2">
            <Plus size={20} />
            Nueva Semana
          </Button>
        </div>
      </div>

      <PrintableListado
        titulo="Semanas de Colecta"
        subtitulo="Listado generado con los filtros actuales"
        filtros={filtrosImpresion}
        columnas={['Semana/Año', 'Período', 'Tasa USD/Bs', 'Meta ahorro', 'Meta funeraria', 'Meta salud', 'Colectas', 'Estado']}
        filas={filasImpresion}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Semanas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {totalSemanas}
              </p>
            </div>
            <Calendar className="text-blue-600" size={32} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Semanas Activas</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {semanasActivas}
              </p>
            </div>
            <CheckCircle2 className="text-green-600" size={32} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tasa Actual (USD/Bs)</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {formatearMoneda(tasaActual)}
              </p>
            </div>
            <DollarSign className="text-purple-600" size={32} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Colectas</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {totalColectas}
              </p>
            </div>
            <TrendingUp className="text-orange-600" size={32} />
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Search className="text-gray-400" size={20} />
          <Input
            type="text"
            placeholder="Buscar por semana, año o tasa..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1"
          />
        </div>
      </Card>

      {/* Tabla de Semanas */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <SortableHeader
                  label="Semana / Año"
                  field="semana"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Período"
                  field="fecha_inicio"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Tasa USD/Bs"
                  field="tasa_usd_bs"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Meta Ahorro"
                  field="meta_ahorro"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Meta Funeraria"
                  field="meta_funeraria"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Meta Salud"
                  field="meta_salud"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="right"
                />
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Colectas
                </th>
                <SortableHeader
                  label="Estado"
                  field="estado"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="center"
                />
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {semanasFiltradas.map((semana) => (
                <tr
                  key={semana.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {/* Semana / Año */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        S{semana.semana} / {semana.ano}
                      </span>
                    </div>
                  </td>

                  {/* Período */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatearFecha(semana.fecha_inicio)} - {formatearFecha(semana.fecha_fin)}
                  </td>

                  {/* Tasa USD/Bs */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {editando === semana.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.tasa_usd_bs || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, tasa_usd_bs: parseFloat(e.target.value) })
                        }
                        className="w-32 text-right"
                      />
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign size={14} className="text-purple-600" />
                        <span className="font-semibold text-purple-700 dark:text-purple-400">
                          {formatearMoneda(semana.tasa_usd_bs)}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Meta Ahorro */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {editando === semana.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.meta_ahorro || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, meta_ahorro: parseFloat(e.target.value) })
                        }
                        className="w-32 text-right"
                      />
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Target size={14} className="text-blue-600" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {formatearMoneda(semana.meta_ahorro)}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Meta Funeraria */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {editando === semana.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.meta_funeraria || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, meta_funeraria: parseFloat(e.target.value) })
                        }
                        className="w-32 text-right"
                      />
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Target size={14} className="text-green-600" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {formatearMoneda(semana.meta_funeraria)}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Meta Salud */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {editando === semana.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.meta_salud || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, meta_salud: parseFloat(e.target.value) })
                        }
                        className="w-32 text-right"
                      />
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Target size={14} className="text-orange-600" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {formatearMoneda(semana.meta_salud)}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Colectas */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {semana._count?.colectas || 0}
                    </span>
                  </td>

                  {/* Estado */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {semana.estado ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle2 size={12} />
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        <XCircle size={12} />
                        Inactiva
                      </span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {editando === semana.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleGuardar}
                          className="text-green-600 hover:bg-green-50"
                        >
                          <CheckCircle2 size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelar}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <XCircle size={16} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditar(semana)}
                          className="text-blue-600 hover:bg-blue-50"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEliminar(semana.id)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Footer Stats */}
      <Card className="p-4 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total: </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {totalSemanas} semanas
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Activas: </span>
              <span className="font-semibold text-green-600">
                {semanasActivas}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Inactivas: </span>
              <span className="font-semibold text-gray-600">
                {totalSemanas - semanasActivas}
              </span>
            </div>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Total Colectas: </span>
            <span className="font-semibold text-blue-600">
              {totalColectas}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SemanasColectaPage;
