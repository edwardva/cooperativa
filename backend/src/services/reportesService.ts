/**
 * ============================================
 * SERVICE: MOTOR DE REPORTES
 * ============================================
 * Servicio para generación de reportes en PDF y Excel
 */

import ExcelJS from 'exceljs';
import { PrismaClient, Prisma } from '@prisma/client';
// `import * as pdfMake` compila a __importStar(), que copia solo las propiedades
// propias enumerables y pierde setFonts/createPdf: el proceso entra en
// crash-loop en cuanto se carga este modulo. Con `import = require` se emite un
// require pelado y el objeto llega intacto.
//
// Solo se manifiesta compilado: en local corre con tsx, que resuelve la
// interoperabilidad de otra forma. Ya tumbo produccion una vez (2026-09-04) y
// volvio a colarse en un merge, asi que NO cambiar a `import * as`.
import pdfMake = require('pdfmake');
import type { TDocumentDefinitions, TableCell, Content } from 'pdfmake/interfaces';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Independiente de src/dist: queda fuera de ambos, así que la misma ruta
// relativa sirve tanto en desarrollo (tsx corriendo src/) como en producción
// (node corriendo dist/).
const LOGO_PATH = path.join(__dirname, '../../assets/logoR.png');

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

// REGLA DE NEGOCIO: debe mantenerse igual a SEMANAS_LIMITE_SUSPENSION /
// SEMANAS_ALERTA_PROXIMO_SUSPENDER en saludController.ts (misma regla,
// capas distintas: el controller la usa para las estadísticas y el listado
// en pantalla, este service para el Excel).
const SEMANAS_LIMITE_SUSPENSION_SALUD = 11;
const SEMANAS_ALERTA_PROXIMO_SUSPENDER_SALUD = 10;

type TipoListadoSalud = 'activos' | 'suspendidos' | 'proximos_suspender';

const TITULOS_LISTADO_SALUD: Record<TipoListadoSalud, string> = {
  activos: 'Listado de Socios Activos - Salud',
  suspendidos: 'Listado de Socios Suspendidos - Salud',
  proximos_suspender: 'Listado de Socios Próximos a Suspender - Salud',
};

const includeGrupoSalud = {
  beneficiario: { include: { socio: true } },
} satisfies Prisma.AcuerdoSaludInclude;

type FilaAcuerdoSalud = Prisma.AcuerdoSaludGetPayload<{ include: typeof includeGrupoSalud }>;

function whereTitularSalud(tipo: TipoListadoSalud): Prisma.AcuerdoSaludWhereInput {
  const soloTitular = { parentesco: { equals: 'titular', mode: 'insensitive' as const } };
  switch (tipo) {
    case 'activos':
      return { estado: 'activo', beneficiario: soloTitular };
    case 'suspendidos':
      return { estado: 'suspendido', beneficiario: soloTitular };
    case 'proximos_suspender':
      return {
        estado: 'activo',
        semanas_sin_pago: { gte: SEMANAS_ALERTA_PROXIMO_SUSPENDER_SALUD, lt: SEMANAS_LIMITE_SUSPENSION_SALUD },
        beneficiario: soloTitular,
      };
  }
}

/**
 * Reporte Excel de acuerdos de salud agrupados (titular + beneficiarios a su
 * cargo), filtrado por tipo de listado. Encabezado con logo y datos de la
 * cooperativa para mantener el mismo lenguaje visual que la ficha de acuerdo
 * que se imprime desde el frontend; cada grupo se distingue con la fila del
 * titular resaltada y sus beneficiarios en cursiva justo debajo, separado
 * del siguiente grupo por una fila en blanco.
 */
