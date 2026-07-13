/**
 * ============================================
 * SERVICE: MOTOR DE REPORTES
 * ============================================
 * Servicio para generación de reportes en PDF y Excel
 * 
 * NOTA: Implementación actual usa ExcelJS para reportes.
 * PDF con pdfmake requiere configuración adicional en entorno Node.js.
 * Se recomienda usar puppeteer para PDF en futuras iteraciones.
 */

import ExcelJS from 'exceljs';

/**
 * Opciones para generación de reportes
 */
interface ReporteOpciones {
  titulo: string;
  subtitulo?: string;
  fecha?: Date;
  filtros?: Record<string, any>;
}

/**
 * ============================================
 * GENERACIÓN DE PDFs
 * ============================================
 */

/**
 * Genera un PDF con tabla de datos
 * TODO: Implementar con puppeteer o librería alternativa estable
 */
export const generarPDFTabla = async (
  opciones: ReporteOpciones,
  columnas: string[],
  datos: any[][]
): Promise<Buffer> => {
  // Temporalmente, generar Excel en lugar de PDF
  // TODO: Implementar generación real de PDF
  console.warn('Generación PDF pendiente de implementación. Generando Excel como alternativa temporal.');
  return await generarExcelTabla(opciones, columnas, datos);
};

/**
 * ============================================
 * GENERACIÓN DE EXCEL
 * ============================================
 */

/**
 * Genera un archivo Excel con tabla de datos
 */
export const generarExcelTabla = async (
  opciones: ReporteOpciones,
  columnas: string[],
  datos: any[][]
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  
  workbook.creator = 'Cooperativa el Triunfo, R.L.';
  workbook.created = new Date();
  
  const sheet = workbook.addWorksheet(opciones.titulo.substring(0, 31)); // Límite de 31 caracteres

  // Encabezado del reporte
  sheet.mergeCells('A1', String.fromCharCode(64 + columnas.length) + '1');
  const tituloCell = sheet.getCell('A1');
  tituloCell.value = 'COOPERATIVA EL TRIUNFO, R.L.';
  tituloCell.font = { size: 16, bold: true, color: { argb: 'FF1a56db' } };
  tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('A2', String.fromCharCode(64 + columnas.length) + '2');
  const subtituloCell = sheet.getCell('A2');
  subtituloCell.value = opciones.titulo;
  subtituloCell.font = { size: 14, bold: true };
  subtituloCell.alignment = { horizontal: 'center', vertical: 'middle' };

  if (opciones.subtitulo) {
    sheet.mergeCells('A3', String.fromCharCode(64 + columnas.length) + '3');
    const subCell = sheet.getCell('A3');
    subCell.value = opciones.subtitulo;
    subCell.font = { size: 12, italic: true, color: { argb: 'FF666666' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  const fechaRow = opciones.subtitulo ? 4 : 3;
  sheet.mergeCells(`A${fechaRow}`, String.fromCharCode(64 + columnas.length) + fechaRow);
  const fechaCell = sheet.getCell(`A${fechaRow}`);
  fechaCell.value = `Fecha de generación: ${(opciones.fecha || new Date()).toLocaleDateString('es-VE')}`;
  fechaCell.font = { size: 10, color: { argb: 'FF999999' } };
  fechaCell.alignment = { horizontal: 'right', vertical: 'middle' };

  // Fila en blanco
  const dataStartRow = fechaRow + 2;

  // Encabezados de columnas
  const headerRow = sheet.getRow(dataStartRow);
  columnas.forEach((columna, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = columna;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1a56db' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Datos
  datos.forEach((fila, filaIdx) => {
    const row = sheet.getRow(dataStartRow + 1 + filaIdx);
    fila.forEach((celda, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = celda;
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      
      // Zebra striping
      if (filaIdx % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' },
        };
      }
    });
  });

  // Ajustar anchos de columna
  sheet.columns.forEach((column) => {
    if (column) {
      column.width = 20;
    }
  });

  // Generar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

/**
 * ============================================
 * REPORTES ESPECÍFICOS
 * ============================================
 */

/**
 * Reporte de Socios
 */
export const generarReporteSocios = async (
  formato: 'pdf' | 'excel',
  filtros?: Record<string, any>
) => {
  // TODO: Obtener datos reales de la base de datos
  const columnas = ['Cédula', 'Nombre', 'Ubicación', 'Estado', 'Fecha Ingreso'];
  const datos = [
    ['V-12345678', 'Juan Pérez', 'MATRIZ', 'Activo', '15/01/2024'],
    ['V-87654321', 'María González', 'SUC01', 'Activo', '20/02/2024'],
  ];

  const opciones: ReporteOpciones = {
    titulo: 'Reporte de Socios',
    subtitulo: filtros?.ubicacion ? `Ubicación: ${filtros.ubicacion}` : undefined,
    fecha: new Date(),
    filtros,
  };

  if (formato === 'pdf') {
    return await generarPDFTabla(opciones, columnas, datos);
  } else {
    return await generarExcelTabla(opciones, columnas, datos);
  }
};

/**
 * Reporte de Préstamos
 */
export const generarReportePrestamos = async (
  formato: 'pdf' | 'excel',
  filtros?: Record<string, any>
) => {
  const columnas = ['Préstamo #', 'Socio', 'Tipo', 'Monto', 'Estado'];
  const datos = [
    ['P-0001', 'Juan Pérez', 'Personal', '$1,500.00', 'Activo'],
    ['P-0002', 'María González', 'Emergencia', '$800.00', 'Activo'],
  ];

  const opciones: ReporteOpciones = {
    titulo: 'Reporte de Préstamos',
    subtitulo: filtros?.tipo ? `Tipo: ${filtros.tipo}` : undefined,
    fecha: new Date(),
    filtros,
  };

  if (formato === 'pdf') {
    return await generarPDFTabla(opciones, columnas, datos);
  } else {
    return await generarExcelTabla(opciones, columnas, datos);
  }
};
