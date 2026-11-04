/**
 * ============================================
 * CONTROLLER: TRASPASO DE ACUERDO DE SALUD
 * ============================================
 * Pasa un acuerdo de salud a otro socio registrado cuando el titular deja de
 * estar (fallecimiento, migración...). Reglas en utils/traspasoAcuerdo.ts.
 *
 * En Salud el acuerdo son varias filas con el mismo número, una por persona,
 * cada una con su cobertura e historial de pagos:
 *   - La fila del titular anterior queda RETIRADA (con su historial) y con
 *     parentesco "Titular anterior", para que no cuente como titular.
 *   - El nuevo titular recibe una fila titular con el mismo estado, cobertura
 *     y fecha de inicio que tenía la del titular anterior (si ya estaba en el
 *     acuerdo como beneficiario, esa misma fila pasa a ser la titular).
 *   - Las filas de los beneficiarios se conservan (con sus pagos) y pasan a
 *     apuntar a la ficha de la persona en el expediente del nuevo titular.
 *   - Quien es de otro expediente (otro socio) sigue con su ficha; solo se
 *     revisa su parentesco con el nuevo titular.
 */

import type { Request, Response } from 'express';
import type { AcuerdoSalud, Beneficiario, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { registrarAuditoria } from '../services/auditoriaService';
import { obtenerOCrearFichaTitular } from '../utils/fichaTitular';
import {
  ErrorTraspaso,
  PARENTESCO_TITULAR_ANTERIOR,
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
type Fila = AcuerdoSalud & { beneficiario: Beneficiario };

const esTitular = (parentesco: string) => parentesco.trim().toLowerCase() === 'titular';
// Igual que FILA_TITULAR_SALUD en saludController
const esFilaTitular = (fila: Fila) => fila.parentesco === null && esTitular(fila.beneficiario.parentesco);

const MOTIVO_RETIRO_TRASPASO = 'Traspaso';

async function planificar(cliente: Cliente, numeroAcuerdo: string, expediente: string) {
  const filas: Fila[] = await cliente.acuerdoSalud.findMany({
    where: { numero_acuerdo: numeroAcuerdo },
    include: { beneficiario: true },
    orderBy: { id: 'asc' },
  });
  if (filas.length === 0) {
    throw new ErrorTraspaso(404, 'ACUERDO_NOT_FOUND', `No existe el acuerdo de salud ${numeroAcuerdo}.`);
  }
  const filaTitular = filas.find(esFilaTitular);
  if (!filaTitular) {
    throw new ErrorTraspaso(409, 'SIN_TITULAR', `El acuerdo de salud ${numeroAcuerdo} no tiene titular registrado; no se puede traspasar.`);
  }
  if (filaTitular.estado === 'retirado') {
    throw new ErrorTraspaso(400, 'ACUERDO_RETIRADO', `El acuerdo de salud ${numeroAcuerdo} está retirado y no se puede traspasar.`);
  }

  const anterior = await cliente.socio.findUnique({ where: { id: filaTitular.beneficiario.socio_id } });
  if (!anterior) throw new ErrorTraspaso(404, 'SOCIO_NOT_FOUND', 'No se encontró el expediente del titular actual.');
  const nuevo = await buscarNuevoTitular(cliente, expediente, anterior.id);

  // Misma regla que al crear un acuerdo de salud
  const cuenta = await cliente.cuentaAhorro.findFirst({ where: { socio_id: nuevo.id, estado: true }, select: { id: true } });
  if (!cuenta) {
    throw new ErrorTraspaso(
      400,
      'SIN_CUENTA_AHORRO_ACTIVA',
      `El socio ${nuevo.codigo_socio} no tiene ninguna cuenta de ahorro activa. Debe tener al menos una para recibir un acuerdo de salud; verifícalo en el módulo de Ahorro.`
    );
  }

  const otrosAcuerdos = await cliente.acuerdoSalud.count({
    where: {
      parentesco: null,
      beneficiario: { socio_id: nuevo.id, parentesco: { equals: 'titular', mode: 'insensitive' } },
      estado: { not: 'retirado' },
      numero_acuerdo: { not: numeroAcuerdo },
    },
  });
  const numeroFinal = await numeroTraspasado(numeroAcuerdo, otrosAcuerdos > 0, async (n) =>
    Boolean(await cliente.acuerdoSalud.findFirst({ where: { numero_acuerdo: n }, select: { id: true } }))
  );

  const fichaNuevo = await cliente.beneficiario.findFirst({
    where: { socio_id: nuevo.id, parentesco: { equals: 'titular', mode: 'insensitive' } },
    orderBy: { id: 'asc' },
  });
  const cedulasNuevo = new Set([nuevo.cedula, fichaNuevo?.cedula].filter(Boolean) as string[]);
  const fichasEnGrupo = new Set(filas.map((f) => f.beneficiario_id));

  const personas: Array<PersonaTraspaso & { fila: Fila; destino: Beneficiario | null }> = [];
  for (const fila of filas) {
    if (fila === filaTitular || fila.estado === 'retirado') continue;
    const p = fila.beneficiario;
    const base = {
      clave: fila.id,
      cedula: p.cedula,
      nombre: p.nombre,
      apellido: p.apellido,
      estado: p.estado,
      parentesco_actual: fila.parentesco ?? p.parentesco,
      fila,
    };

    if (p.socio_id === nuevo.id) {
      if (esTitular(p.parentesco)) {
        personas.push({ ...base, accion: 'es_nuevo_titular', nota: 'Es quien recibe el acuerdo: pasa a ser el titular.', requiere_parentesco: false, destino: p });
      } else {
        personas.push({ ...base, accion: 'reutiliza', nota: `Ya es del expediente ${nuevo.codigo_socio}.`, requiere_parentesco: true, destino: p });
      }
      continue;
    }
    if (p.socio_id !== anterior.id) {
      personas.push({ ...base, accion: 'otro_expediente', nota: 'Es de otro expediente: conserva su ficha.', requiere_parentesco: true, destino: null });
      continue;
    }
    if (cedulasNuevo.has(p.cedula)) {
      personas.push({ ...base, accion: 'es_nuevo_titular', nota: 'Es quien recibe el acuerdo: pasa a ser el titular.', requiere_parentesco: false, destino: null });
      continue;
    }

    const destino = await fichaEnExpediente(cliente, nuevo.id, p.cedula);
    if (destino) {
      if (fichasEnGrupo.has(destino.id)) {
        personas.push({ ...base, accion: 'excluida', nota: 'Ya figura en este acuerdo con su ficha del nuevo expediente: no se duplica.', requiere_parentesco: false, destino });
        continue;
      }
      const enOtro = await cliente.acuerdoSalud.findFirst({
        where: { beneficiario_id: destino.id, estado: { not: 'retirado' }, numero_acuerdo: { not: numeroAcuerdo } },
        select: { numero_acuerdo: true },
      });
      if (enOtro) {
        personas.push({
          ...base,
          accion: 'excluida',
          nota: `Ya está en el acuerdo de salud ${enOtro.numero_acuerdo || ''} del nuevo titular: no se duplica.`,
          requiere_parentesco: false,
          destino,
        });
        continue;
      }
    }
    personas.push({
      ...base,
      accion: destino ? 'reutiliza' : 'pasa',
      nota: destino ? `Ya está registrada en el expediente ${nuevo.codigo_socio}: se usa esa ficha.` : null,
      requiere_parentesco: true,
      destino,
    });
  }

  return { numeroAcuerdo, filas, filaTitular, anterior, nuevo, otrosAcuerdos, numeroFinal, personas };
}

type Plan = Awaited<ReturnType<typeof planificar>>;

const respuestaPlan = (plan: Plan) => ({
  acuerdo: {
    numero_acuerdo: plan.numeroAcuerdo,
    estado: plan.filaTitular.estado,
    fecha_inicio: plan.filaTitular.fecha_inicio,
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
  personas: plan.personas.map(({ fila: _f, destino: _d, ...p }) => p),
});

/**
 * GET /api/salud/grupos/:numeroAcuerdo/traspaso?expediente=XXX
 * Vista previa: nuevo titular, número que quedará y qué pasa con cada persona.
 */
export const vistaPreviaTraspasoSalud = async (req: Request, res: Response): Promise<void> => {
  try {
    const { expediente } = vistaPreviaTraspasoSchema.parse(req.query);
    const plan = await planificar(prisma, req.params.numeroAcuerdo!, expediente);
    res.json({ success: true, data: respuestaPlan(plan) });
  } catch (error) {
    if (!responderErrorTraspaso(res, error, 'Error al preparar el traspaso')) {
      logger.error('Error en vista previa de traspaso de salud:', error);
    }
  }
};

/**
 * POST /api/salud/grupos/:numeroAcuerdo/traspaso
 * Traspasa el acuerdo de salud al socio del expediente indicado. Todo o nada.
 */
export const confirmarTraspasoSalud = async (req: Request, res: Response): Promise<void> => {
  try {
    const numeroAcuerdo = req.params.numeroAcuerdo!;
    const datos = confirmarTraspasoSchema.parse(req.body);
    const motivo = textoMotivo(datos);

    const resultado = await prisma.$transaction(
      async (tx) => {
        const previo = await tx.acuerdoSalud.findFirst({
          where: {
            numero_acuerdo: numeroAcuerdo,
            parentesco: null,
            beneficiario: { parentesco: { equals: 'titular', mode: 'insensitive' } },
          },
          select: { beneficiario: { select: { socio_id: true } } },
        });
        if (!previo) throw new ErrorTraspaso(404, 'ACUERDO_NOT_FOUND', `No existe el acuerdo de salud ${numeroAcuerdo} o no tiene titular.`);
        const nuevoPrevio = await tx.socio.findUnique({ where: { codigo_socio: datos.expediente }, select: { id: true } });
        await bloquearSociosTraspaso(tx, previo.beneficiario.socio_id, nuevoPrevio?.id ?? previo.beneficiario.socio_id);

        const plan = await planificar(tx, numeroAcuerdo, datos.expediente);
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
        const retirar = (id: number, extra: Prisma.AcuerdoSaludUncheckedUpdateInput = {}) =>
          tx.acuerdoSalud.update({
            where: { id },
            data: { estado: 'retirado', fecha_retiro: hoy, motivo_retiro: MOTIVO_RETIRO_TRASPASO, ...extra },
          });
        const detalle: Array<{ cedula: string; accion: string; fila: number; ficha_origen: number; ficha_destino: number | null }> = [];

        for (const p of plan.personas) {
          const parentesco = parentescoDe.get(p.clave);
          let destinoId: number | null = p.fila.beneficiario_id;
          switch (p.accion) {
            case 'pasa': {
              const copia = await copiarFichaAExpediente(tx, p.fila.beneficiario, plan.nuevo.id, parentesco!);
              await tx.acuerdoSalud.update({ where: { id: p.fila.id }, data: { beneficiario_id: copia.id, parentesco: null } });
              destinoId = copia.id;
              break;
            }
            case 'reutiliza':
              await tx.beneficiario.update({
                where: { id: p.destino!.id },
                data: { parentesco: parentesco!, ...datosFallecimiento(p.fila.beneficiario, p.destino!) },
              });
              await tx.acuerdoSalud.update({ where: { id: p.fila.id }, data: { beneficiario_id: p.destino!.id, parentesco: null } });
              destinoId = p.destino!.id;
              break;
            case 'otro_expediente':
              await tx.acuerdoSalud.update({ where: { id: p.fila.id }, data: { parentesco: parentesco! } });
              break;
            case 'es_nuevo_titular':
              // Su propia ficha (otro expediente) se convierte en la fila titular más abajo
              if (p.fila.beneficiario.socio_id !== plan.nuevo.id) {
                await retirar(p.fila.id);
                destinoId = null;
              }
              break;
            case 'excluida':
              await retirar(p.fila.id);
              destinoId = null;
              break;
          }
          detalle.push({ cedula: p.cedula, accion: p.accion, fila: p.fila.id, ficha_origen: p.fila.beneficiario_id, ficha_destino: destinoId });
        }

        // El titular anterior sale: su fila queda retirada con su historial de pagos
        const t = plan.filaTitular;
        await retirar(t.id, { parentesco: PARENTESCO_TITULAR_ANTERIOR });

        // El nuevo titular sigue con lo ganado: mismo estado, cobertura y fecha de inicio
        const fichaNuevo = await obtenerOCrearFichaTitular(tx, plan.nuevo.id);
        const datosTitular = {
          parentesco: null,
          tipo_acuerdo_id: t.tipo_acuerdo_id,
          numero_contrato: t.numero_contrato,
          estado: t.estado,
          ano_pagado_hasta: t.ano_pagado_hasta,
          semana_pagada_hasta: t.semana_pagada_hasta,
          fecha_ultimo_pago: t.fecha_ultimo_pago,
          semanas_sin_pago: t.semanas_sin_pago,
          fecha_suspension: t.fecha_suspension,
          fecha_retiro: null,
          motivo_retiro: null,
          fecha_inicio: t.fecha_inicio,
        };
        const filaExistente = plan.filas.find((f) => f.beneficiario_id === fichaNuevo.id);
        const filaNuevoTitular = filaExistente
          ? await tx.acuerdoSalud.update({ where: { id: filaExistente.id }, data: datosTitular })
          : await tx.acuerdoSalud.create({
              data: { ...datosTitular, beneficiario_id: fichaNuevo.id, numero_acuerdo: plan.numeroAcuerdo },
            });

        if (plan.numeroFinal !== plan.numeroAcuerdo) {
          await tx.acuerdoSalud.updateMany({
            where: { numero_acuerdo: plan.numeroAcuerdo },
            data: { numero_acuerdo: plan.numeroFinal },
          });
        }

        await anotarTraspasoEnExpedientes(
          tx,
          'salud',
          plan.numeroAcuerdo,
          plan.numeroFinal,
          plan.anterior,
          plan.nuevo,
          motivo,
          req.user!.userId
        );

        await registrarAuditoria(tx, {
          req,
          accion: 'TRASPASO',
          modulo: 'salud',
          registro_id: filaNuevoTitular.id,
          antes: {
            numero_acuerdo: plan.numeroAcuerdo,
            titular_expediente: plan.anterior.codigo_socio,
            fila_titular: t.id,
          },
          despues: {
            numero_acuerdo: plan.numeroFinal,
            titular_expediente: plan.nuevo.codigo_socio,
            fila_titular: filaNuevoTitular.id,
            motivo,
            personas: detalle,
          },
        });

        return plan;
      },
      { timeout: 30_000 }
    );

    logger.info(
      `Acuerdo de salud ${resultado.numeroAcuerdo} traspasado de ${resultado.anterior.codigo_socio} a ${resultado.nuevo.codigo_socio} (número ${resultado.numeroFinal})`
    );
    res.json({
      success: true,
      data: {
        numero_anterior: resultado.numeroAcuerdo,
        numero_acuerdo: resultado.numeroFinal,
        nuevo_titular: respuestaPlan(resultado).nuevo_titular,
        pasan: resultado.personas.filter((p) => ['pasa', 'reutiliza', 'otro_expediente'].includes(p.accion)).length,
        excluidas: resultado.personas.filter((p) => p.accion === 'excluida').map((p) => `${p.nombre} ${p.apellido}: ${p.nota}`),
      },
    });
  } catch (error) {
    if (!responderErrorTraspaso(res, error, 'Ocurrió un error al traspasar el acuerdo de salud. No se cambió nada; intenta de nuevo.')) {
      logger.error('Error al traspasar acuerdo de salud:', error);
    }
  }
};
