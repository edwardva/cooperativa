import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FileDown, FileSpreadsheet, Users, DollarSign } from 'lucide-react';

// TODO: Mover a types/index.ts cuando integremos con API
interface TipoReporte {
  id: string;
  nombre: string;
  descripcion: string;
  icono: React.ReactNode;
  formatos: string[];
}

export const ReportesPage = () => {
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>('');
  const [formato, setFormato] = useState<'pdf' | 'excel'>('excel');
  const [generando, setGenerando] = useState(false);

  // TODO: Obtener de API (GET /api/reportes/tipos)
  const tiposReporte: TipoReporte[] = [
    {
      id: 'socios',
      nombre: 'Reporte de Socios',
      descripcion: 'Listado completo de socios con filtros por ubicación y estado',
      icono: <Users className="w-6 h-6 text-blue-600" />,
      formatos: ['pdf', 'excel'],
    },
    {
      id: 'prestamos',
      nombre: 'Reporte de Préstamos',
      descripcion: 'Listado de préstamos con estado, tipo y rangos de fecha',
      icono: <DollarSign className="w-6 h-6 text-green-600" />,
      formatos: ['pdf', 'excel'],
    },
  ];

  const handleGenerar = async () => {
    if (!tipoSeleccionado) {
      alert('Por favor seleccione un tipo de reporte');
      return;
    }

    setGenerando(true);

    try {
      // TODO: Implementar llamada a API
      const endpoint = `/api/reportes/${tipoSeleccionado}`;
      console.log(`Generando reporte: ${endpoint}`, { formato });

      // Simulación de generación
      await new Promise((resolve) => setTimeout(resolve, 2000));

      alert(`Reporte generado exitosamente en formato ${formato.toUpperCase()}`);
    } catch (error) {
      console.error('Error generando reporte:', error);
      alert('Error al generar el reporte');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Generador de Reportes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Genere reportes en PDF o Excel con filtros personalizados
        </p>
      </div>

      {/* Selección de Tipo de Reporte */}
      <Card className="p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Tipo de Reporte</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tiposReporte.map((tipo) => (
            <button
              key={tipo.id}
              onClick={() => setTipoSeleccionado(tipo.id)}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                tipoSeleccionado === tipo.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">{tipo.icono}</div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{tipo.nombre}</h3>
                  <p className="text-sm text-gray-600 mt-1">{tipo.descripcion}</p>
                  <div className="flex gap-2 mt-2">
                    {tipo.formatos.map((fmt) => (
                      <span
                        key={fmt}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {fmt.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Configuración del Reporte */}
      {tipoSeleccionado && (
        <Card className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Configuración</h2>
          
          {/* Formato */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Formato de Salida
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setFormato('pdf')}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    formato === 'pdf'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={generando}
                >
                  <FileDown className="w-5 h-5" />
                  <span className="font-medium">PDF</span>
                  <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                    Beta
                  </span>
                </button>
                <button
                  onClick={() => setFormato('excel')}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    formato === 'excel'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={generando}
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  <span className="font-medium">Excel</span>
                </button>
              </div>
            </div>

            {/* Filtros por tipo de reporte */}
            {tipoSeleccionado === 'socios' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ubicación
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todas</option>
                    <option value="MATRIZ">MATRIZ</option>
                    <option value="SUC01">SUC01</option>
                    <option value="SUC02">SUC02</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="todos">Todos</option>
                    <option value="activo">Activos</option>
                    <option value="inactivo">Inactivos</option>
                  </select>
                </div>
              </div>
            )}

            {tipoSeleccionado === 'prestamos' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Préstamo
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos</option>
                    <option value="PERSONAL">Personal</option>
                    <option value="EMERGENCIA">Emergencia</option>
                    <option value="VEHICULO">Vehículo</option>
                    <option value="VIVIENDA">Vivienda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="todos">Todos</option>
                    <option value="activo">Activos</option>
                    <option value="saldado">Saldados</option>
                    <option value="mora">En Mora</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Desde
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Hasta
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Botón de Generar */}
      {tipoSeleccionado && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Se generará un archivo{' '}
                <span className="font-medium text-gray-900">
                  {formato === 'pdf' ? 'PDF' : 'Excel'}
                </span>{' '}
                con el reporte seleccionado
              </p>
              {formato === 'pdf' && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ La generación de PDF está en desarrollo. Se generará Excel temporalmente.
                </p>
              )}
            </div>
            <Button
              onClick={handleGenerar}
              disabled={generando}
              className="flex items-center gap-2"
            >
              {generando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Generar Reporte
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Nota informativa */}
      {!tipoSeleccionado && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <FileDown className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-900">
                Seleccione un tipo de reporte para comenzar
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Los reportes se pueden generar en formato PDF o Excel con filtros personalizados.
                Seleccione un tipo de reporte arriba para configurar los parámetros.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
