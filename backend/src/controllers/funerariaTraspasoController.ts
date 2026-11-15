/**
 * ============================================
 * CONTROLLER: TRASPASO DE ACUERDO DE FUNERARIA
 * ============================================
 * Pasa un acuerdo de funeraria a otro socio registrado cuando el titular deja
 * de estar (fallecimiento, migración...). Reglas en utils/traspasoAcuerdo.ts.
 *
 * En Funeraria el acuerdo es UN registro: se reasigna al nuevo titular y
 * conserva fecha de inicio, cobertura e historial de pagos. Los beneficiarios
 * se copian (o se reutilizan) en el expediente del nuevo titular; las fichas
 * del expediente anterior quedan retiradas de este acuerdo como historial.
 */

import type { Request, Response } from 'express';
import type { Beneficiario, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { registrarAuditoria } from '../services/auditoriaService';
import { obtenerOCrearFichaTitular } from '../utils/fichaTitular';
import { agregarAlAcuerdo, retirarDelAcuerdo } from '../utils/miembrosFuneraria';
import {
  ErrorTraspaso,
  type PersonaTraspaso,
  anotarTraspasoEnExpedientes,
  bloquearSociosTraspaso,
  buscarNuevoTitular,
  confirmarTraspasoSchema,
  copiarFichaAExpediente,
  datosFallecimiento,
  fichaEnExpediente,
  numeroTraspasado,
  responderErrorTraspaso,
  textoMotivo,
  vistaPreviaTraspasoSchema,
} from '../utils/traspasoAcuerdo';

type Cliente = Prisma.TransactionClient;

const esTitular = (parentesco: string) => parentesco.trim().toLowerCase() === 'titular';

/** Lo que haría el traspaso, sin escribir nada. Se usa en la vista previa y, dentro de la transacción, al confirmar. */
async function planificar(cliente: Cliente, acuerdoId: number, expediente: string) {
  const acuerdo = await cliente.acuerdoFuneraria.findUnique({
    where: { id: acuerdoId },
    include: { beneficiario: { include: { socio: true } } },
  });
  if (!acuerdo) throw new ErrorTraspaso(404, 'ACUERDO_NOT_FOUND', 'Acuerdo de funeraria no encontrado');
  if (acuerdo.estado === 'retirado') {
    throw new ErrorTraspaso(400, 'ACUERDO_RETIRADO', `El acuerdo ${acuerdo.numero_acuerdo || ''} está retirado y no se puede traspasar.`);
  }
  const anterior = acuerdo.beneficiario.socio;
  const nuevo = await buscarNuevoTitular(cliente, expediente, anterior.id);

  const otrosAcuerdos = await cliente.acuerdoFuneraria.count({
    where: { beneficiario: { socio_id: nuevo.id }, estado: { in: ['activo', 'suspendido'] } },
  });
  const numeroFinal =
    acuerdo.numero_acuerdo === null && otrosAcuerdos === 0
      ? null
      : await numeroTraspasado(acuerdo.numero_acuerdo ?? anterior.codigo_socio, otrosAcuerdos > 0, async (n) =>
          Boolean(await cliente.acuerdoFuneraria.findUnique({ where: { numero_acuerdo: n }, select: { id: true } }))
        );

  // Beneficiarios vigentes del acuerdo (fallecidos incluidos: son historial del acuerdo)
  const miembros = (
    await cliente.acuerdoFunerariaBeneficiario.findMany({
      where: {
        acuerdo_id: acuerdo.id,
        fecha_retiro: null,
        beneficiario: { socio_id: anterior.id, NOT: { parentesco: { equals: 'titular', mode: 'insensitive' } } },
      },
      include: { beneficiario: true },
      orderBy: { beneficiario_id: 'asc' },
    })
  ).map((m) => m.beneficiario);

  const fichaNuevo = await cliente.beneficiario.findFirst({
    where: { socio_id: nuevo.id, parentesco: { equals: 'titular', mode: 'insensitive' } },
    orderBy: { id: 'asc' },
  });
  const cedulasNuevo = new Set([nuevo.cedula, fichaNuevo?.cedula].filter(Boolean) as string[]);

  const personas: Array<PersonaTraspaso & { origen: Beneficiario; destino: Beneficiario | null }> = [];
  for (const m of miembros) {
    const base = {
      clave: m.id,
      cedula: m.cedula,
      nombre: m.nombre,
      apellido: m.apellido,
      estado: m.estado,
      parentesco_actual: m.parentesco,
      origen: m,
    };
    if (cedulasNuevo.has(m.cedula)) {
      personas.push({ ...base, accion: 'es_nuevo_titular', nota: 'Es quien recibe el acuerdo: pasa a ser el titular.', requiere_parentesco: false, destino: null });
      continue;
    }
    // Si ya está en otro acuerdo del nuevo titular, sigue allá y además entra a
    // este: una persona puede estar en varios acuerdos de funeraria (10/11)
    const destino = await fichaEnExpediente(cliente, nuevo.id, m.cedula);
    if (destino && esTitular(destino.parentesco)) {
      // Socio con la misma cédula registrado como titular de este expediente: no se toca su ficha
      personas.push({ ...base, accion: 'excluida', nota: 'Su cédula es la del titular del nuevo expediente.', requiere_parentesco: false, destino });
      continue;
    }
    personas.push({
      ...base,
      accion: destino ? 'reutiliza' : 'pasa',
      nota: destino ? `Ya está registrada en el expediente ${nuevo.codigo_socio}: se usa esa ficha.` : null,
      requiere_parentesco: true,
      destino,
    });
  }

  return { acuerdo, anterior, nuevo, otrosAcuerdos, numeroFinal, personas };
}

type Plan = Awaited<ReturnType<typeof planificar>>;

const respuestaPlan = (plan: Plan) => ({
  acuerdo: {
    id: plan.acuerdo.id,
    numero_acuerdo: plan.acuerdo.numero_acuerdo,
    estado: plan.acuerdo.estado,
    fecha_inicio: plan.acuerdo.fecha_inicio,
  },
  titular_anterior: {
    id: plan.anterior.id,
    expediente: plan.anterior.codigo_socio,
    nombre: plan.anterior.nombre,
    apellido: plan.anterior.apellido,
    cedula: plan.anterior.cedula,
  },
  nuevo_titular: {
    id: plan.nuevo.id,
    expediente: plan.nuevo.codigo_socio,
    nombre: plan.nuevo.nombre,
    apellido: plan.nuevo.apellido,
    cedula: plan.nuevo.cedula,
    telefono: plan.nuevo.telefono,
  },
  otros_acuerdos: plan.otrosAcuerdos,
  numero_final: plan.numeroFinal,
  personas: plan.personas.map(({ origen: _o, destino: _d, ...p }) => p),
});

const leerId = (req: Request) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) throw new ErrorTraspaso(400, 'INVALID_ID', 'ID de acuerdo inválido');
  return id;
};

