// ============================================
// COOPERATIVA EL TRIUNFO - FRONTEND PAGE
// Motor de Impresión
// ============================================

import { useState } from 'react';
import { Printer, FileText, CreditCard, Receipt, Eye, Download, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

// ============================================
// TIPOS
// ============================================

interface FormatoImpresion {
  id: string;
  nombre: string;
  descripcion: string;
  ancho_mm: number;
  formato: string;
  orientacion: string;
  nota?: string;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export const ImpresionPage = () => {
  const [formatoSeleccionado, setFormatoSeleccionado] = useState<string>('');
  const [vistaPrevia, setVistaPrevia] = useState<string>('');
  const [imprimiendo, setImprimiendo] = useState(false);

  // Mock data de formatos (TODO: cargar desde API)
  const formatos: FormatoImpresion[] = [
    {
      id: 'ticket_colecta',
      nombre: 'Ticket de Colecta',
      descripcion: 'Comprobante de pago de colecta (ahorro, funeraria, salud)',
      ancho_mm: 80,
      formato: 'texto',
      orientacion: 'vertical'
    },
    {
      id: 'nota_operacion',
      nombre: 'Nota de Operación',
      descripcion: 'Nota para operaciones especiales y movimientos',
      ancho_mm: 80,
      formato: 'texto',
      orientacion: 'vertical'
    },
    {
      id: 'carnet_socio',
      nombre: 'Carnet de Socio',
      descripcion: 'Credencial de identificación del socio',
      ancho_mm: 80,
      formato: 'texto',
      orientacion: 'vertical',
      nota: 'Próximamente incluirá código QR'
    }
  ];

  // ============================================
  // DATOS DE EJEMPLO PARA PREVIEW
  // ============================================

  const obtenerDatosEjemplo = (tipo: string) => {
    switch (tipo) {
      case 'ticket_colecta':
        return {
          numero_ticket: 'TC-2026-001234',
          fecha: new Date().toISOString(),
          socio: {
            cedula: 'V-12345678',
            nombre: 'JUAN PEREZ GONZALEZ',
            codigo: 'SOC-001234'
          },
          conceptos: [
            {
              tipo: 'ahorro',
              descripcion: 'Ahorro Programado',
              monto_usd: 50.00,
              monto_bs: 35511.00
            },
            {
              tipo: 'funeraria',
              descripcion: 'Acuerdo Funeraria',
              monto_usd: 5.00,
              monto_bs: 3551.10
            },
            {
              tipo: 'salud',
              descripcion: 'Acuerdo Salud',
              monto_usd: 3.00,
              monto_bs: 2130.66
            }
          ],
          total_usd: 58.00,
          total_bs: 41192.76,
          tasa_cambio: 710.22,
          cajero: 'Maria Rodriguez',
          ubicacion: 'Oficina Matriz - Valencia'
        };

      case 'nota_operacion':
        return {
          numero_nota: 'NO-2026-005678',
          fecha: new Date().toISOString(),
          tipo_operacion: 'Retiro de Ahorro',
          socio: {
            cedula: 'V-87654321',
            nombre: 'MARIA LOPEZ RODRIGUEZ'
          },
          detalles: 'Retiro parcial de ahorro programado por motivo personal. Autorizado por gerencia.',
          monto: 100.00,
          moneda: 'USD',
          usuario: 'Carlos Martinez'
        };

      case 'carnet_socio':
        return {
          codigo: 'SOC-009876',
          cedula: 'V-11223344',
          nombre: 'PEDRO GONZALEZ SILVA',
          fecha_ingreso: '2024-03-15',
          ubicacion: 'Sucursal 01',
          tipo_socio: 'Activo',
          qr_data: 'COOP-TRIUNFO-SOC-009876'
        };

      default:
        return {};
    }
  };

  // ============================================
  // FUNCIONES
  // ============================================

  const handleGenerarPreview = async (tipo: string) => {
    setImprimiendo(true);
    setFormatoSeleccionado(tipo);

    try {
      // TODO: Llamar a API /api/impresion/preview
      const datosEjemplo = obtenerDatosEjemplo(tipo);
      
      // Simulación de respuesta de API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock de contenido del ticket
      const contenidoMock = generarPreviewMock(tipo, datosEjemplo);
      setVistaPrevia(contenidoMock);
    } catch (error) {
      console.error('Error generando preview:', error);
      setVistaPrevia('Error al generar vista previa');
    } finally {
      setImprimiendo(false);
    }
  };

  const handleImprimir = () => {
    if (!vistaPrevia) return;
    
    // Abrir ventana de impresión con el contenido
    const ventanaImpresion = window.open('', '_blank');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
        <html>
          <head>
            <title>Impresión - Cooperativa el Triunfo</title>
            <style>
              body {
                margin: 0;
                padding: 20mm;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.4;
              }
              pre {
                margin: 0;
                white-space: pre-wrap;
              }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            <pre>${vistaPrevia}</pre>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `);
      ventanaImpresion.document.close();
    }
  };

  const handleDescargar = () => {
    if (!vistaPrevia) return;

    const blob = new Blob([vistaPrevia], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formatoSeleccionado}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Mock generator (simplificado, el real viene del backend)
  const generarPreviewMock = (tipo: string, _data: object): string => {
    const linea = '='.repeat(48);
    switch (tipo) {
      case 'ticket_colecta':
        return `
        COOPERATIVA EL TRIUNFO, R.L.
              RIF: J-00000000-0
         Oficina Matriz - Valencia

${linea}
       COMPROBANTE DE COLECTA
${linea}

Ticket: TC-2026-001234
Fecha:  ${new Date().toLocaleString('es-VE')}

------------------------------------------------
Socio:  SOC-001234
Cedula: V-12345678
Nombre: JUAN PEREZ GONZALEZ

------------------------------------------------
CONCEPTOS:

Ahorro Programado
  USD:                            $50.00
  Bs:                        35,511.00 Bs

Acuerdo Funeraria
  USD:                             $5.00
  Bs:                         3,551.10 Bs

Acuerdo Salud
  USD:                             $3.00
  Bs:                         2,130.66 Bs

------------------------------------------------
TOTAL USD:                         $58.00
TOTAL Bs:                      41,192.76 Bs

Tasa del dia:                  710.2200 Bs/$

${linea}

        Gracias por su preferencia
          www.cooptriunfo.org

Cajero: Maria Rodriguez


`;

      case 'nota_operacion':
        return `
        COOPERATIVA EL TRIUNFO, R.L.
              RIF: J-00000000-0

${linea}
          NOTA DE OPERACIÓN
${linea}

Nota No:    NO-2026-005678
Fecha:      ${new Date().toLocaleString('es-VE')}
Operación:  Retiro de Ahorro

------------------------------------------------
Socio:      MARIA LOPEZ RODRIGUEZ
Cédula:     V-87654321

------------------------------------------------
DETALLES:

Retiro parcial de ahorro programado por
motivo personal. Autorizado por gerencia.

------------------------------------------------
MONTO:                             100.00 USD

${linea}

Usuario: Carlos Martinez


_____________________    _____________________
     Recibido                 Autorizado


`;

      case 'carnet_socio':
        return `
${linea}
        COOPERATIVA EL TRIUNFO, R.L.
              CARNET DE SOCIO
${linea}

Código:        SOC-009876
Cédula:        V-11223344
Nombre:        PEDRO GONZALEZ SILVA
Tipo:          Activo
Ubicación:     Sucursal 01
Fecha Ingreso: 15/03/2024

            [CÓDIGO QR]
        COOP-TRIUNFO-SOC-009876

${linea}
          www.cooptriunfo.org

`;

      default:
        return 'Formato no disponible';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Motor de Impresión
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestión de tickets térmicos y documentos de impresión
          </p>
        </div>
        <Printer className="text-primary-600" size={40} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel Izquierdo: Formatos */}
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Formatos Disponibles
            </h2>

            <div className="space-y-3">
              {formatos.map((formato) => (
                <Card
                  key={formato.id}
                  className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                    formatoSeleccionado === formato.id
                      ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => handleGenerarPreview(formato.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {formato.id === 'ticket_colecta' && (
                        <Receipt className="text-blue-600" size={24} />
                      )}
                      {formato.id === 'nota_operacion' && (
                        <FileText className="text-green-600" size={24} />
                      )}
                      {formato.id === 'carnet_socio' && (
                        <CreditCard className="text-purple-600" size={24} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {formato.nombre}
                        {formatoSeleccionado === formato.id && (
                          <Check className="text-primary-600" size={16} />
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {formato.descripcion}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Ancho: {formato.ancho_mm}mm</span>
                        <span>Formato: {formato.formato}</span>
                      </div>
                      {formato.nota && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                          ℹ️ {formato.nota}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Configuración de impresora */}
          <Card className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Configuración de Impresora
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Impresora Térmica
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <option>Predeterminada del sistema</option>
                  <option>Epson TM-T20II</option>
                  <option>Star TSP143</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-corte"
                  className="rounded"
                  defaultChecked
                />
                <label htmlFor="auto-corte" className="text-sm text-gray-700 dark:text-gray-300">
                  Corte automático de papel
                </label>
              </div>
            </div>
          </Card>
        </div>

        {/* Panel Derecho: Vista Previa */}
        <div>
          <Card className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Vista Previa
              </h2>
              {vistaPrevia && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDescargar}
                    className="flex items-center gap-2"
                  >
                    <Download size={16} />
                    Descargar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImprimir}
                    className="flex items-center gap-2"
                  >
                    <Printer size={16} />
                    Imprimir
                  </Button>
                </div>
              )}
            </div>

            {!vistaPrevia && !imprimiendo && (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <Eye className="mx-auto mb-2" size={48} />
                  <p>Selecciona un formato para ver la vista previa</p>
                </div>
              </div>
            )}

            {imprimiendo && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Generando vista previa...
                  </p>
                </div>
              </div>
            )}

            {vistaPrevia && !imprimiendo && (
              <div className="flex-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-lg overflow-auto p-4">
                <pre className="text-xs font-mono leading-relaxed whitespace-pre">
                  {vistaPrevia}
                </pre>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Info Footer */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-lg">💡</span>
            </div>
          </div>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Información sobre impresión térmica:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
              <li>Los tickets se generan en formato de 80mm optimizado para impresoras térmicas</li>
              <li>El contenido se puede descargar como archivo .txt para respaldo</li>
              <li>La función de impresión usa el diálogo nativo del navegador</li>
              <li>Los códigos QR en carnets de socio estarán disponibles próximamente</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ImpresionPage;
