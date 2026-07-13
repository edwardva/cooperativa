import { PrismaClient } from '../../backend/node_modules/@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:1234@localhost:5432/cooperativa?schema=public'
    }
  }
});

async function main() {
  const total = await prisma.socio.count();
  const activos = await prisma.socio.count({ where: { estado: 'activo' } });
  const inactivos = await prisma.socio.count({ where: { estado: 'inactivo' } });
  
  console.log('====================================');
  console.log('RESUMEN DE SOCIOS IMPORTADOS');
  console.log('====================================');
  console.log(`Total:     ${total.toLocaleString()} socios`);
  console.log(`Activos:   ${activos.toLocaleString()} socios (${(activos/total*100).toFixed(1)}%)`);
  console.log(`Inactivos: ${inactivos.toLocaleString()} socios (${(inactivos/total*100).toFixed(1)}%)`);
  console.log('====================================');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