export const generarReporteSaludGrupos = async (tipo: TipoListadoSalud): Promise<Buffer> => {
  const titulares = await prisma.acuerdoSalud.findMany({
    where: whereTitularSalud(tipo),
    select: { numero_acuerdo: true },
    orderBy: { beneficiario: { socio: { apellido: 'asc' } } },
  });

  const numeros = titulares.map((t) => t.numero_acuerdo).filter((n): n is string => !!n);

  const rows = numeros.length
    ? ((await prisma.acuerdoSalud.findMany({
        where: { numero_acuerdo: { in: numeros } },
        include: includeGrupoSalud,
        orderBy: { created_at: 'asc' },
      })) as FilaAcuerdoSalud[])
    : [];

  const porNumero = new Map<string, FilaAcuerdoSalud[]>();
  for (const row of rows) {
    if (!row.numero_acuerdo) continue;
    const grupo = porNumero.get(row.numero_acuerdo) ?? [];
    grupo.push(row);
    porNumero.set(row.numero_acuerdo, grupo);
  }

  const grupos = numeros
    .map((numero) => porNumero.get(numero))
    .filter((g): g is FilaAcuerdoSalud[] => !!g && g.length > 0);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cooperativa el Triunfo, R.L.';
  workbook.created = new Date();

  const columnas = ['Tipo', 'Expediente', 'N° Acuerdo', 'Apellidos y Nombres', 'Cédula', 'Parentesco', 'Semanas sin pago', 'Estado'];
  const sheet = workbook.addWorksheet(TITULOS_LISTADO_SALUD[tipo].substring(0, 31));
  // La columna A es más ancha que el resto: es donde va el logo, que es
  // horizontal (no cuadrado), y necesita más espacio que una columna de datos.
  sheet.columns = columnas.map((_, idx) => ({ width: idx === 0 ? 27 : 22 }));

  const ultimaColumna = String.fromCharCode(64 + columnas.length);

  sheet.mergeCells('B1', `${ultimaColumna}1`);
  const tituloCell = sheet.getCell('B1');
  tituloCell.value = 'Cooperativa el Triunfo, R.L.';
  tituloCell.font = { size: 16, bold: true, color: { argb: 'FF1a56db' } };
  tituloCell.alignment = { vertical: 'middle' };

  sheet.mergeCells('B2', `${ultimaColumna}2`);
  const subtituloCell = sheet.getCell('B2');
  subtituloCell.value = TITULOS_LISTADO_SALUD[tipo];
  subtituloCell.font = { size: 13, bold: true };
  subtituloCell.alignment = { vertical: 'middle' };

  sheet.mergeCells('B3', `${ultimaColumna}3`);
  const infoCell = sheet.getCell('B3');
  infoCell.value = `Total de grupos: ${grupos.length}   |   Generado: ${new Date().toLocaleString('es-VE')}`;
  infoCell.font = { size: 10, color: { argb: 'FF666666' } };
  infoCell.alignment = { vertical: 'middle' };

  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 22;

  if (fs.existsSync(LOGO_PATH)) {
    // El logo real es horizontal (~1193x366px, relación ancho:alto ≈ 3.26:1),
    // no cuadrado: forzarlo a 74x74 lo aplastaba y se veía chico. Se
    // mantiene su proporción real y se agranda a un ancho que se note en el
    // encabezado, sin que se salga de la columna A (ensanchada arriba).
    const RELACION_ASPECTO_LOGO = 1193 / 366;
    const anchoLogo = 180;
    const altoLogo = Math.round(anchoLogo / RELACION_ASPECTO_LOGO);
    const imageId = workbook.addImage({ filename: LOGO_PATH, extension: 'png' });
    sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: anchoLogo, height: altoLogo } });
  }

  const dataStartRow = 5;
  const headerRow = sheet.getRow(dataStartRow);
  columnas.forEach((columna, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = columna;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a56db' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  let filaActual = dataStartRow + 1;
  const bordeDelgado = { style: 'thin' as const };

  grupos.forEach((grupoRows) => {
    const titularRow = grupoRows.find((r) => r.beneficiario.parentesco.trim().toLowerCase() === 'titular') ?? grupoRows[0]!;
    const beneficiarios = grupoRows.filter((r) => r !== titularRow);
    const expediente = titularRow.beneficiario.socio?.codigo_socio || 'N/D';

    const filaTitular = sheet.getRow(filaActual++);
    const valoresTitular = [
      'Titular',
      expediente,
      titularRow.numero_acuerdo || 'N/D',
      `${titularRow.beneficiario.apellido} ${titularRow.beneficiario.nombre}`,
      titularRow.beneficiario.cedula,
      titularRow.beneficiario.parentesco,
      titularRow.semanas_sin_pago,
      titularRow.estado.toUpperCase(),
    ];
    valoresTitular.forEach((valor, idx) => {
      const cell = filaTitular.getCell(idx + 1);
      cell.value = valor;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCEAFB' } };
      cell.border = { top: bordeDelgado, left: bordeDelgado, bottom: bordeDelgado, right: bordeDelgado };
    });

    beneficiarios.forEach((b) => {
      const fila = sheet.getRow(filaActual++);
      const valores = [
        'Beneficiario',
        expediente,
        b.numero_acuerdo || 'N/D',
        `${b.beneficiario.apellido} ${b.beneficiario.nombre}`,
        b.beneficiario.cedula,
        b.beneficiario.parentesco,
        '',
        b.beneficiario.estado !== 'activo' ? b.beneficiario.estado.toUpperCase() : '',
      ];
      valores.forEach((valor, idx) => {
        const cell = fila.getCell(idx + 1);
        cell.value = valor;
        cell.font = { italic: true, color: { argb: 'FF4B5563' } };
        cell.border = { top: bordeDelgado, left: bordeDelgado, bottom: bordeDelgado, right: bordeDelgado };
      });
    });

    // Fila en blanco: separa visualmente cada grupo del siguiente.
    filaActual++;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

