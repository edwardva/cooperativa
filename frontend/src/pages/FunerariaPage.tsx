/**
 * ============================================
 * PAGE: FUNERARIA
 * ============================================
 * Gestión de acuerdos de funeraria
 * - Listado de acuerdos
 * - Crear nuevos acuerdos
 * - Cambiar estados (suspender, reactivar, retirar)
 * - Estadísticas y alertas
 */

import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PrintableListado } from '../components/print/PrintableListado';
import { SortableHeader } from '../components/ui/SortableHeader';
import {
  Download,
  PlusCircle,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Shield,
} from 'lucide-react';
import * as funerariaService from '../services/funerariaService';
import type {
  AcuerdoFuneraria,
  EstadisticasFuneraria,
} from '../services/funerariaService';

// ============================================
// COMPONENT
// ============================================

export default function FunerariaPage() {
  // Estados
  const [acuerdos, setAcuerdos] = useState<AcuerdoFuneraria[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasFuneraria>({
    total_acuerdos: 0,
    por_estado: {
      activos: 0,
      suspendidos: 0,
      retirados: 0,
      porcentaje_activos: 0,
      porcentaje_suspendidos: 0,
      porcentaje_retirados: 0,
    },
    por_tipo: [],
    proximos_suspender: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'suspendido' | 'retirado'>(
    'todos'
  );
  const [filtroTipo, setFiltroTipo] = useState('todos');

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [ITEMS_POR_PAGINA, setItemsPorPagina] = useState(20);

  // Ordenamiento
  const [sortField, setSortField] = useState<string>('id');
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

  // Modales
  const [modalAbierto, setModalAbierto] = useState<'crear' | 'detalle' | 'cambiar-estado' | null>(
    null
  );
  const [_acuerdoSeleccionado, setAcuerdoSeleccionado] = useState<AcuerdoFuneraria | null>(null);

  // ============================================
  // EFFECTS
  // ============================================

  // Cargar estadísticas
  useEffect(() => {
    const cargarEstadisticas = async () => {
      try {
        const response = await funerariaService.obtenerEstadisticas();
        if (response.success && response.data) {
          const data = response.data as any;
          // Calcular porcentajes
          const total = data.total_acuerdos || 1; // Evitar división por 0
          const estadisticasEnriquecidas: EstadisticasFuneraria = {
            total_acuerdos: data.total_acuerdos || 0,
            por_estado: {
              activos: data.por_estado?.activos || 0,
              suspendidos: data.por_estado?.suspendidos || 0,
              retirados: data.por_estado?.retirados || 0,
              porcentaje_activos: ((data.por_estado?.activos || 0) / total) * 100,
              porcentaje_suspendidos: ((data.por_estado?.suspendidos || 0) / total) * 100,
              porcentaje_retirados: ((data.por_estado?.retirados || 0) / total) * 100,
            },
            por_tipo: data.por_tipo || [],
            proximos_suspender: data.alertas?.proximos_suspender || 0,
          };
          setEstadisticas(estadisticasEnriquecidas);
        }
      } catch (err) {
        console.error('Error al cargar estadísticas:', err);
      }
    };
    void cargarEstadisticas();
  }, []);

  // Cargar acuerdos
  useEffect(() => {
    const cargarAcuerdos = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = {
          page: paginaActual,
          limit: ITEMS_POR_PAGINA,
          ...(filtroEstado !== 'todos' && { estado: filtroEstado }),
          ...(busqueda && { buscar: busqueda }),
        };

        const response = await funerariaService.obtenerAcuerdos(params);

        if (response.success && response.data) {
          setAcuerdos(response.data);
          setTotalRegistros(response.meta?.total || 0);
          setTotalPaginas(response.meta?.totalPages || 1);
        }
      } catch (err) {
        console.error('Error al cargar acuerdos:', err);
        setError('Error al cargar acuerdos de funeraria');
        setAcuerdos([]);
      } finally {
        setLoading(false);
      }
    };
    void cargarAcuerdos();
  }, [paginaActual, busqueda, filtroEstado, ITEMS_POR_PAGINA]);

  // ============================================
  // HELPERS
  // ============================================

  const obtenerColorEstado = (estado: string) => {
    switch (estado) {
      case 'activo':
        return 'bg-emerald-100 text-emerald-800';
      case 'suspendido':
        return 'bg-amber-100 text-amber-800';
      case 'retirado':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const obtenerIconoEstado = (estado: string) => {
    switch (estado) {
      case 'activo':
        return <CheckCircle className="w-3 h-3" />;
      case 'suspendido':
        return <AlertTriangle className="w-3 h-3" />;
      case 'retirado':
        return <XCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  // Ordenar acuerdos según el campo seleccionado
  const acuerdosOrdenados = useMemo(() => {
    const acuerdosCopia = [...acuerdos];

    const obtenerValorOrdenable = (acuerdo: AcuerdoFuneraria): any => {
      if (!sortField.includes('.')) {
        return (acuerdo as any)[sortField];
      }

      const partes = sortField.split('.');
      const obj = partes[0] ?? '';
      const prop = partes[1] ?? '';
      if (!obj || !prop) {
        return undefined;
      }

      const base = (acuerdo as any)[obj];
      return base?.[prop];
    };
    
    acuerdosCopia.sort((a, b) => {
      let compareA: any = obtenerValorOrdenable(a);
      let compareB: any = obtenerValorOrdenable(b);

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

    return acuerdosCopia;
  }, [acuerdos, sortField, sortOrder]);

  const filtrosImpresion = [
    { label: 'Búsqueda', value: busqueda || 'Sin búsqueda' },
    { label: 'Estado', value: filtroEstado === 'todos' ? 'Todos' : filtroEstado },
    { label: 'Tipo', value: filtroTipo === 'todos' ? 'Todos' : filtroTipo },
    { label: 'Página', value: `${paginaActual} de ${totalPaginas}` },
  ];

  const filasImpresion = acuerdosOrdenados.map((acuerdo) => [
    String(acuerdo.id),
    acuerdo.beneficiario.nombre_completo,
    acuerdo.socio?.nombre_completo ?? '-',
    acuerdo.tipo_acuerdo.nombre,
    String(acuerdo.semanas_sin_pago ?? 0),
    acuerdo.estado,
    acuerdo.fecha_inicio ? new Date(acuerdo.fecha_inicio).toLocaleDateString('es-VE') : '-',
  ]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="p-6 space-y-6">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Funeraria</h1>
          <p className="mt-1 text-sm text-gray-500">Gestión de acuerdos de servicio funerario</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Imprimir listado
          </Button>
          <Button
            onClick={() => setModalAbierto('crear')}
            className="flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Nuevo Acuerdo
          </Button>
        </div>
      </div>

      <PrintableListado
        titulo="Listado de Acuerdos Funerarios"
        subtitulo="Listado generado con los filtros y orden actual del módulo de funeraria"
        filtros={filtrosImpresion}
        resumenes={[
          { label: 'Acuerdos visibles', value: String(acuerdosOrdenados.length) },
          { label: 'Total acuerdos', value: String(estadisticas.total_acuerdos) },
          { label: 'Activos', value: String(estadisticas.por_estado.activos) },
          { label: 'Suspendidos', value: String(estadisticas.por_estado.suspendidos) },
        ]}
        columnas={['Acuerdo', 'Beneficiario', 'Socio', 'Tipo', 'Semanas sin pago', 'Estado', 'Fecha inicio']}
        filas={filasImpresion}
      />

      {/* ============================================ */}
      {/* ESTADÍSTICAS */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Acuerdos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {estadisticas.total_acuerdos.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {estadisticas.por_estado.activos} activos
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Activos</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {estadisticas.por_estado.activos.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {estadisticas.por_estado.porcentaje_activos.toFixed(1)}%
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Suspendidos</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {estadisticas.por_estado.suspendidos.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {estadisticas.por_estado.porcentaje_suspendidos.toFixed(1)}%
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Próximos a Suspender</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {estadisticas.proximos_suspender.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">≥ 5 semanas sin pago</p>
            </div>
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* ============================================ */}
      {/* FILTROS Y BÚSQUEDA */}
      {/* ============================================ */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Buscar por beneficiario, cédula o número de acuerdo..."
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPaginaActual(1);
                }}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filtro Estado */}
          <select
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value as typeof filtroEstado);
              setPaginaActual(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="suspendido">Suspendidos</option>
            <option value="retirado">Retirados</option>
          </select>

          {/* Filtro Tipo */}
          <select
            value={filtroTipo}
            onChange={(e) => {
              setFiltroTipo(e.target.value);
              setPaginaActual(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="todos">Todos los tipos</option>
            <option value="01">Funeraria General</option>
          </select>
        </div>
      </Card>

      {/* ============================================ */}
      {/* LISTADO DE ACUERDOS */}
      {/* ============================================ */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader
                  label="Acuerdo"
                  field="id"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Beneficiario"
                  field="nombre_beneficiario"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Socio"
                  field="socio.apellido"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Tipo"
                  field="tipo"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Semanas Sin Pago"
                  field="semanas_sin_pago"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="center"
                />
                <SortableHeader
                  label="Estado"
                  field="estado"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="center"
                />
                <SortableHeader
                  label="Fecha Inicio"
                  field="fecha_inicio"
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
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center gap-2 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Cargando acuerdos...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="text-rose-600">{error}</div>
                  </td>
                </tr>
              ) : acuerdos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron acuerdos
                  </td>
                </tr>
              ) : (
                acuerdosOrdenados.map((acuerdo) => (
                  <tr
                    key={acuerdo.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setAcuerdoSeleccionado(acuerdo);
                      setModalAbierto('detalle');
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <Shield className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            Acuerdo #{acuerdo.id}
                          </div>
                          <div className="text-xs text-gray-500">{acuerdo.tipo_acuerdo.codigo}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {acuerdo.beneficiario.nombre_completo}
                      </div>
                      <div className="text-xs text-gray-500">
                        {acuerdo.beneficiario.cedula} • {acuerdo.beneficiario.parentesco}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {acuerdo.socio ? (
                        <>
                          <div className="text-sm text-gray-900">
                            {acuerdo.socio.nombre_completo}
                          </div>
                          <div className="text-xs text-gray-500">
                            {acuerdo.socio.codigo_socio}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-400 italic">Sin socio asignado</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {acuerdo.tipo_acuerdo.nombre}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        ${acuerdo.tipo_acuerdo.monto_usd} USD
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {acuerdo.semanas_sin_pago >= 5 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {acuerdo.semanas_sin_pago}
                        </span>
                      ) : acuerdo.semanas_sin_pago > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          {acuerdo.semanas_sin_pago}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${obtenerColorEstado(acuerdo.estado)}`}
                      >
                        {obtenerIconoEstado(acuerdo.estado)}
                        {acuerdo.estado.charAt(0).toUpperCase() + acuerdo.estado.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(acuerdo.fecha_inicio).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAcuerdoSeleccionado(acuerdo);
                          setModalAbierto('cambiar-estado');
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Cambiar Estado
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ============================================ */}
        {/* PAGINACIÓN */}
        {/* ============================================ */}
        {!loading && acuerdos.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <Button
                onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                disabled={paginaActual === 1}
                variant="secondary"
              >
                Anterior
              </Button>
              <Button
                onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                variant="secondary"
              >
                Siguiente
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-700">
                  Mostrando{' '}
                  <span className="font-medium">
                    {(paginaActual - 1) * ITEMS_POR_PAGINA + 1}
                  </span>{' '}
                  a{' '}
                  <span className="font-medium">
                    {Math.min(paginaActual * ITEMS_POR_PAGINA, totalRegistros)}
                  </span>{' '}
                  de <span className="font-medium">{totalRegistros}</span> resultados
                </p>
                <select
                  value={ITEMS_POR_PAGINA}
                  onChange={(e) => {
                    setItemsPorPagina(Number(e.target.value))
                    setPaginaActual(1)
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div>
                <nav
                  className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                  aria-label="Pagination"
                >
                  <button
                    onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                    disabled={paginaActual === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Anterior</span>
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  {[...Array(totalPaginas)].map((_, idx) => {
                    const pageNum = idx + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPaginas ||
                      (pageNum >= paginaActual - 1 && pageNum <= paginaActual + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPaginaActual(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            paginaActual === pageNum
                              ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (pageNum === paginaActual - 2 || pageNum === paginaActual + 2) {
                      return (
                        <span
                          key={pageNum}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                        >
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}

                  <button
                    onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                    disabled={paginaActual === totalPaginas}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Siguiente</span>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================ */}
      {/* MODALES */}
      {/* ============================================ */}
      {/* TODO: Implementar modales */}
      {modalAbierto === 'crear' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Crear Nuevo Acuerdo</h3>
            <p className="text-gray-600 mb-4">Modal de creación en desarrollo...</p>
            <Button onClick={() => setModalAbierto(null)} variant="secondary" className="w-full">
              Cerrar
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
