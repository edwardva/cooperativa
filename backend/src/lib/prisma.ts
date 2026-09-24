// ============================================
// COOPERATIVA EL TRIUNFO - INFRAESTRUCTURA
// Cliente único de Prisma
// ============================================
//
// Un solo PrismaClient para todo el backend.
//
// Cada instancia abre su PROPIO pool de conexiones —por defecto
// `vCPUs * 2 + 1`—, así que tener uno por controlador las multiplicaba: 30
// clientes contra un `max_connections` de 100 dejaban la base llena de
// conexiones ociosas. Cuando se agotaban, las consultas esperaban un hueco,
// las peticiones se acumulaban en el servidor y las pantallas expiraban sin
// que ningún error apareciera en el log.
//
// En desarrollo el cliente se guarda en `globalThis` porque el recargado en
// caliente vuelve a evaluar el módulo, y sin eso cada recarga dejaría atrás
// un pool huérfano hasta repetir el mismo problema en local.

import { PrismaClient } from '@prisma/client';

const global_ = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = global_.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') global_.prisma = prisma;

export default prisma;
