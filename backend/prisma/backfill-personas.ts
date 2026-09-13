/**
 * ============================================
 * CREAR LAS PERSONAS DE LOS SOCIOS EXISTENTES
 * ============================================
 * La migración 20260913000000_personas_trabajadores deja `socios.persona_id`
 * nulo. Este script agrupa los socios sin persona por cédula y, para cada
 * cédula, vincula sus expedientes a UNA persona.
 *
 * Qué NO hace, a propósito, y deja en el reporte para revisión humana:
 *   - Cédulas inválidas (TEMP000154, 11111111...): primero hay que corregirlas.
 *   - Cédulas con expedientes de nombres distintos: puede ser un error de
 *     tipeo o dos personas distintas, y unirlas por error mezcla sus datos.
 *   - Socios cuya cédula ya tiene persona con otro nombre.
 * Corregido el dato, se vuelve a correr y los toma.
 *
 * Es idempotente: sólo mira socios sin persona.
 *
 * Uso:
 *   npx tsx prisma/backfill-personas.ts            (muestra qué haría y escribe el reporte)
 *   npx tsx prisma/backfill-personas.ts --aplicar  (lo aplica)
 */

import { PrismaClient, type Socio } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { validarCedula } from '../src/utils/cedula';
import { pareceLaMismaPersona } from '../src/utils/personas';

const prisma = new PrismaClient();

type SocioBase = Pick<
  Socio,
  'id' | 'codigo_socio' | 'cedula' | 'nombre' | 'apellido' | 'sexo' | 'fecha_nacimiento' | 'telefono' | 'email' | 'direccion' | 'estado' | 'fecha_inscripcion'
>;

interface Pendiente {
  motivo: 'cedula_invalida' | 'nombres_distintos' | 'distinto_de_persona_existente';
  cedula: string;
  expedientes: { id: number; codigo_socio: string; nombre: string; estado: string }[];
  detalle?: string;
}

const resumir = (s: SocioBase) => ({ id: s.id, codigo_socio: s.codigo_socio, nombre: `${s.nombre} ${s.apellido}`, estado: s.estado });

/** El expediente cuyos datos pasan a la persona: activo primero, después el más reciente */
const masRepresentativo = (grupo: SocioBase[]): SocioBase =>
  [...grupo].sort(
    (a, b) =>
      Number(b.estado === 'activo') - Number(a.estado === 'activo') ||
      b.fecha_inscripcion.getTime() - a.fecha_inscripcion.getTime() ||
      b.id - a.id
  )[0]!;

async function main() {
  const aplicar = process.argv.includes('--aplicar');

  const socios = await prisma.socio.findMany({
    where: { persona_id: null },
    select: {
      id: true, codigo_socio: true, cedula: true, nombre: true, apellido: true, sexo: true,
      fecha_nacimiento: true, telefono: true, email: true, direccion: true, estado: true, fecha_inscripcion: true,
    },
  });

  const grupos = new Map<string, SocioBase[]>();
  for (const s of socios) grupos.set(s.cedula, [...(grupos.get(s.cedula) ?? []), s]);

  const pendientes: Pendiente[] = [];
  let personasNuevas = 0;
  let vinculados = 0;

  for (const [cedula, grupo] of grupos) {
    if (!validarCedula(cedula).valida) {
      pendientes.push({ motivo: 'cedula_invalida', cedula, expedientes: grupo.map(resumir), detalle: validarCedula(cedula).error });
      continue;
    }

    const base = masRepresentativo(grupo);
    if (!grupo.every((s) => pareceLaMismaPersona(s, base))) {
      pendientes.push({ motivo: 'nombres_distintos', cedula, expedientes: grupo.map(resumir) });
      continue;
    }

    const existente = await prisma.persona.findUnique({ where: { numero_identificacion: cedula } });
    if (existente && !pareceLaMismaPersona({ nombre: existente.nombres, apellido: existente.apellidos }, base)) {
      pendientes.push({
        motivo: 'distinto_de_persona_existente',
        cedula,
        expedientes: grupo.map(resumir),
        detalle: `La persona ${existente.id} se llama ${existente.nombres} ${existente.apellidos}`,
      });
      continue;
    }

    if (!existente) personasNuevas++;
    vinculados += grupo.length;

    if (aplicar) {
      await prisma.$transaction(async (tx) => {
        const persona =
          existente ??
          (await tx.persona.create({
            data: {
              numero_identificacion: cedula,
              nombres: base.nombre,
              apellidos: base.apellido,
              sexo: base.sexo,
              fecha_nacimiento: base.fecha_nacimiento,
              telefono: base.telefono,
              email: base.email,
              direccion: base.direccion,
            },
          }));
        await tx.socio.updateMany({ where: { id: { in: grupo.map((s) => s.id) }, persona_id: null }, data: { persona_id: persona.id } });
      });
    }
  }

  const porMotivo = pendientes.reduce<Record<string, number>>((a, p) => ({ ...a, [p.motivo]: (a[p.motivo] ?? 0) + 1 }), {});

  const dir = path.join(__dirname, '..', 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const reporte = path.join(dir, `backfill-personas-${new Date().toISOString().slice(0, 10)}${aplicar ? '' : '-simulacion'}.json`);
  fs.writeFileSync(reporte, JSON.stringify({ aplicado: aplicar, socios_sin_persona: socios.length, cedulas: grupos.size, personas_nuevas: personasNuevas, expedientes_vinculados: vinculados, pendientes_por_motivo: porMotivo, pendientes }, null, 2));

  console.log(`Socios sin persona:          ${socios.length} (${grupos.size} cédulas)`);
  console.log(`Personas ${aplicar ? 'creadas' : 'a crear'}:        ${personasNuevas}`);
  console.log(`Expedientes ${aplicar ? 'vinculados' : 'a vincular'}:   ${vinculados}`);
  console.log(`Cédulas para revisión:       ${pendientes.length} ${JSON.stringify(porMotivo)}`);
  console.log(`Reporte: ${reporte}`);
  if (!aplicar) console.log('\nNada se modificó. Vuelva a correr con --aplicar para hacerlo.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
