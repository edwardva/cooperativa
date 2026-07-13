/**
 * ============================================
 * GENERADOR DE REPORTE CONSOLIDADO
 * ============================================
 * Genera un reporte HTML con el estado completo
 * de la migración de socios y beneficiarios
 * 
 * EJECUCIÓN:
 * cd scripts/migracion
 * npx tsx generate-report.ts
 * ============================================
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ============================================
// RECOPILACIÓN DE DATOS
// ============================================

async function recopilarEstadisticas() {
  console.log('📊 Recopilando estadísticas...\n');
  
  // Socios
  const totalSocios = await prisma.socio.count();
  const sociosPorEstado = await prisma.socio.groupBy({
    by: ['estado'],
    _count: true,
  });
  
  // Beneficiarios
  const totalBeneficiarios = await prisma.beneficiario.count({
    where: { deleted_at: null },
  });
  
  // Socios con beneficiarios
  const sociosConBeneficiarios = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT socio_id) as count
    FROM beneficiarios
    WHERE deleted_at IS NULL
  `;
  
  // Ubicaciones
  const totalUbicaciones = await prisma.ubicacion.count();
  const sociosPorUbicacion = await prisma.socio.groupBy({
    by: ['ubicacion_id'],
    _count: true,
  });
  
  // Socios con más de 5 beneficiarios
  const sociosMuchosBeneficiarios = await prisma.$queryRaw<Array<{ socio_id: number; count: bigint }>>`
    SELECT socio_id, COUNT(*) as count
    FROM beneficiarios
    WHERE deleted_at IS NULL
    GROUP BY socio_id
    HAVING COUNT(*) > 5
  `;
  
  // Socios recientes (últimos 30 días)
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 30);
  
  const sociosRecientes = await prisma.socio.count({
    where: {
      created_at: {
        gte: fechaLimite,
      },
    },
  });
  
  return {
    socios: {
      total: totalSocios,
      porEstado: sociosPorEstado,
      recientes: sociosRecientes,
    },
    beneficiarios: {
      total: totalBeneficiarios,
      sociosConBeneficiarios: Number(sociosConBeneficiarios[0]?.count || 0),
      sociosMuchosBeneficiarios: sociosMuchosBeneficiarios.length,
    },
    ubicaciones: {
      total: totalUbicaciones,
      distribucion: sociosPorUbicacion,
    },
  };
}

// ============================================
// GENERACIÓN DE REPORTE HTML
// ============================================

function generarHTML(stats: any) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Migración - Cooperativa el Triunfo</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      color: #333;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    
    header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    
    header p {
      font-size: 1.1rem;
      opacity: 0.9;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      padding: 40px;
    }
    
    .stat-card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      transition: transform 0.2s;
    }
    
    .stat-card:hover {
      transform: translateY(-5px);
    }
    
    .stat-card h3 {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 15px;
    }
    
    .stat-card .number {
      font-size: 3rem;
      font-weight: bold;
      color: #667eea;
    }
    
    .details {
      padding: 40px;
    }
    
    .details h2 {
      font-size: 1.8rem;
      margin-bottom: 20px;
      color: #667eea;
    }
    
    .details-section {
      margin-bottom: 40px;
    }
    
    .details-section h3 {
      font-size: 1.3rem;
      margin-bottom: 15px;
      color: #555;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    
    th {
      background: #f5f7fa;
      font-weight: 600;
      color: #667eea;
    }
    
    tr:hover {
      background: #f9f9f9;
    }
    
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    
    .badge.success { background: #d4edda; color: #155724; }
    .badge.warning { background: #fff3cd; color: #856404; }
    .badge.info { background: #d1ecf1; color: #0c5460; }
    
    footer {
      background: #f5f7fa;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 Reporte de Migración</h1>
      <p>Cooperativa el Triunfo, R.L</p>
      <p style="margin-top: 10px; opacity: 0.8;">Generado: ${new Date().toLocaleString('es-VE')}</p>
    </header>
    
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Socios</h3>
        <div class="number">${stats.socios.total.toLocaleString()}</div>
      </div>
      
      <div class="stat-card">
        <h3>Total Beneficiarios</h3>
        <div class="number">${stats.beneficiarios.total.toLocaleString()}</div>
      </div>
      
      <div class="stat-card">
        <h3>Socios con Beneficiarios</h3>
        <div class="number">${stats.beneficiarios.sociosConBeneficiarios.toLocaleString()}</div>
      </div>
      
      <div class="stat-card">
        <h3>Ubicaciones/Ferias</h3>
        <div class="number">${stats.ubicaciones.total}</div>
      </div>
    </div>
    
    <div class="details">
      <div class="details-section">
        <h2>📈 Distribución por Estado</h2>
        <table>
          <thead>
            <tr>
              <th>Estado</th>
              <th>Cantidad</th>
              <th>Porcentaje</th>
            </tr>
          </thead>
          <tbody>
            ${stats.socios.porEstado.map((e: any) => `
              <tr>
                <td>
                  <span class="badge ${
                    e.estado === 'activo' ? 'success' : 
                    e.estado === 'suspendido' ? 'warning' : 'info'
                  }">
                    ${e.estado.toUpperCase()}
                  </span>
                </td>
                <td>${e._count.toLocaleString()}</td>
                <td>${((e._count / stats.socios.total) * 100).toFixed(2)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="details-section">
        <h2>📍 Distribución por Ubicación</h2>
        <table>
          <thead>
            <tr>
              <th>Ubicación ID</th>
              <th>Cantidad de Socios</th>
              <th>Porcentaje</th>
            </tr>
          </thead>
          <tbody>
            ${stats.ubicaciones.distribucion.map((u: any) => `
              <tr>
                <td>Ubicación #${u.ubicacion_id}</td>
                <td>${u._count.toLocaleString()}</td>
                <td>${((u._count / stats.socios.total) * 100).toFixed(2)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="details-section">
        <h2>✅ Validaciones</h2>
        <table>
          <thead>
            <tr>
              <th>Validación</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Socios migrados correctamente</td>
              <td><span class="badge success">✓ ${stats.socios.total.toLocaleString()}</span></td>
            </tr>
            <tr>
              <td>Beneficiarios migrados</td>
              <td><span class="badge success">✓ ${stats.beneficiarios.total.toLocaleString()}</span></td>
            </tr>
            <tr>
              <td>Socios con muchos beneficiarios (&gt;5)</td>
              <td><span class="badge ${stats.beneficiarios.sociosMuchosBeneficiarios > 0 ? 'warning' : 'success'}">
                ${stats.beneficiarios.sociosMuchosBeneficiarios}
              </span></td>
            </tr>
            <tr>
              <td>Socios registrados últimos 30 días</td>
              <td><span class="badge info">${stats.socios.recientes.toLocaleString()}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <footer>
      <p><strong>Cooperativa el Triunfo, R.L</strong> | Sistema de Gestión de Socios</p>
      <p style="margin-top: 5px;">© 2026 - Todos los derechos reservados</p>
    </footer>
  </div>
</body>
</html>
  `;
}

// ============================================
// EJECUCIÓN
// ============================================

async function main() {
  try {
    await prisma.$connect();
    
    const stats = await recopilarEstadisticas();
    
    const html = generarHTML(stats);
    
    const reportPath = path.join(__dirname, 'logs', 'migration_report.html');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, html);
    
    console.log('✅ Reporte generado exitosamente');
    console.log(`📄 Ubicación: ${reportPath}`);
    console.log('\nAbriendo en navegador...');
    
    // Abrir en navegador (macOS)
    const { exec } = require('child_process');
    exec(`open "${reportPath}"`);
    
  } catch (error) {
    console.error('❌ Error al generar reporte:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
