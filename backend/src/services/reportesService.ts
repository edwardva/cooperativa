/**
 * ============================================
 * SERVICE: MOTOR DE REPORTES
 * ============================================
 * Servicio para generación de reportes en PDF y Excel
 */

import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import * as pdfMake from 'pdfmake';
import type { TDocumentDefinitions, TableCell, Content } from 'pdfmake/interfaces';

const prisma = new PrismaClient();

// pdfkit (usado internamente por pdfmake) soporta de forma nativa las 14
// fuentes estándar de PDF sin necesidad de archivos .ttf embebidos.
pdfMake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});
// Nota: los reportes de este módulo no cargan imágenes remotas ni locales,
// por lo que no se define una política de acceso a URLs/archivos (pdfmake
// solo emite una advertencia informativa por consola al respecto).

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
 * Genera un PDF con tabla de datos usando pdfmake.
 */
export const generarPDFTabla = async (
  opciones: ReporteOpciones,
  columnas: string[],
  datos: any[][]
): Promise<Buffer> => {
  const filaEncabezado: TableCell[] = columnas.map((columna) => ({
    text: columna,
    bold: true,
    color: 'white',
    fillColor: '#1a56db',
    margin: [2, 3, 2, 3],
  }));

  const filasDatos: TableCell[][] = datos.map((fila, filaIdx) =>
    fila.map((celda): TableCell => ({
      text: celda === null || celda === undefined ? '' : String(celda),
      fillColor: filaIdx % 2 === 0 ? '#f3f4f6' : undefined,
      margin: [2, 2, 2, 2],
    }))
  );

  const docDefinition: TDocumentDefinitions = {
    pageOrientation: columnas.length > 6 ? 'landscape' : 'portrait',
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    content: [
      { text: 'COOPERATIVA EL TRIUNFO, R.L.', fontSize: 15, bold: true, color: '#1a56db', alignment: 'center' },
      { text: opciones.titulo, fontSize: 12, bold: true, alignment: 'center', margin: [0, 2, 0, 4] },
      ...(opciones.subtitulo
        ? [{ text: opciones.subtitulo, fontSize: 10, italics: true, color: '#666666', alignment: 'center', margin: [0, 0, 0, 4] }]
        : []),
      {
        text: `Fecha de generación: ${(opciones.fecha || new Date()).toLocaleDateString('es-VE')}`,
        fontSize: 8,
        color: '#999999',
        alignment: 'right',
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          headerRows: 1,
          widths: columnas.map(() => '*'),
          body: [filaEncabezado, ...filasDatos],
        },
        layout: {
          hLineColor: () => '#cccccc',
          vLineColor: () => '#cccccc',
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
      },
    ] as Content[],
  };

  return pdfMake.createPdf(docDefinition).getBuffer();
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
 * Reporte de Acuerdos de Funeraria Suspendidos
 * (consulta real a la base de datos, no mock)
 */
export const generarReporteFunerariaSuspendidos = async (formato: 'pdf' | 'excel') => {
  const acuerdos = await prisma.acuerdoFuneraria.findMany({
    where: { estado: 'suspendido' },
    include: {
      beneficiario: {
        include: { socio: true },
      },
    },
    orderBy: { semanas_sin_pago: 'desc' },
  });

  const columnas = [
    'Expediente',
    'N° Acuerdo',
    'N° Contrato',
    'Apellidos y Nombres',
    'Cédula',
    'Teléfono',
    'Semanas de Atraso',
    'Estado',
  ];

  const datos = acuerdos.map((acuerdo) => [
    acuerdo.beneficiario.socio?.codigo_socio || 'N/D',
    acuerdo.numero_acuerdo || 'N/D',
    acuerdo.numero_contrato || 'N/D',
    `${acuerdo.beneficiario.apellido} ${acuerdo.beneficiario.nombre}`,
    acuerdo.beneficiario.cedula,
    acuerdo.beneficiario.socio?.telefono || acuerdo.beneficiario.telefono || 'N/D',
    acuerdo.semanas_sin_pago,
    acuerdo.estado.toUpperCase(),
  ]);

  const opciones: ReporteOpciones = {
    titulo: 'Reporte de Acuerdos de Funeraria Suspendidos',
    subtitulo: `Total suspendidos: ${acuerdos.length}`,
    fecha: new Date(),
  };

  if (formato === 'pdf') {
    return await generarPDFTabla(opciones, columnas, datos);
  } else {
    return await generarExcelTabla(opciones, columnas, datos);
  }
};

/**
 * Reporte de TODOS los Acuerdos de Salud (no solo suspendidos), fila por
 * persona cubierta por cada acuerdo.
 */
export const generarReporteSaludAcuerdos = async (formato: 'pdf' | 'excel') => {
  const acuerdos = await prisma.acuerdoSalud.findMany({
    include: {
      beneficiario: { include: { socio: true } },
      tipo_acuerdo: true,
    },
    orderBy: [{ estado: 'asc' }, { fecha_inicio: 'desc' }],
  });

  const columnas = [
    'Expediente',
    'N° Acuerdo',
    'N° Contrato',
    'Apellidos y Nombres',
    'Cédula',
    'Parentesco',
    'Tipo de Acuerdo',
    'Semanas de Atraso',
    'Estado',
  ];

  const datos = acuerdos.map((acuerdo) => [
    acuerdo.beneficiario.socio?.codigo_socio || 'N/D',
    acuerdo.numero_acuerdo || 'N/D',
    acuerdo.numero_contrato || 'N/D',
    `${acuerdo.beneficiario.apellido} ${acuerdo.beneficiario.nombre}`,
    acuerdo.beneficiario.cedula,
    acuerdo.beneficiario.parentesco,
    acuerdo.tipo_acuerdo.nombre,
    acuerdo.semanas_sin_pago,
    acuerdo.estado.toUpperCase(),
  ]);

  const opciones: ReporteOpciones = {
    titulo: 'Reporte de Acuerdos de Salud',
    subtitulo: `Total de registros: ${acuerdos.length}`,
    fecha: new Date(),
  };

  if (formato === 'pdf') {
    return await generarPDFTabla(opciones, columnas, datos);
  } else {
    return await generarExcelTabla(opciones, columnas, datos);
  }
};

/**
 * Reporte de Acuerdos de Salud Suspendidos
 * (consulta real a la base de datos, fila por persona del grupo suspendido)
 */
export const generarReporteSaludSuspendidos = async (formato: 'pdf' | 'excel') => {
  const acuerdos = await prisma.acuerdoSalud.findMany({
    where: { estado: 'suspendido' },
    include: {
      beneficiario: {
        include: { socio: true },
      },
    },
    orderBy: { semanas_sin_pago: 'desc' },
  });

  const columnas = [
    'Expediente',
    'N° Acuerdo',
    'N° Contrato',
    'Apellidos y Nombres',
    'Cédula',
    'Teléfono',
    'Semanas de Atraso',
    'Estado',
  ];

  const datos = acuerdos.map((acuerdo) => [
    acuerdo.beneficiario.socio?.codigo_socio || 'N/D',
    acuerdo.numero_acuerdo || 'N/D',
    acuerdo.numero_contrato || 'N/D',
    `${acuerdo.beneficiario.apellido} ${acuerdo.beneficiario.nombre}`,
    acuerdo.beneficiario.cedula,
    acuerdo.beneficiario.socio?.telefono || acuerdo.beneficiario.telefono || 'N/D',
    acuerdo.semanas_sin_pago,
    acuerdo.estado.toUpperCase(),
  ]);

  const opciones: ReporteOpciones = {
    titulo: 'Reporte de Acuerdos de Salud Suspendidos',
    subtitulo: `Total suspendidos: ${acuerdos.length}`,
    fecha: new Date(),
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
