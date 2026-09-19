/**
 * ============================================
 * DATOS DE PRUEBA
 * ============================================
 * Arma un juego de datos para que la cooperativa pueda probar el sistema antes
 * de la puesta en marcha: socios con distintos grados de atraso, ahorro con
 * movimientos, colectas, préstamos y una feria con trabajadores.
 *
 * Por qué hace falta: con lo migrado hasta ahora, la morosidad y el tablero
 * salen vacíos, así que no hay nada que probar. Estos datos hacen que la
 * revisión de morosidad muestre suspensiones y retiros de verdad.
 *
 * TODO lo que crea lleva marca: expediente que empieza por PRB, nombre que
 * empieza por PRUEBA, feria PRB y préstamos PRB. `--borrar` lo quita todo.
 * Igual, antes de la migración definitiva se vacía la base entera.
 *
 * Uso:
 *   npx tsx prisma/datos-prueba.ts            (muestra qué haría)
 *   npx tsx prisma/datos-prueba.ts --aplicar
 *   npx tsx prisma/datos-prueba.ts --borrar
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { semanaActual, deOrdinal, aOrdinal } from '../src/utils/calendarioSemanal';

const prisma = new PrismaClient();

const MARCA = 'PRB';
const CEDULA_BASE = 99000000;

/** Cuántos socios de cada situación, y cuántas semanas debe cada uno */
const REPARTO: { atraso: number; cuantos: number; nota: string }[] = [
  { atraso: 0, cuantos: 8, nota: 'al día' },
  { atraso: 3, cuantos: 3, nota: 'atrasado, sin suspensión' },
  { atraso: 7, cuantos: 3, nota: 'semana 6: 3 días de suspensión' },
  { atraso: 15, cuantos: 3, nota: 'semana 11: un mes de suspensión' },
  { atraso: 38, cuantos: 2, nota: 'próximo a la semana 41' },
  { atraso: 45, cuantos: 2, nota: 'semana 41: retiro por el artículo 5' },
];

const dias = (n: number) => new Date(Date.now() - n * 86_400_000);
const redondear = (v: number) => Math.round(v * 100) / 100;