/**
 * GET /api/funeraria/acuerdos/:id/traspaso?expediente=XXX
 * Vista previa: nuevo titular, número que quedará y qué pasa con cada beneficiario.
 */
export const vistaPreviaTraspasoFuneraria = async (req: Request, res: Response): Promise<void> => {
  try {
    const { expediente } = vistaPreviaTraspasoSchema.parse(req.query);
    const plan = await planificar(prisma, leerId(req), expediente);
    res.json({ success: true, data: respuestaPlan(plan) });
  } catch (error) {
    if (!responderErrorTraspaso(res, error, 'Error al preparar el traspaso')) {
      logger.error('Error en vista previa de traspaso de funeraria:', error);
    }
  }
};

/**
 * POST /api/funeraria/acuerdos/:id/traspaso
 * Traspasa el acuerdo al socio del expediente indicado. Todo o nada.
 */
export const confirmarTraspasoFuneraria = async (req: Request, res: Response): Promise<void> => {
  try {
    const acuerdoId = leerId(req);
    const datos = confirmarTraspasoSchema.parse(req.body);
    const motivo = textoMotivo(datos);

    const resultado = await prisma.$transaction(
      async (tx) => {
        // Bloquear a los dos socios y recién entonces releer todo
        const previo = await tx.acuerdoFuneraria.findUnique({
          where: { id: acuerdoId },
          select: { beneficiario: { select: { socio_id: true } } },
        });
        if (!previo) throw new ErrorTraspaso(404, 'ACUERDO_NOT_FOUND', 'Acuerdo de funeraria no encontrado');
        const nuevoPrevio = await tx.socio.findUnique({ where: { codigo_socio: datos.expediente }, select: { id: true } });
        await bloquearSociosTraspaso(tx, previo.beneficiario.socio_id, nuevoPrevio?.id ?? previo.beneficiario.socio_id);

        const plan = await planificar(tx, acuerdoId, datos.expediente);
        const parentescoDe = new Map(datos.parentescos.map((p) => [p.clave, p.parentesco]));
        const faltan = plan.personas.filter((p) => p.requiere_parentesco && !parentescoDe.has(p.clave));
        if (faltan.length > 0) {
          throw new ErrorTraspaso(
            400,
            'FALTA_PARENTESCO',
            `Elige el parentesco con el nuevo titular de: ${faltan.map((p) => `${p.nombre} ${p.apellido}`).join(', ')}.`
          );
        }

        const hoy = new Date();
        const fichaNuevo = await obtenerOCrearFichaTitular(tx, plan.nuevo.id);
        const detalle: Array<{ cedula: string; accion: string; ficha_origen: number; ficha_destino: number | null }> = [];

        for (const p of plan.personas) {
          let destinoId: number | null = null;
          if (p.accion === 'pasa') {
            const copia = await copiarFichaAExpediente(tx, p.origen, plan.nuevo.id, parentescoDe.get(p.clave)!);
            destinoId = copia.id;
          } else if (p.accion === 'reutiliza') {
            await tx.beneficiario.update({
              where: { id: p.destino!.id },
              data: {
                parentesco: parentescoDe.get(p.clave)!,
                ...datosFallecimiento(p.origen, p.destino!),
              },
            });
            destinoId = p.destino!.id;
          }
          // La ficha del expediente anterior sale del acuerdo y queda como
          // historial; la del nuevo expediente entra en su lugar
          await retirarDelAcuerdo(tx, plan.acuerdo.id, p.origen.id, hoy);
          if (destinoId !== null) await agregarAlAcuerdo(tx, plan.acuerdo.id, [destinoId], hoy);
          detalle.push({ cedula: p.cedula, accion: p.accion, ficha_origen: p.origen.id, ficha_destino: destinoId });
        }

        const actualizado = await tx.acuerdoFuneraria.update({
          where: { id: plan.acuerdo.id },
          data: { beneficiario_id: fichaNuevo.id, numero_acuerdo: plan.numeroFinal },
        });

        await anotarTraspasoEnExpedientes(
          tx,
          'funeraria',
          plan.acuerdo.numero_acuerdo || `#${plan.acuerdo.id}`,
          plan.numeroFinal || `#${plan.acuerdo.id}`,
          plan.anterior,
          plan.nuevo,
          motivo,
          req.user!.userId
        );

        await registrarAuditoria(tx, {
          req,
          accion: 'TRASPASO',
          modulo: 'funeraria',
          registro_id: plan.acuerdo.id,
          antes: {
            numero_acuerdo: plan.acuerdo.numero_acuerdo,
            titular_expediente: plan.anterior.codigo_socio,
            titular_ficha: plan.acuerdo.beneficiario_id,
          },
          despues: {
            numero_acuerdo: actualizado.numero_acuerdo,
            titular_expediente: plan.nuevo.codigo_socio,
            titular_ficha: fichaNuevo.id,
            motivo,
            personas: detalle,
          },
        });

        return { plan, actualizado };
      },
      { timeout: 30_000 }
    );

    const { plan, actualizado } = resultado;
    logger.info(
      `Acuerdo de funeraria ${plan.acuerdo.id} traspasado de ${plan.anterior.codigo_socio} a ${plan.nuevo.codigo_socio} (número ${actualizado.numero_acuerdo})`
    );
    res.json({
      success: true,
      data: {
        acuerdo_id: actualizado.id,
        numero_anterior: plan.acuerdo.numero_acuerdo,
        numero_acuerdo: actualizado.numero_acuerdo,
        nuevo_titular: respuestaPlan(plan).nuevo_titular,
        pasan: plan.personas.filter((p) => p.accion === 'pasa' || p.accion === 'reutiliza').length,
        excluidas: plan.personas.filter((p) => p.accion === 'excluida').map((p) => `${p.nombre} ${p.apellido}: ${p.nota}`),
      },
    });
  } catch (error) {
    if (!responderErrorTraspaso(res, error, 'Ocurrió un error al traspasar el acuerdo. No se cambió nada; intenta de nuevo.')) {
      logger.error('Error al traspasar acuerdo de funeraria:', error);
    }
  }
};
