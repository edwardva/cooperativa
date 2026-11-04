import { Prisma, Beneficiario } from '@prisma/client';

type Cliente = Prisma.TransactionClient;

/**
 * Fila "titular" de Beneficiario de UN expediente (el propio socio), que es la
 * que va enlazada a sus acuerdos de salud y funeraria. Si no existe, se crea.
 *
 * Se busca por expediente, nunca por cédula: una misma persona puede tener
 * varios expedientes con la misma cédula, y buscar por cédula devolvía la fila
 * de OTRO expediente (el acuerdo quedaba a nombre del expediente equivocado).
 */
export async function obtenerOCrearFichaTitular(tx: Cliente, socioId: number): Promise<Beneficiario> {
  const socio = await tx.socio.findUnique({ where: { id: socioId } });
  if (!socio) {
    throw new Error('Socio no encontrado');
  }

  const existente = await tx.beneficiario.findFirst({
    where: { socio_id: socioId, parentesco: { equals: 'titular', mode: 'insensitive' } },
    orderBy: { id: 'asc' },
  });
  if (existente) {
    return existente;
  }

  const nombrePartes = socio.nombre.trim().split(/\s+/);
  const apellidoPartes = socio.apellido.trim().split(/\s+/);

  return tx.beneficiario.create({
    data: {
      socio_id: socioId,
      cedula: socio.cedula,
      nombre: (nombrePartes[0] || 'Sin Nombre').substring(0, 100),
      apellido: apellidoPartes.join(' ').substring(0, 100),
      parentesco: 'titular',
      estado: 'activo',
    },
  });
}
