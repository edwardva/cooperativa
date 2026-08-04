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

import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  PlusCircle,
  Search,
  Wallet,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import * as ahorroService from '../services/ahorroService';
import type { CuentaAhorro, Estadisticas } from '../services/ahorroService';

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
  const [modalAbierto, setModalAbierto] = useState<'apertura' | 'movimiento' | 'detalle' | null>(null);

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

  // Cargar estadísticas (una sola vez)
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

  const saldoDisponibleUsd = estadisticas.total_saldo_usd - estadisticas.total_bloqueado_usd;
  const saldoDisponibleBs = estadisticas.total_saldo_bs - estadisticas.total_bloqueado_bs;

  return (
    <div className="p-6 space-y-6">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ahorro</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestión de cuentas de ahorro y movimientos
          </p>
        </div>
        <div className="flex gap-3">
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

        <Card className="p-5">
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
        </Card>
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
            <option value="AHO">Cuenta a la Vista</option>
            <option value="INF">Cuenta Infantil</option>
            <option value="NAV">Cuenta Navideña</option>
            <option value="PLA">Plazo Fijo</option>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cuenta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Socio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo USD
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo Bs
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bloqueado USD
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Movimientos
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
              ) : cuentas.map((cuenta) => {
                const disponibleUsd = cuenta.saldo_usd - cuenta.monto_bloqueado_usd;
                
                return (
                  <tr
                    key={cuenta.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setCuentaSeleccionada(cuenta);
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
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && cuentas.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setPaginaActual(paginaActual - 1)}
                disabled={paginaActual === 1}
                variant="secondary"
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              
              <div className="flex gap-1">
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
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================ */}
      {/* MODALES (TODO) */}
      {/* ============================================ */}
      {modalAbierto === 'apertura' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-2xl w-full mx-4 p-6">
            <h2 className="text-2xl font-bold mb-4">Apertura de Cuenta</h2>
            <p className="text-gray-600 mb-4">
              Formulario de apertura de cuenta (próximamente)
            </p>
            <Button onClick={() => setModalAbierto(null)}>Cerrar</Button>
          </Card>
        </div>
      )}

      {modalAbierto === 'movimiento' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-2xl w-full mx-4 p-6">
            <h2 className="text-2xl font-bold mb-4">Registrar Movimiento</h2>
            <p className="text-gray-600 mb-4">
              Formulario de depósito/retiro (próximamente)
            </p>
            <Button onClick={() => setModalAbierto(null)}>Cerrar</Button>
          </Card>
        </div>
      )}

      {modalAbierto === 'detalle' && cuentaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  Cuenta {cuentaSeleccionada.numero_cuenta}
                </h2>
                <p className="text-gray-600">
                  {cuentaSeleccionada.socio.nombre} {cuentaSeleccionada.socio.apellido}
                </p>
              </div>
              <Button onClick={() => setModalAbierto(null)} variant="secondary">
                Cerrar
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Saldo USD</p>
                <p className="text-2xl font-bold text-emerald-600">
                  ${cuentaSeleccionada.saldo_usd.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Saldo Bs</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {cuentaSeleccionada.saldo_bs.toFixed(2)} Bs
                </p>
              </div>
            </div>

            <p className="text-gray-600">
              Historial de movimientos (próximamente)
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};