async function borrar() {
  const socios = await prisma.socio.findMany({ where: { codigo_socio: { startsWith: MARCA } }, select: { id: true } });
  const ids = socios.map((s) => s.id);
  if (ids.length === 0) {
    console.log('No hay datos de prueba que borrar.');
  } else {
    await prisma.detalleColecta.deleteMany({ where: { colecta: { socio_id: { in: ids } } } });
    await prisma.colecta.deleteMany({ where: { socio_id: { in: ids } } });
    await prisma.abonoPrestamo.deleteMany({ where: { prestamo: { socio_id: { in: ids } } } });
    await prisma.planPago.deleteMany({ where: { prestamo: { socio_id: { in: ids } } } });
    await prisma.fiador.deleteMany({ where: { OR: [{ prestamo: { socio_id: { in: ids } } }, { socio_id: { in: ids } }] } });
    await prisma.prestamo.deleteMany({ where: { socio_id: { in: ids } } });
    await prisma.movimientoAhorro.deleteMany({ where: { cuenta: { socio_id: { in: ids } } } });
    await prisma.cuentaAhorro.deleteMany({ where: { socio_id: { in: ids } } });
    await prisma.acuerdoFuneraria.deleteMany({ where: { beneficiario: { socio_id: { in: ids } } } });
    await prisma.acuerdoSalud.deleteMany({ where: { beneficiario: { socio_id: { in: ids } } } });
    await prisma.beneficiario.deleteMany({ where: { socio_id: { in: ids } } });
    await prisma.trabajadorFeria.deleteMany({ where: { trabajador: { codigo_trabajador: { startsWith: MARCA } } } });
    await prisma.socioTrabajador.deleteMany({ where: { codigo_trabajador: { startsWith: MARCA } } });
    await prisma.historialEstadoSocio.deleteMany({ where: { socio_id: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { modulo: { in: ['socios', 'ahorro', 'colecta'] }, registro_id: { in: ids } } });
    await prisma.socio.deleteMany({ where: { id: { in: ids } } });
    console.log(`Borrados ${ids.length} socios de prueba y todo lo suyo.`);
  }
  await prisma.ubicacion.deleteMany({ where: { codigo: MARCA } });
  await prisma.persona.deleteMany({ where: { nombres: { startsWith: 'PRUEBA ' }, apellidos: { startsWith: 'ATRASO ' } } });
}

async function sembrar() {
  const hoy = semanaActual();
  const tipoCuenta = await prisma.tipoCuentaAhorro.findFirst({ where: { estado: true } });
  const tipoFuneraria = await prisma.tipoAcuerdoFuneraria.findFirst({ where: { estado: true } });
  const tipoSalud = await prisma.tipoAcuerdoSalud.findFirst({ where: { estado: true } });
  // Efectivo si está; si no, cualquier tipo activo (la base local no los tiene todos)
  const tipoPrestamo =
    (await prisma.tipoPrestamo.findFirst({ where: { estado: true, codigo: '05' } })) ??
    (await prisma.tipoPrestamo.findFirst({ where: { estado: true } }));
  const usuario = await prisma.usuario.findFirst({ where: { estado: 'activo' } });

  const feria = await prisma.ubicacion.upsert({
    where: { codigo: MARCA },
    update: {},
    create: { codigo: MARCA, nombre: 'FERIA DE PRUEBA', observaciones: 'Datos de prueba: se borra antes de la migración' },
  });

  let n = 0;
  const creados: { socio: { id: number; codigo_socio: string }; atraso: number }[] = [];

  for (const grupo of REPARTO) {
    for (let i = 0; i < grupo.cuantos; i++) {
      n++;
      const codigo = `${MARCA}${String(n).padStart(3, '0')}`;
      const cedula = String(CEDULA_BASE + n);
      const socio = await prisma.socio.create({
        data: {
          codigo_socio: codigo,
          cedula,
          nombre: `PRUEBA ${n}`,
          apellido: `ATRASO ${grupo.atraso}`,
          telefono: `0414${String(1000000 + n)}`,
          fecha_nacimiento: new Date(1975, n % 12, ((n * 3) % 27) + 1),
          fecha_inscripcion: dias(400 - n * 10),
          ubicacion_id: feria.id,
          estado: 'activo',
          notas: `Socio de prueba · ${grupo.nota}`,
        },
      });
      creados.push({ socio, atraso: grupo.atraso });

      // Titular como beneficiario: es la fila que cuelga de los acuerdos
      const titular = await prisma.beneficiario.create({
        data: {
          socio_id: socio.id,
          cedula,
          nombre: socio.nombre,
          apellido: socio.apellido,
          fecha_nacimiento: socio.fecha_nacimiento,
          fecha_ingreso: socio.fecha_inscripcion,
          parentesco: 'titular',
        },
      });

      // Cobertura: hasta qué semana pagó. El atraso sale de compararla con hoy.
      const cubierto = deOrdinal(aOrdinal(hoy) - grupo.atraso);
      const cobertura = {
        ano_pagado_hasta: cubierto.ano,
        semana_pagada_hasta: cubierto.semana,
        fecha_ultimo_pago: dias(grupo.atraso * 7),
        semanas_sin_pago: grupo.atraso,
        fecha_inicio: dias(400 - n * 10),
      };
      if (tipoFuneraria) {
        await prisma.acuerdoFuneraria.create({
          data: { beneficiario_id: titular.id, tipo_acuerdo_id: tipoFuneraria.id, numero_acuerdo: `${MARCA}F${n}`, estado: 'activo', ...cobertura },
        });
      }
      if (tipoSalud) {
        await prisma.acuerdoSalud.create({
          data: { beneficiario_id: titular.id, tipo_acuerdo_id: tipoSalud.id, numero_acuerdo: `${MARCA}S${n}`, estado: 'activo', ...cobertura },
        });
      }

      // Ahorro: saldo y movimientos de los últimos 12 meses
      if (tipoCuenta) {
        const cuenta = await prisma.cuentaAhorro.create({
          data: {
            socio_id: socio.id, tipo_cuenta_id: tipoCuenta.id, numero_cuenta: `${MARCA}-${codigo}`,
            saldo_usd: 0, saldo_bs: 0, monto_bloqueado_usd: 0, monto_bloqueado_bs: 0, estado: true,
          },
        });
        let saldo = 0;
        for (let mes = 11; mes >= 0; mes--) {
          const monto = redondear(8 + ((n * 7 + mes * 5) % 22));
          const anterior = saldo;
          saldo = redondear(saldo + monto);
          await prisma.movimientoAhorro.create({
            data: {
              cuenta_id: cuenta.id, tipo_movimiento: 'deposito', monto_usd: monto, monto_bs: 0, tasa_cambio: 1,
              saldo_anterior_usd: anterior, saldo_nuevo_usd: saldo, fecha_movimiento: dias(mes * 30 + 2),
              concepto: 'Ahorro semanal (prueba)',
            },
          });
          if (mes % 4 === 0 && saldo > 30) {
            const retiro = 15;
            const previo = saldo;
            saldo = redondear(saldo - retiro);
            await prisma.movimientoAhorro.create({
              data: {
                cuenta_id: cuenta.id, tipo_movimiento: 'retiro', monto_usd: retiro, monto_bs: 0, tasa_cambio: 1,
                saldo_anterior_usd: previo, saldo_nuevo_usd: saldo, fecha_movimiento: dias(mes * 30),
                concepto: 'Retiro (prueba)',
              },
            });
          }
        }
        await prisma.cuentaAhorro.update({ where: { id: cuenta.id }, data: { saldo_usd: saldo } });
      }

      // Colecta de las últimas 12 semanas, sólo para los que están al día
      if (usuario && grupo.atraso === 0) {
        for (let semana = 0; semana < 12; semana++) {
          const colecta = await prisma.colecta.create({
            data: {
              socio_id: socio.id, usuario_id: usuario.id, ubicacion_id: feria.id,
              monto_total_usd: 3.4, monto_total_bs: 0, tasa_cambio: 1,
              fecha_colecta: dias(semana * 7 + 1), semanas_cobradas: 1,
            },
          });
          await prisma.detalleColecta.createMany({
            data: [
              { colecta_id: colecta.id, servicio: 'ahorro', monto_usd: 2, monto_bs: 0, semanas: 1 },
              { colecta_id: colecta.id, servicio: 'funeraria', monto_usd: 0.9, monto_bs: 0, semanas: 1 },
              { colecta_id: colecta.id, servicio: 'salud', monto_usd: 0.5, monto_bs: 0, semanas: 1 },
            ],
          });
        }
      }
    }
  }

  // Préstamos: dos al día, uno moroso y uno en solicitud
  if (tipoPrestamo) {
    const base = {
      tipo_prestamo_id: tipoPrestamo.id, monto_original_bs: new Prisma.Decimal(0), tasa_cambio_inicial: new Prisma.Decimal(1),
      tasa_interes: new Prisma.Decimal(1), tasa_interes_mensual: new Prisma.Decimal(1),
      saldo_capital_bs: new Prisma.Decimal(0), saldo_interes_bs: new Prisma.Decimal(0),
      plazo_semanas: 15, cuota_semanal_usd: new Prisma.Decimal(0), cuota_semanal_bs: new Prisma.Decimal(0),
    };
    const receta = [
      { i: 0, monto: 320, saldo: 180, estado: 'activo' as const, dias: 60 },
      { i: 1, monto: 220, saldo: 95, estado: 'activo' as const, dias: 35 },
      { i: 2, monto: 520, saldo: 400, estado: 'moroso' as const, dias: 120 },
      { i: 3, monto: 120, saldo: 120, estado: 'solicitado' as const, dias: 2 },
    ];
    for (const r of receta) {
      const socio = creados[r.i]!.socio;
      await prisma.prestamo.create({
        data: {
          ...base, socio_id: socio.id, numero_prestamo: `${MARCA}P${r.i + 1}`,
          monto_original_usd: r.monto, saldo_capital_usd: r.saldo, saldo_interes_usd: redondear(r.saldo * 0.02),
          estado: r.estado, fecha_desembolso: dias(r.dias), fecha_vencimiento: dias(r.dias - 105),
          interes_calculado_hasta: r.estado === 'solicitado' ? null : dias(0),
        },
      });
    }
  }

  // Trabajadores de la feria, para probar la salud por feria. El trabajador
  // cuelga de la PERSONA, no del expediente: se crea también su persona.
  for (const [i, { socio }] of creados.slice(0, 4).entries()) {
    const completo = await prisma.socio.findUniqueOrThrow({ where: { id: socio.id } });
    const persona = await prisma.persona.upsert({
      where: { numero_identificacion: completo.cedula },
      update: {},
      create: {
        numero_identificacion: completo.cedula,
        nombres: completo.nombre,
        apellidos: completo.apellido,
        fecha_nacimiento: completo.fecha_nacimiento,
        telefono: completo.telefono,
      },
    });
    await prisma.socio.update({ where: { id: socio.id }, data: { persona_id: persona.id } });
    const trabajador = await prisma.socioTrabajador.create({
      data: { persona_id: persona.id, codigo_trabajador: `${MARCA}T${i + 1}`, fecha_ingreso: dias(200), estado: 'activo' },
    });
    await prisma.trabajadorFeria.create({
      data: { trabajador_id: trabajador.id, feria_id: feria.id, fecha_inicio: dias(200) },
    });
  }

  console.log(`Creados: ${creados.length} socios en la feria ${feria.nombre} (${feria.codigo}).`);
  for (const grupo of REPARTO) console.log(`  - ${grupo.cuantos} con ${grupo.atraso} semanas: ${grupo.nota}`);
  console.log('  - 4 préstamos, 4 trabajadores de feria y colecta de 12 semanas para los que están al día.');
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const quitar = process.argv.includes('--borrar');

  if (quitar) return borrar();
  if (!aplicar) {
    const total = REPARTO.reduce((a, g) => a + g.cuantos, 0);
    console.log(`Crearía ${total} socios de prueba con sus acuerdos, ahorro, colectas y préstamos.`);
    console.log('Vuelva a correrlo con --aplicar para hacerlo, o con --borrar para quitarlos.');
    return;
  }

  await borrar();
  await sembrar();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
