/**
 * ============================================
 * PAGE: AHORRO
 * ============================================
 * Gestión de cuentas de ahorro y movimientos
 * - Listado de cuentas
 * - Apertura de nuevas cuentas
 * - Registro de depósitos y retiros
 * - Consulta de movimientos
 */

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PrintableListado } from '../components/print/PrintableListado';
import { SortableHeader } from '../components/ui/SortableHeader';
import {
  PlusCircle,
  Search,
  Wallet,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Briefcase,
  History,
  Calendar,
  Filter,
  FileText,
} from 'lucide-react';
import * as ahorroService from '../services/ahorroService';
import * as sociosService from '../services/sociosService';
import type { CuentaAhorro, Estadisticas, TipoCuentaAhorro, MovimientoAhorro } from '../services/ahorroService';

// ============================================
// TIPOS
// ============================================
// (Importados desde ahorroService)

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export const AhorroPage = () => {
  // Estados de filtros y modales
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipoCuenta, setFiltroTipoCuenta] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaAhorro | null>(null);
  const [modalAbierto, setModalAbierto] = useState<'apertura' | 'movimiento' | 'detalle' | 'consultar_movimientos' | 'reporte_movimientos' | null>(null);
  const [tiposCuentaFiltro, setTiposCuentaFiltro] = useState<TipoCuentaAhorro[]>([]);

  // Estados para consulta de movimientos
  const [movimientos, setMovimientos] = useState<MovimientoAhorro[]>([]);
  const [movimientosDetalle, setMovimientosDetalle] = useState<MovimientoAhorro[]>([]);
  const [movimientoDetalleSeleccionado, setMovimientoDetalleSeleccionado] = useState<MovimientoAhorro | null>(null);
  const [loadingMovimientosDetalle, setLoadingMovimientosDetalle] = useState(false);
  const [errorMovimientosDetalle, setErrorMovimientosDetalle] = useState<string | null>(null);
  const [paginaMovimientosDetalle, setPaginaMovimientosDetalle] = useState(1);
  const [totalPaginasMovimientosDetalle, setTotalPaginasMovimientosDetalle] = useState(1);
  const [totalMovimientosDetalle, setTotalMovimientosDetalle] = useState(0);
  const [busquedaMovimientos, setBusquedaMovimientos] = useState('');
  const [cuentaMovimientos, setCuentaMovimientos] = useState<number | null>(null);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState<string>('todos');
  const [paginaMovimientos, setPaginaMovimientos] = useState(1);
  const [totalPaginasMovimientos, setTotalPaginasMovimientos] = useState(1);
  const [totalMovimientos, setTotalMovimientos] = useState(0);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [cuentaEncontrada, setCuentaEncontrada] = useState<CuentaAhorro | null>(null);
  const [cuentasEncontradas, setCuentasEncontradas] = useState<CuentaAhorro[]>([]);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);

  // Estados para reporte de movimientos
  const [reporteTipoCuenta, setReporteTipoCuenta] = useState<string>('todos');
  const [reporteFechaDesde, setReporteFechaDesde] = useState('');
  const [reporteFechaHasta, setReporteFechaHasta] = useState('');
  const [reporteTipoMovimiento, setReporteTipoMovimiento] = useState<string>('todos');
  const [reporteMovimientos, setReporteMovimientos] = useState<MovimientoAhorro[]>([]);
  const [reportePagina, setReportePagina] = useState(1);
  const [reporteTotalPaginas, setReporteTotalPaginas] = useState(1);
  const [reporteTotal, setReporteTotal] = useState(0);
  const [loadingReporte, setLoadingReporte] = useState(false);

  // Estados de datos
  const [cuentas, setCuentas] = useState<CuentaAhorro[]>([]);
  const [estadisticas, setEstadisticas] = useState<Estadisticas>({
    total_cuentas: 0,
    cuentas_activas: 0,
    cuentas_inactivas: 0,
    total_saldo_usd: 0,
    total_saldo_bs: 0,
    total_bloqueado_usd: 0,
    total_bloqueado_bs: 0,
    total_movimientos: 0,
  });
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(20);

  // Estados de ordenamiento
  const [sortField, setSortField] = useState<string>('numero_cuenta');
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

  // Cuando una cuenta fue migrada o aperturada sin detalle histórico,
  // mostramos un movimiento inicial inferido para evitar inconsistencias visuales.
  const crearMovimientoInicialInferido = (cuenta: CuentaAhorro): MovimientoAhorro => {
    const montoUsd = Number(cuenta.saldo_usd || 0);
    const montoBs = Number(cuenta.saldo_bs || 0);
    const tasa = montoUsd > 0 ? montoBs / montoUsd : 0;

    return {
      id: -cuenta.id,
      cuenta_id: cuenta.id,
      tipo_movimiento: 'deposito',
      monto_usd: montoUsd,
      monto_bs: montoBs,
      tasa_cambio: Number.isFinite(tasa) ? tasa : 0,
      saldo_anterior_usd: 0,
      saldo_nuevo_usd: montoUsd,
      concepto: 'Saldo inicial (migración/apertura sin historial detallado)',
      referencia: 'MIGRACION_INICIAL',
      fecha_movimiento: cuenta.fecha_apertura,
      created_at: cuenta.fecha_apertura,
    };
  };

  // Cargar estadísticas y tipos de cuenta (una sola vez)
  useEffect(() => {
    const cargarEstadisticas = async () => {
      try {
        const response = await ahorroService.obtenerEstadisticas();
        if (response.success) {
          setEstadisticas(response.data);
        }
      } catch (err) {
        console.error('Error al cargar estadísticas:', err);
      }
    };
    void cargarEstadisticas();

    const cargarTiposCuenta = async () => {
      try {
        const response = await ahorroService.obtenerTiposCuenta();
        if (response.success) {
          setTiposCuentaFiltro(response.data);
        }
      } catch (err) {
        console.error('Error al cargar tipos de cuenta:', err);
      }
    };
    void cargarTiposCuenta();
  }, []);

  // Cargar cuentas con paginación
  useEffect(() => {
    const cargarCuentas = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await ahorroService.obtenerCuentas({
          page: paginaActual,
          limit: registrosPorPagina,
          busqueda: busqueda || undefined,
          estado: filtroEstado === 'todos' ? undefined : filtroEstado === 'activas',
          tipo_cuenta_id: filtroTipoCuenta === 'todos' ? undefined : Number(filtroTipoCuenta),
        });
        
        if (response.success) {
          setCuentas(response.data);
          setTotalPaginas(response.meta.totalPages);
          setTotalRegistros(response.meta.total);
        }
      } catch (err) {
        console.error('Error al cargar cuentas:', err);
        setError('Error al cargar cuentas de ahorro');
        setCuentas([]);
      } finally {
        setLoading(false);
      }
    };
    void cargarCuentas();
  }, [paginaActual, busqueda, filtroEstado, filtroTipoCuenta, registrosPorPagina]);

  // Recargar movimientos cuando cambia la paginación
  useEffect(() => {
    if (!cuentaMovimientos) return;

    const cargarMovimientos = async () => {
      setLoadingMovimientos(true);
      try {
        const respMovs = await ahorroService.consultarMovimientos({
          cuenta_id: cuentaMovimientos,
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
          tipo_movimiento: tipoMovimiento === 'todos' ? undefined : (tipoMovimiento as 'deposito' | 'retiro'),
          page: paginaMovimientos,
          limit: 20,
        });

        if (respMovs.success) {
          setMovimientos(respMovs.data);
          setTotalPaginasMovimientos(respMovs.meta.totalPages);
          setTotalMovimientos(respMovs.meta.total);
        }
      } catch (error) {
        console.error('Error al cargar movimientos:', error);
      } finally {
        setLoadingMovimientos(false);
      }
    };
    void cargarMovimientos();
  }, [paginaMovimientos, cuentaMovimientos, fechaDesde, fechaHasta, tipoMovimiento]);

  // Cargar movimientos en el modal de detalle de cuenta con paginación
  useEffect(() => {
    if (modalAbierto !== 'detalle' || !cuentaSeleccionada) {
      setMovimientosDetalle([]);
      setMovimientoDetalleSeleccionado(null);
      setErrorMovimientosDetalle(null);
      setPaginaMovimientosDetalle(1);
      setTotalPaginasMovimientosDetalle(1);
      setTotalMovimientosDetalle(0);
      return;
    }

    const cargarMovimientosDetalle = async () => {
      setLoadingMovimientosDetalle(true);
      setErrorMovimientosDetalle(null);

      try {
        const response = await ahorroService.consultarMovimientos({
          cuenta_id: cuentaSeleccionada.id,
          page: paginaMovimientosDetalle,
          limit: 8,
        });

        if (response.success) {
          const tieneSaldo =
            Number(cuentaSeleccionada.saldo_usd) > 0 || Number(cuentaSeleccionada.saldo_bs) > 0;

          if (response.data.length === 0 && tieneSaldo) {
            const movimientoInferido = crearMovimientoInicialInferido(cuentaSeleccionada);
            setMovimientosDetalle([movimientoInferido]);
            setMovimientoDetalleSeleccionado(movimientoInferido);
            setTotalPaginasMovimientosDetalle(1);
            setTotalMovimientosDetalle(1);
          } else {
            setMovimientosDetalle(response.data);
            setMovimientoDetalleSeleccionado(response.data[0] || null);
            setTotalPaginasMovimientosDetalle(response.meta.totalPages);
            setTotalMovimientosDetalle(response.meta.total);
          }
        }
      } catch (err) {
        console.error('Error al cargar movimientos del detalle:', err);
        setErrorMovimientosDetalle('No se pudo cargar el historial de movimientos');
        setMovimientosDetalle([]);
        setMovimientoDetalleSeleccionado(null);
      } finally {
        setLoadingMovimientosDetalle(false);
      }
    };

    void cargarMovimientosDetalle();
  }, [modalAbierto, cuentaSeleccionada, paginaMovimientosDetalle]);

  // Recargar reporte de movimientos cuando cambia la paginación
  useEffect(() => {
    if (!reporteFechaDesde && !reporteFechaHasta && reporteTipoCuenta === 'todos' && reporteTipoMovimiento === 'todos') return;
    if (reportePagina === 1) return; // Evitar doble carga inicial

    const cargarReporte = async () => {
      setLoadingReporte(true);
      try {
        const params: any = {
          page: reportePagina,
          limit: 20,
        };

        if (reporteFechaDesde) params.fecha_desde = reporteFechaDesde;
        if (reporteFechaHasta) params.fecha_hasta = reporteFechaHasta;
        if (reporteTipoCuenta !== 'todos') params.tipo_cuenta_id = Number(reporteTipoCuenta);
        if (reporteTipoMovimiento !== 'todos') params.tipo_movimiento = reporteTipoMovimiento;

        const response = await ahorroService.consultarMovimientos(params);
        
        if (response.success) {
          setReporteMovimientos(response.data);
          setReporteTotalPaginas(response.meta.totalPages);
          setReporteTotal(response.meta.total);
        }
      } catch (error) {
        console.error('Error al cargar reporte:', error);
      } finally {
        setLoadingReporte(false);
      }
    };
    void cargarReporte();
  }, [reportePagina]);

  const saldoDisponibleUsd = estadisticas.total_saldo_usd - estadisticas.total_bloqueado_usd;
  const saldoDisponibleBs = estadisticas.total_saldo_bs - estadisticas.total_bloqueado_bs;

  // ============================================
  // MODAL: Reporte de Movimientos
  // ============================================
  const ModalReporteMovimientos = () => createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => setModalAbierto(null)}
    >
      <Card
        className="w-full max-w-7xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold">Reporte de Movimientos</h2>
              <p className="text-sm text-gray-600 mt-1">
                Consulta movimientos con filtros avanzados
              </p>
            </div>
            <button
              onClick={() => setModalAbierto(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Filtros */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6 space-y-4">
            {/* Fila 1: Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Desde:
                </label>
                <input
                  type="date"
                  value={reporteFechaDesde}
                  onChange={(e) => setReporteFechaDesde(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Hasta:
                </label>
                <input
                  type="date"
                  value={reporteFechaHasta}
                  onChange={(e) => setReporteFechaHasta(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 opacity-0">
                  Acción
                </label>
                <Button
                  onClick={async () => {
                    setLoadingReporte(true);
                    try {
                      const params: any = {
                        page: 1,
                        limit: 20,
                      };

                      // Convertir fechas a formato ISO datetime
                      if (reporteFechaDesde) {
                        params.fecha_desde = new Date(reporteFechaDesde + 'T00:00:00').toISOString();
                      }
                      if (reporteFechaHasta) {
                        params.fecha_hasta = new Date(reporteFechaHasta + 'T23:59:59').toISOString();
                      }
                      if (reporteTipoCuenta !== 'todos') {
                        params.tipo_cuenta_id = Number(reporteTipoCuenta);
                      }
                      if (reporteTipoMovimiento !== 'todos') {
                        params.tipo_movimiento = reporteTipoMovimiento;
                      }

                      const response = await ahorroService.consultarMovimientos(params);
                      
                      if (response.success) {
                        setReporteMovimientos(response.data);
                        setReporteTotalPaginas(response.meta.totalPages);
                        setReporteTotal(response.meta.total);
                        setReportePagina(1);
                      } else {
                        alert('Error al cargar movimientos');
                      }
                    } catch (error) {
                      console.error('Error:', error);
                      alert('Error al cargar movimientos');
                    } finally {
                      setLoadingReporte(false);
                    }
                  }}
                  disabled={loadingReporte}
                  className="w-full"
                >
                  {loadingReporte ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Aceptar
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Fila 2: Tipo de cuenta y tipo de movimiento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Filter className="w-4 h-4 inline mr-1" />
                  Tipo de Cuenta:
                </label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                  <select
                    value={reporteTipoCuenta}
                    onChange={(e) => setReporteTipoCuenta(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white cursor-pointer hover:border-blue-400 transition-colors"
                  >
                    <option value="todos">Todos los tipos</option>
                    {tiposCuentaFiltro.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.codigo} - {tipo.nombre}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  Tipo de Movimiento:
                </label>
                <div className="relative">
                  <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                  <select
                    value={reporteTipoMovimiento}
                    onChange={(e) => setReporteTipoMovimiento(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white cursor-pointer hover:border-blue-400 transition-colors"
                  >
                    <option value="todos">Todos los movimientos</option>
                    <option value="deposito">💰 Depósitos</option>
                    <option value="retiro">💸 Retiros</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Resultados */}
          {reporteMovimientos.length > 0 ? (
            <>
              {/* Resumen */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>{reporteTotal}</strong> movimientos encontrados
                  {reporteFechaDesde && reporteFechaHasta && (
                    <> desde <strong>{reporteFechaDesde}</strong> hasta <strong>{reporteFechaHasta}</strong></>
                  )}
                </p>
              </div>

              {/* Tabla de movimientos */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left p-3 font-medium text-sm text-gray-700">Fecha</th>
                      <th className="text-left p-3 font-medium text-sm text-gray-700">N° Cuenta</th>
                      <th className="text-left p-3 font-medium text-sm text-gray-700">Socio</th>
                      <th className="text-left p-3 font-medium text-sm text-gray-700">Tipo</th>
                      <th className="text-right p-3 font-medium text-sm text-gray-700">Monto USD</th>
                      <th className="text-right p-3 font-medium text-sm text-gray-700">Monto Bs</th>
                      <th className="text-right p-3 font-medium text-sm text-gray-700">Tasa</th>
                      <th className="text-right p-3 font-medium text-sm text-gray-700">Saldo USD</th>
                      <th className="text-left p-3 font-medium text-sm text-gray-700">Concepto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteMovimientos.map((mov) => (
                      <tr key={mov.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">
                          {new Date(mov.fecha_movimiento).toLocaleDateString('es-VE')}
                        </td>
                        <td className="p-3 text-sm font-mono">
                          {mov.cuenta?.numero_cuenta}
                        </td>
                        <td className="p-3 text-sm">
                          {mov.cuenta?.socio?.nombre} {mov.cuenta?.socio?.apellido}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              mov.tipo_movimiento === 'deposito'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {mov.tipo_movimiento === 'deposito' ? 'Depósito' : 'Retiro'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-right font-mono">
                          ${Number(mov.monto_usd).toFixed(2)}
                        </td>
                        <td className="p-3 text-sm text-right font-mono">
                          Bs {Number(mov.monto_bs).toFixed(2)}
                        </td>
                        <td className="p-3 text-sm text-right font-mono">
                          {Number(mov.tasa_cambio).toFixed(2)}
                        </td>
                        <td className="p-3 text-sm text-right font-mono font-semibold text-blue-600">
                          ${Number(mov.saldo_nuevo_usd).toFixed(2)}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {mov.concepto || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {reporteTotalPaginas > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t">
                  <Button
                    onClick={async () => {
                      if (reportePagina <= 1) return;
                      setLoadingReporte(true);
                      try {
                        const params: any = {
                          page: reportePagina - 1,
                          limit: 20,
                        };
                        if (reporteFechaDesde) {
                          params.fecha_desde = new Date(reporteFechaDesde + 'T00:00:00').toISOString();
                        }
                        if (reporteFechaHasta) {
                          params.fecha_hasta = new Date(reporteFechaHasta + 'T23:59:59').toISOString();
                        }
                        if (reporteTipoCuenta !== 'todos') params.tipo_cuenta_id = Number(reporteTipoCuenta);
                        if (reporteTipoMovimiento !== 'todos') params.tipo_movimiento = reporteTipoMovimiento;

                        const response = await ahorroService.consultarMovimientos(params);
                        if (response.success) {
                          setReporteMovimientos(response.data);
                          setReportePagina(reportePagina - 1);
                        }
                      } finally {
                        setLoadingReporte(false);
                      }
                    }}
                    disabled={reportePagina <= 1 || loadingReporte}
                    variant="secondary"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Anterior
                  </Button>

                  <span className="text-sm text-gray-600">
                    Página {reportePagina} de {reporteTotalPaginas}
                  </span>

                  <Button
                    onClick={async () => {
                      if (reportePagina >= reporteTotalPaginas) return;
                      setLoadingReporte(true);
                      try {
                        const params: any = {
                          page: reportePagina + 1,
                          limit: 20,
                        };
                        if (reporteFechaDesde) {
                          params.fecha_desde = new Date(reporteFechaDesde + 'T00:00:00').toISOString();
                        }
                        if (reporteFechaHasta) {
                          params.fecha_hasta = new Date(reporteFechaHasta + 'T23:59:59').toISOString();
                        }
                        if (reporteTipoCuenta !== 'todos') params.tipo_cuenta_id = Number(reporteTipoCuenta);
                        if (reporteTipoMovimiento !== 'todos') params.tipo_movimiento = reporteTipoMovimiento;

                        const response = await ahorroService.consultarMovimientos(params);
                        if (response.success) {
                          setReporteMovimientos(response.data);
                          setReportePagina(reportePagina + 1);
                        }
                      } finally {
                        setLoadingReporte(false);
                      }
                    }}
                    disabled={reportePagina >= reporteTotalPaginas || loadingReporte}
                    variant="secondary"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium mb-2">
                No hay movimientos
              </p>
              <p className="text-sm text-gray-400">
                Selecciona los filtros y haz clic en "Aceptar"
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>,
    document.body
  );

  // Ordenar cuentas seg\u00fan el campo seleccionado
  const cuentasOrdenadas = useMemo(() => {
    const cuentasCopia = [...cuentas];
    
    cuentasCopia.sort((a, b) => {
      let compareA: any;
      let compareB: any;

      // Manejar campos anidados
      if (sortField.includes('.')) {
        const [obj = '', prop = ''] = sortField.split('.');
        compareA = (a as any)[obj]?.[prop];
        compareB = (b as any)[obj]?.[prop];
      } else {
        compareA = (a as any)[sortField];
        compareB = (b as any)[sortField];
      }

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

    return cuentasCopia;
  }, [cuentas, sortField, sortOrder]);

  const filtrosImpresion = [
    { label: 'Búsqueda', value: busqueda || 'Sin búsqueda' },
    { label: 'Tipo de cuenta', value: filtroTipoCuenta === 'todos' ? 'Todos' : (tiposCuentaFiltro.find((tipo) => String(tipo.id) === filtroTipoCuenta)?.nombre ?? filtroTipoCuenta) },
    { label: 'Estado', value: filtroEstado === 'todos' ? 'Todos' : (filtroEstado === 'activa' ? 'Activas' : 'Inactivas') },
    { label: 'Página', value: `${paginaActual} de ${totalPaginas}` },
  ];

  const filasImpresion = cuentasOrdenadas.map((cuenta) => [
    cuenta.numero_cuenta,
    `${cuenta.socio.apellido}, ${cuenta.socio.nombre}`,
    cuenta.tipo_cuenta?.nombre ?? 'Sin tipo',
    `$${cuenta.saldo_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `Bs ${cuenta.saldo_bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `${cuenta.monto_bloqueado_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`,
    String(cuenta._count?.movimientos ?? 0),
    cuenta.estado ? 'Activa' : 'Inactiva',
  ]);

  return (
    <div className="p-6 space-y-6">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ahorro</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestión de cuentas de ahorro y movimientos
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => window.print()}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Imprimir listado
          </Button>
          <Button
            onClick={() => setModalAbierto('consultar_movimientos')}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            Consultar Movimientos
          </Button>
          <Button
            onClick={() => setModalAbierto('reporte_movimientos')}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Reporte de Movimientos
          </Button>
          <Button
            onClick={() => setModalAbierto('movimiento')}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Registrar Movimiento
          </Button>
          <Button
            onClick={() => setModalAbierto('apertura')}
            className="flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Apertura de Cuenta
          </Button>
        </div>
      </div>

      <PrintableListado
        titulo="Listado de Cuentas de Ahorro"
        subtitulo="Listado generado con los filtros y orden actual del módulo de ahorro"
        filtros={filtrosImpresion}
        resumenes={[
          { label: 'Cuentas visibles', value: String(cuentasOrdenadas.length) },
          { label: 'Total cuentas', value: String(estadisticas.total_cuentas) },
          { label: 'Activas', value: String(estadisticas.cuentas_activas) },
          { label: 'Saldo USD', value: `$${estadisticas.total_saldo_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        ]}
        columnas={['Cuenta', 'Socio', 'Tipo', 'Saldo USD', 'Saldo Bs', 'Bloqueado USD', 'Movimientos', 'Estado']}
        filas={filasImpresion}
      />

      {/* ============================================ */}
      {/* ESTADÍSTICAS */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Cuentas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {estadisticas.total_cuentas.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {estadisticas.cuentas_activas} activas
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <Wallet className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Ahorrado USD</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                ${estadisticas.total_saldo_usd.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Disponible: ${saldoDisponibleUsd.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Ahorrado Bs</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {(estadisticas.total_saldo_bs / 1000000).toFixed(2)}M Bs
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Disponible: {(saldoDisponibleBs / 1000000).toFixed(2)}M Bs
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        {/* Card de Bloqueado USD oculto - se usará cuando se implementen préstamos con fiadores */}
        {/* <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Bloqueado USD</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                ${estadisticas.total_bloqueado_usd.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {estadisticas.total_movimientos.toLocaleString()} movimientos
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card> */}
      </div>

      {/* ============================================ */}
      {/* FILTROS Y BÚSQUEDA */}
      {/* ============================================ */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Buscador */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Buscar por número de cuenta, cédula, nombre del socio..."
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPaginaActual(1);
                }}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filtro Tipo de Cuenta */}
          <select
            value={filtroTipoCuenta}
            onChange={(e) => {
              setFiltroTipoCuenta(e.target.value);
              setPaginaActual(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="todos">Todos los tipos</option>
            {tiposCuentaFiltro.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                [{tipo.codigo}] {tipo.nombre}
              </option>
            ))}
          </select>

          {/* Filtro Estado */}
          <select
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value);
              setPaginaActual(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="todos">Todos los estados</option>
            <option value="activa">Activas</option>
            <option value="inactiva">Inactivas</option>
          </select>
        </div>
      </Card>

      {/* ============================================ */}
      {/* LISTADO DE CUENTAS */}
      {/* ============================================ */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader
                  label="Cuenta"
                  field="numero_cuenta"
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
                  field="tipo_cuenta.nombre"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Saldo USD"
                  field="saldo_usd"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Saldo Bs"
                  field="saldo_bs"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Bloqueado USD"
                  field="monto_bloqueado_usd"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="center"
                />
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Movimientos
                </th>
                <SortableHeader
                  label="Estado"
                  field="estado"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  align="center"
                />
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                      <p className="text-gray-500">Cargando cuentas...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-red-600">{error}</p>
                  </td>
                </tr>
              ) : cuentas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-gray-500">No se encontraron cuentas</p>
                  </td>
                </tr>
              ) : cuentasOrdenadas.map((cuenta) => {
                const disponibleUsd = cuenta.saldo_usd - cuenta.monto_bloqueado_usd;
                
                return (
                  <tr
                    key={cuenta.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setCuentaSeleccionada(cuenta);
                      setPaginaMovimientosDetalle(1);
                      setModalAbierto('detalle');
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <Wallet className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {cuenta.numero_cuenta}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(cuenta.fecha_apertura).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {cuenta.socio.nombre} {cuenta.socio.apellido}
                      </div>
                      <div className="text-xs text-gray-500">
                        {cuenta.socio.codigo_socio} • {cuenta.socio.cedula}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {cuenta.tipo_cuenta.nombre}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-emerald-600">
                        ${cuenta.saldo_usd.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      {cuenta.monto_bloqueado_usd > 0 && (
                        <div className="text-xs text-gray-500">
                          Disp: ${disponibleUsd.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {cuenta.saldo_bs.toLocaleString('es-ES', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} Bs
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {cuenta.monto_bloqueado_usd > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          ${cuenta.monto_bloqueado_usd.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-900">
                        {cuenta._count.movimientos}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {cuenta.estado ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCuentaSeleccionada(cuenta);
                          setModalAbierto('detalle');
                        }}
                        className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                      >
                        Ver detalle
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </td>
                  </tr>
                );
              })}
                            setPaginaMovimientosDetalle(1);
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && cuentas.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm text-gray-700">
                Mostrando {(paginaActual - 1) * registrosPorPagina + 1} a{' '}
                {Math.min(paginaActual * registrosPorPagina, totalRegistros)} de {totalRegistros} cuentas
              </div>
              <select
                value={registrosPorPagina}
                onChange={(e) => {
                  setRegistrosPorPagina(Number(e.target.value))
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setPaginaActual(paginaActual - 1)}
                disabled={paginaActual === 1}
                variant="secondary"
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>

              <div className="flex flex-wrap gap-1">
                {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                  let pageNum;
                  if (totalPaginas <= 5) {
                    pageNum = i + 1;
                  } else if (paginaActual <= 3) {
                    pageNum = i + 1;
                  } else if (paginaActual >= totalPaginas - 2) {
                    pageNum = totalPaginas - 4 + i;
                  } else {
                    pageNum = paginaActual - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      onClick={() => setPaginaActual(pageNum)}
                      variant={paginaActual === pageNum ? 'primary' : 'secondary'}
                      className="w-9 h-9 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                onClick={() => setPaginaActual(paginaActual + 1)}
                disabled={paginaActual === totalPaginas}
                variant="secondary"
                className="flex items-center gap-1"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================ */}
      {/* MODALES */}
      {/* ============================================ */}
      {modalAbierto === 'apertura' && (
        <ModalAperturaCuenta
          onClose={() => setModalAbierto(null)}
          onSuccess={() => {
            setModalAbierto(null);
            // Recargar cuentas
            const cargarCuentas = async () => {
              const response = await ahorroService.obtenerCuentas({
                page: paginaActual,
                limit: registrosPorPagina,
              });
              if (response.success) {
                setCuentas(response.data);
              }
            };
            void cargarCuentas();
          }}
        />
      )}

      {modalAbierto === 'movimiento' && createPortal(
        <div className="fixed top-0 left-0 right-0 bottom-0 m-0 bg-black/50 flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <Card className="max-w-2xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Registrar Movimiento</h2>
              <button
                onClick={() => setModalAbierto(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-600">
              Formulario de depósito/retiro (próximamente)
            </p>
          </Card>
        </div>,
        document.body
      )}

      {modalAbierto === 'detalle' && cuentaSeleccionada && createPortal(
        <div className="fixed top-0 left-0 right-0 bottom-0 m-0 bg-black/50 flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <Card className="max-w-4xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  Cuenta {cuentaSeleccionada.numero_cuenta}
                </h2>
                <p className="text-gray-600">
                  {cuentaSeleccionada.socio.nombre} {cuentaSeleccionada.socio.apellido}
                </p>
              </div>
              <button
                onClick={() => setModalAbierto(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Saldo USD</p>
                <p className="text-2xl font-bold text-emerald-600">
                  ${Number(cuentaSeleccionada.saldo_usd).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Saldo Bs</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {Number(cuentaSeleccionada.saldo_bs).toFixed(2)} Bs
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Historial de movimientos</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setModalAbierto('consultar_movimientos');
                    setBusquedaMovimientos(cuentaSeleccionada.numero_cuenta);
                    setCuentaMovimientos(cuentaSeleccionada.id);
                    setCuentaEncontrada(cuentaSeleccionada);
                    setCuentasEncontradas([cuentaSeleccionada]);
                    setBusquedaRealizada(true);
                    setPaginaMovimientos(1);
                  }}
                >
                  Ver completo
                </Button>
              </div>

              {loadingMovimientosDetalle ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Cargando historial...
                </div>
              ) : errorMovimientosDetalle ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMovimientosDetalle}
                </div>
              ) : movimientosDetalle.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-gray-600">
                  Esta cuenta no tiene movimientos registrados.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                        {movimientosDetalle.map((mov) => (
                          <button
                            key={mov.id}
                            type="button"
                            onClick={() => setMovimientoDetalleSeleccionado(mov)}
                            className={`w-full px-4 py-3 text-left transition-colors ${
                              movimientoDetalleSeleccionado?.id === mov.id
                                ? 'bg-indigo-50 border-l-4 border-indigo-500'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  mov.tipo_movimiento === 'deposito'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {mov.tipo_movimiento === 'deposito' ? 'Depósito' : 'Retiro'}
                              </span>
                              <span className="text-sm font-semibold text-gray-900">
                                ${Number(mov.monto_usd).toFixed(2)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {new Date(mov.fecha_movimiento).toLocaleString('es-VE')}
                            </div>
                            <div className="mt-1 text-xs text-gray-600 truncate">
                              {mov.concepto || 'Sin concepto'}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      {movimientoDetalleSeleccionado ? (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-900">Detalle del movimiento</h4>
                          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                            <div>
                              <p className="text-gray-500">Fecha</p>
                              <p className="font-medium text-gray-900">
                                {new Date(movimientoDetalleSeleccionado.fecha_movimiento).toLocaleString('es-VE')}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Tipo</p>
                              <p className="font-medium text-gray-900 capitalize">
                                {movimientoDetalleSeleccionado.tipo_movimiento}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Monto USD</p>
                              <p className="font-medium text-gray-900">
                                ${Number(movimientoDetalleSeleccionado.monto_usd).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Monto Bs</p>
                              <p className="font-medium text-gray-900">
                                {Number(movimientoDetalleSeleccionado.monto_bs).toFixed(2)} Bs
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Tasa</p>
                              <p className="font-medium text-gray-900">
                                {Number(movimientoDetalleSeleccionado.tasa_cambio).toFixed(4)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Saldo nuevo USD</p>
                              <p className="font-medium text-gray-900">
                                ${Number(movimientoDetalleSeleccionado.saldo_nuevo_usd).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-gray-500 text-sm">Concepto</p>
                            <p className="text-sm font-medium text-gray-900">
                              {movimientoDetalleSeleccionado.concepto || 'Sin concepto'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-sm">Referencia</p>
                            <p className="text-sm font-medium text-gray-900">
                              {movimientoDetalleSeleccionado.referencia || 'Sin referencia'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">Selecciona un movimiento para ver su detalle.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                    <p className="text-sm text-gray-600">
                      Mostrando {movimientosDetalle.length} de {totalMovimientosDetalle} movimientos
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPaginaMovimientosDetalle((prev) => Math.max(1, prev - 1))}
                        disabled={paginaMovimientosDetalle === 1 || loadingMovimientosDetalle}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </Button>
                      <span className="text-sm text-gray-600">
                        Página {paginaMovimientosDetalle} de {totalPaginasMovimientosDetalle}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setPaginaMovimientosDetalle((prev) =>
                            Math.min(totalPaginasMovimientosDetalle, prev + 1)
                          )
                        }
                        disabled={
                          paginaMovimientosDetalle === totalPaginasMovimientosDetalle ||
                          loadingMovimientosDetalle
                        }
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>,
        document.body
      )}

      {/* Modal Consultar Movimientos */}
      {modalAbierto === 'consultar_movimientos' && createPortal(
        <div className="fixed top-0 left-0 right-0 bottom-0 m-0 bg-black/50 flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <Card className="max-w-7xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Consultar Movimientos</h2>
              <button
                onClick={() => {
                  setModalAbierto(null);
                  // Limpiar todos los estados
                  setBusquedaMovimientos('');
                  setCuentaMovimientos(null);
                  setFechaDesde('');
                  setFechaHasta('');
                  setTipoMovimiento('todos');
                  setMovimientos([]);
                  setCuentaEncontrada(null);
                  setCuentasEncontradas([]);
                  setBusquedaRealizada(false);
                  setPaginaMovimientos(1);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Formulario de búsqueda */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
              {/* Búsqueda por cuenta o cédula */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar por Número de Cuenta o Cédula
                </label>
                <div className="flex gap-2">
                  <Input
                    value={busquedaMovimientos}
                    onChange={(e) => {
                      setBusquedaMovimientos(e.target.value);
                      // Resetear búsqueda cuando el usuario escribe
                      if (busquedaRealizada) {
                        setBusquedaRealizada(false);
                        setCuentaEncontrada(null);
                        setCuentasEncontradas([]);
                        setMovimientos([]);
                        setCuentaMovimientos(null);
                      }
                    }}
                    placeholder="Ingrese número de cuenta o cédula..."
                    className="flex-1"
                    onKeyPress={async (e) => {
                      if (e.key === 'Enter' && busquedaMovimientos.trim() && !loadingMovimientos) {
                        // Trigger el mismo handler que el botón
                        e.currentTarget.blur(); // Quitar foco del input
                        const buttonBuscar = e.currentTarget.nextElementSibling as HTMLButtonElement;
                        buttonBuscar?.click();
                      }
                    }}
                  />
                  <Button
                    onClick={async () => {
                      if (!busquedaMovimientos.trim()) return;
                      
                      console.log('🔍 Buscando cuenta:', busquedaMovimientos.trim());
                      
                      setLoadingMovimientos(true);
                      setBusquedaRealizada(false);
                      
                      await new Promise(resolve => setTimeout(resolve, 50));
                      
                      // Limpiar todos los estados de búsqueda anterior
                      setCuentaEncontrada(null);
                      setCuentasEncontradas([]);
                      setMovimientos([]);
                      setCuentaMovimientos(null);
                      
                      try {
                        console.log('📡 Llamando a ahorroService.obtenerCuentas...');
                        const response = await ahorroService.obtenerCuentas({
                          busqueda: busquedaMovimientos.trim(),
                        });
                        console.log('📥 Respuesta recibida:', response);

                        setBusquedaRealizada(true);

                        if (response.success && response.data.length > 0) {
                          setCuentasEncontradas(response.data);
                          
                          // Si hay solo 1 cuenta, seleccionarla automáticamente
                          if (response.data.length === 1) {
                            const cuenta = response.data[0];
                            if (cuenta) {
                              setCuentaEncontrada(cuenta);
                              setCuentaMovimientos(cuenta.id);
                              
                              // Cargar movimientos automáticamente
                              const respMovs = await ahorroService.consultarMovimientos({
                                cuenta_id: cuenta.id,
                                page: 1,
                                limit: 20,
                              });
                              
                              if (respMovs.success) {
                                setMovimientos(respMovs.data);
                                setTotalPaginasMovimientos(respMovs.meta.totalPages);
                                setTotalMovimientos(respMovs.meta.total);
                                setPaginaMovimientos(1);
                              }
                            }
                          }
                          // Si hay múltiples cuentas, el usuario debe seleccionar una
                        } else {
                          setCuentaEncontrada(null);
                          setMovimientos([]);
                          setCuentaMovimientos(null);
                        }
                      } catch (error) {
                        console.error('Error al buscar cuenta:', error);
                        setBusquedaRealizada(true);
                        setCuentaEncontrada(null);
                        setCuentasEncontradas([]);
                        setMovimientos([]);
                        setCuentaMovimientos(null);
                      } finally {
                        setLoadingMovimientos(false);
                      }
                    }}
                    disabled={!busquedaMovimientos || loadingMovimientos}
                    className="flex items-center gap-2"
                  >
                    {loadingMovimientos ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Buscar
                  </Button>
                </div>
              </div>

              {/* Selector de cuentas si hay múltiples */}
              {cuentasEncontradas.length > 1 && !cuentaEncontrada && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-blue-500 rounded-full p-2">
                      <Wallet className="w-5 h-5 text-on-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-900">
                        {cuentasEncontradas.length} Cuentas Encontradas
                      </p>
                      <p className="text-xs text-blue-700">
                        Seleccione la cuenta que desea consultar
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2">
                    {cuentasEncontradas.map((cuenta) => (
                      <button
                        key={cuenta.id}
                        onClick={async () => {
                          setCuentaEncontrada(cuenta);
                          setCuentaMovimientos(cuenta.id);
                          setLoadingMovimientos(true);
                          
                          try {
                            const respMovs = await ahorroService.consultarMovimientos({
                              cuenta_id: cuenta.id,
                              page: 1,
                              limit: 20,
                            });
                            
                            if (respMovs.success) {
                              setMovimientos(respMovs.data);
                              setTotalPaginasMovimientos(respMovs.meta.totalPages);
                              setTotalMovimientos(respMovs.meta.total);
                              setPaginaMovimientos(1);
                            }
                          } catch (error) {
                            console.error('Error al cargar movimientos:', error);
                          } finally {
                            setLoadingMovimientos(false);
                          }
                        }}
                        className="bg-white hover:bg-blue-100 hover:border-blue-400 border-2 border-blue-200 rounded-lg p-3 transition-all duration-200 text-left group shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-on-accent font-bold text-sm">
                              {cuenta.tipo_cuenta.codigo}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition-colors">
                              {cuenta.numero_cuenta}
                            </p>
                            <p className="text-xs text-gray-600 truncate">
                              {cuenta.tipo_cuenta.nombre}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-gray-900">
                              ${Number(cuenta.saldo_usd).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Bs {Number(cuenta.saldo_bs).toFixed(2)}
                            </p>
                          </div>
                          <ChevronDown className="w-5 h-5 text-blue-600 transform -rotate-90 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Información de la cuenta encontrada */}
              {cuentaEncontrada && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-emerald-100 p-2 rounded-lg">
                      <Wallet className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-emerald-900">
                        {cuentaEncontrada.socio.nombre} {cuentaEncontrada.socio.apellido}
                      </p>
                      <p className="text-sm text-emerald-700">
                        Cuenta: {cuentaEncontrada.numero_cuenta} | 
                        Cédula: {cuentaEncontrada.socio.cedula} | 
                        Tipo: {cuentaEncontrada.tipo_cuenta.nombre}
                      </p>
                      <p className="text-sm text-emerald-700 mt-1">
                        Saldo: ${Number(cuentaEncontrada.saldo_usd).toFixed(2)} USD / 
                        {Number(cuentaEncontrada.saldo_bs).toFixed(2)} Bs
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Filtros */}
              {cuentaMovimientos && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Desde
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Hasta
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <TrendingUp className="w-4 h-4 inline mr-1" />
                      Tipo de Movimiento
                    </label>
                    <div className="relative">
                      <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                      <select
                        value={tipoMovimiento}
                        onChange={(e) => setTipoMovimiento(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white cursor-pointer hover:border-blue-400 transition-colors"
                      >
                        <option value="todos">Todos los movimientos</option>
                        <option value="deposito">💰 Depósitos</option>
                        <option value="retiro">💸 Retiros</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Botón aplicar filtros */}
              {cuentaMovimientos && (
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={async () => {
                      setLoadingMovimientos(true);
                      try {
                        const respMovs = await ahorroService.consultarMovimientos({
                          cuenta_id: cuentaMovimientos,
                          fecha_desde: fechaDesde || undefined,
                          fecha_hasta: fechaHasta || undefined,
                          tipo_movimiento: tipoMovimiento === 'todos' ? undefined : (tipoMovimiento as 'deposito' | 'retiro'),
                          page: 1,
                          limit: 20,
                        });
                        
                        if (respMovs.success) {
                          setMovimientos(respMovs.data);
                          setTotalPaginasMovimientos(respMovs.meta.totalPages);
                          setTotalMovimientos(respMovs.meta.total);
                          setPaginaMovimientos(1);
                        }
                      } catch (error) {
                        console.error('Error al cargar movimientos:', error);
                        alert('Error al cargar movimientos');
                      } finally {
                        setLoadingMovimientos(false);
                      }
                    }}
                    disabled={loadingMovimientos}
                    className="flex items-center gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    Aplicar Filtros
                  </Button>
                </div>
              )}
            </div>

            {/* Tabla de movimientos */}
            {loadingMovimientos ? (
              <div className="flex flex-col justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                <p className="text-sm text-gray-600">Buscando movimientos...</p>
              </div>
            ) : busquedaRealizada && cuentasEncontradas.length === 0 && !loadingMovimientos ? (
              <div className="flex flex-col items-center justify-center py-12 bg-red-50 rounded-lg border-2 border-red-200">
                <div className="bg-red-100 p-3 rounded-full mb-4">
                  <Search className="w-8 h-8 text-red-600" />
                </div>
                <p className="text-red-900 font-semibold text-lg mb-2">No se encontró la cuenta</p>
                <p className="text-red-700 text-sm mb-4">No existe una cuenta con el número o cédula: <strong>{busquedaMovimientos}</strong></p>
                <Button
                  onClick={() => {
                    setBusquedaMovimientos('');
                    setCuentaEncontrada(null);
                    setMovimientos([]);
                  }}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Limpiar búsqueda
                </Button>
              </div>
            ) : !busquedaMovimientos ? (
              <div className="flex flex-col items-center justify-center py-12 bg-blue-50 rounded-lg border-2 border-blue-200">
                <div className="bg-blue-100 p-3 rounded-full mb-4">
                  <Search className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-blue-900 font-semibold text-lg mb-2">Busca una cuenta para comenzar</p>
                <p className="text-blue-700 text-sm">Ingresa un número de cuenta o cédula en el campo superior</p>
              </div>
            ) : movimientos.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monto USD
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monto Bs
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tasa
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Saldo Nuevo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Concepto
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {movimientos.map((mov) => (
                        <tr key={mov.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {new Date(mov.fecha_movimiento).toLocaleDateString('es-VE', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                mov.tipo_movimiento === 'deposito'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {mov.tipo_movimiento === 'deposito' ? 'Depósito' : 'Retiro'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            ${Number(mov.monto_usd).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {Number(mov.monto_bs).toFixed(2)} Bs
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {Number(mov.tasa_cambio).toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            ${Number(mov.saldo_nuevo_usd).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {mov.concepto || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-gray-700">
                    Mostrando {movimientos.length} de {totalMovimientos} movimientos
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setPaginaMovimientos(Math.max(1, paginaMovimientos - 1))}
                      disabled={paginaMovimientos === 1 || loadingMovimientos}
                      variant="secondary"
                      size="sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-700">
                      Página {paginaMovimientos} de {totalPaginasMovimientos}
                    </span>
                    <Button
                      onClick={() => setPaginaMovimientos(Math.min(totalPaginasMovimientos, paginaMovimientos + 1))}
                      disabled={paginaMovimientos === totalPaginasMovimientos || loadingMovimientos}
                      variant="secondary"
                      size="sm"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : cuentaMovimientos ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mb-3 text-gray-400" />
                <p className="text-lg font-medium">No hay movimientos</p>
                <p className="text-sm mt-1">
                  {fechaDesde || fechaHasta
                    ? 'No se encontraron movimientos con los filtros aplicados'
                    : 'Esta cuenta aún no tiene movimientos registrados'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Search className="w-12 h-12 mb-3 text-gray-400" />
                <p className="text-lg font-medium">Busca una cuenta</p>
                <p className="text-sm mt-1">
                  Ingresa un número de cuenta o cédula para consultar los movimientos
                </p>
              </div>
            )}
          </Card>
        </div>,
        document.body
      )}

      {/* Modal Reporte de Movimientos */}
      {modalAbierto === 'reporte_movimientos' && <ModalReporteMovimientos />}
    </div>
  );
};

// ============================================
// COMPONENTE: MODAL APERTURA DE CUENTA
// ============================================

interface ModalAperturaCuentaProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ModalAperturaCuenta = ({ onClose, onSuccess }: ModalAperturaCuentaProps) => {
  // Estados del formulario
  const [cedula, setCedula] = useState('');
  const [sociosEncontrados, setSociosEncontrados] = useState<any[]>([]);
  const [socioSeleccionado, setSocioSeleccionado] = useState<any>(null);
  const [tiposCuenta, setTiposCuenta] = useState<TipoCuentaAhorro[]>([]);
  const [tipoCuentaId, setTipoCuentaId] = useState<string>('');
  const [montoInicial, setMontoInicial] = useState<string>('');
  
  // Estados de UI
  const [buscandoSocio, setBuscandoSocio] = useState(false);
  const [cargandoTipos, setCargandoTipos] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  // Cargar tipos de cuenta al montar
  useEffect(() => {
    const cargarTipos = async () => {
      try {
        const response = await ahorroService.obtenerTiposCuenta();
        if (response.success) {
          // Mostrar todos los tipos activos del sistema
          setTiposCuenta(response.data);
        }
      } catch (err) {
        console.error('Error al cargar tipos:', err);
        setError('Error al cargar tipos de cuenta');
      } finally {
        setCargandoTipos(false);
      }
    };
    void cargarTipos();
  }, []);

  // Buscar socio por cédula
  const buscarSocio = async () => {
    if (!cedula.trim()) {
      setError('Ingrese una cédula');
      return;
    }

    setBuscandoSocio(true);
    setError(null);
    setSociosEncontrados([]);
    setSocioSeleccionado(null);

    try {
      const response = await sociosService.buscarSocioPorCedula(cedula);
      if (response.success && response.data && response.data.length > 0) {
        const socios = response.data;
        
        // Filtrar socios retirados y mostrar advertencia si todos están retirados
        const sociosActivos = socios.filter((s: any) => s.estado !== 'retirado');
        
        if (sociosActivos.length === 0) {
          setError('Todos los expedientes con esta cédula están retirados');
          setSociosEncontrados(socios); // Mostrar de todos modos para información
          return;
        }
        
        setSociosEncontrados(socios);
        
        // Si solo hay UN socio activo, seleccionarlo automáticamente
        if (sociosActivos.length === 1) {
          setSocioSeleccionado(sociosActivos[0]);
        }
      } else {
        setError('Socio no encontrado');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al buscar socio');
    } finally {
      setBuscandoSocio(false);
    }
  };

  // Submit del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!socioSeleccionado) {
      setError('Primero busque y seleccione un socio');
      return;
    }

    if (!tipoCuentaId) {
      setError('Seleccione un tipo de cuenta');
      return;
    }

    const monto = parseFloat(montoInicial) || 0;
    if (monto < 0) {
      setError('El monto no puede ser negativo');
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const response = await ahorroService.aperturarCuenta({
        socio_id: socioSeleccionado.id,
        tipo_cuenta_id: parseInt(tipoCuentaId),
        monto_inicial_usd: monto > 0 ? monto : undefined,
      });

      if (response.success) {
        setExito(true);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Error al abrir cuenta';
      setError(errorMsg);
    } finally {
      setEnviando(false);
    }
  };

  return createPortal(
    <div className="fixed top-0 left-0 right-0 bottom-0 m-0 bg-black/50 flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <Card className="max-w-2xl w-full p-6 my-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Apertura de Cuenta</h2>
            <p className="text-sm text-gray-500 mt-1">
              Registre una nueva cuenta de ahorro para un socio
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={enviando}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Mensaje de éxito */}
        {exito && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-emerald-700 font-medium">
              ¡Cuenta abierta exitosamente!
            </p>
          </div>
        )}

        {/* Mensaje de error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Paso 1: Buscar Socio */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">1. Buscar Socio</h3>
            
            <div className="flex gap-2">
              <Input
                label="Cédula"
                type="text"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="12345678"
                disabled={enviando || socioSeleccionado !== null}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={buscarSocio}
                disabled={buscandoSocio || enviando || socioSeleccionado !== null}
                variant="secondary"
                className="mt-6"
              >
                {buscandoSocio ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Lista de socios encontrados (múltiples expedientes) */}
            {sociosEncontrados.length > 1 && !socioSeleccionado && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Se encontraron {sociosEncontrados.length} expedientes con esta cédula:
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sociosEncontrados.map((socio: any) => (
                    <div
                      key={socio.id}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        socio.estado === 'retirado'
                          ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                          : 'bg-white border-gray-300 hover:border-indigo-400 hover:shadow-md'
                      }`}
                      onClick={() => {
                        if (socio.estado !== 'retirado') {
                          setSocioSeleccionado(socio);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">
                              {socio.nombre} {socio.apellido}
                            </p>
                            {socio.estado === 'retirado' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                                Retirado
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Expediente: <span className="font-mono font-semibold">{socio.codigo_socio}</span>
                          </p>
                          {socio.ubicacion && (
                            <p className="text-sm text-gray-500 mt-1">
                              Feria: {socio.ubicacion.direccion || socio.ubicacion.nombre}
                            </p>
                          )}
                        </div>
                        {socio.estado !== 'retirado' && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSocioSeleccionado(socio);
                            }}
                          >
                            Seleccionar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Socio seleccionado */}
            {socioSeleccionado && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {socioSeleccionado.nombre} {socioSeleccionado.apellido}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Expediente: {socioSeleccionado.codigo_socio} • Cédula: {socioSeleccionado.cedula}
                    </p>
                    {socioSeleccionado.ubicacion && (
                      <p className="text-sm text-emerald-700 font-medium mt-2 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                        Feria: {socioSeleccionado.ubicacion.direccion || socioSeleccionado.ubicacion.nombre}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      setSocioSeleccionado(null);
                      setSociosEncontrados([]);
                      setCedula('');
                    }}
                    variant="ghost"
                    size="sm"
                    disabled={enviando}
                  >
                    Cambiar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Paso 2: Tipo de Cuenta */}
          {socioSeleccionado && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">2. Tipo de Cuenta</h3>
              
              {cargandoTipos ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cargando tipos de cuenta...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Select personalizado con icono */}
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Briefcase className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      value={tipoCuentaId}
                      onChange={(e) => setTipoCuentaId(e.target.value)}
                      disabled={enviando}
                      className="w-full appearance-none pl-12 pr-10 py-3.5 text-base border-2 border-gray-300 rounded-xl bg-white text-gray-900 font-medium shadow-sm hover:border-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      <option value="" className="text-gray-500">Seleccione un tipo de cuenta...</option>
                      {tiposCuenta.map((tipo) => (
                        <option key={tipo.id} value={tipo.id} className="py-2">
                          [{tipo.codigo}] {tipo.nombre}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  
                  {/* Mostrar descripción del tipo seleccionado */}
                  {tipoCuentaId && (
                    <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-2 border-indigo-200 rounded-xl shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-base text-indigo-900 font-semibold">
                            {tiposCuenta.find(t => t.id === Number(tipoCuentaId))?.nombre}
                          </p>
                          {tiposCuenta.find(t => t.id === Number(tipoCuentaId))?.descripcion && (
                            <p className="text-sm text-indigo-700 mt-1.5 leading-relaxed">
                              {tiposCuenta.find(t => t.id === Number(tipoCuentaId))?.descripcion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Paso 3: Monto Inicial (Opcional) */}
          {socioSeleccionado && tipoCuentaId && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">3. Depósito Inicial (Opcional)</h3>
              
              <Input
                label="Monto en USD"
                type="number"
                step="0.01"
                min="0"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                placeholder="0.00"
                disabled={enviando}
                helperText="Deje en blanco para abrir sin saldo"
              />
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={enviando}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!socioSeleccionado || !tipoCuentaId || enviando || exito}
              className="flex-1"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Abriendo cuenta...
                </>
              ) : (
                'Abrir Cuenta'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>,
    document.body
  );
};
