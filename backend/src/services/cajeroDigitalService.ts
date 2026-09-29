// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Cajero digital: el acceso del socio
// ============================================
//
// Confirmado por la cooperativa:
//
//   "El socio accede con usuario y clave creada aparte, solo del socio, es
//    decir como un usuario externo que al ingresar solo accede a un formulario
//    que llena con datos del pago... El cajero digital la gente lo paga desde
//    el celular."
//
// Tres decisiones que valen la pena explicar, porque esto lo usan personas
// desde fuera de la oficina:
//
// 1. Las credenciales son SEPARADAS de las del personal. Un socio no debe poder
//    entrar al administrativo ni al reves, asi que el token lleva un `tipo` y
//    los dos middlewares comprueban el suyo. Un token de socio presentado al
//    administrativo no vale, aunque el secreto de firma sea el mismo.
//
// 2. El registro se verifica contra los datos que la cooperativa YA tiene:
//    expediente, cedula y telefono tienen que coincidir con el socio. Es lo
//    mismo que hace el cajero digital actual, y evita que alguien abra acceso
//    a la cuenta de otro sabiendo solo su numero de socio.
//
// 3. Un socio retirado no puede registrarse ni entrar.

import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { BadRequestError, ConflictError, UnauthorizedError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { revisarCedula } from '../utils/personas';

/** Marca que distingue el token del socio del token del personal */
export const TIPO_TOKEN_SOCIO = 'socio';

export interface SesionSocio {
  token: string;
  socio: {
    usuario_digital_id: number;
    socio_id: number;
    codigo_socio: string;
    nombre: string;
    apellido: string;
  };
}

/** Solo digitos, para comparar telefonos escritos de cualquier manera */
const soloDigitos = (texto: string): string => texto.replace(/\D/g, '');

const emitirToken = (usuarioDigitalId: number, socioId: number): string =>
  jwt.sign(
    { usuarioDigitalId, socioId, tipo: TIPO_TOKEN_SOCIO },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as SignOptions
  );

const datosDeSesion = (
  usuarioDigitalId: number,
  socio: { id: number; codigo_socio: string; nombre: string; apellido: string }
): SesionSocio['socio'] => ({
  usuario_digital_id: usuarioDigitalId,
  socio_id: socio.id,
  codigo_socio: socio.codigo_socio,
  nombre: socio.nombre,
  apellido: socio.apellido,
});

/**
 * Alta del socio en el cajero digital.
 *
 * Se comprueba contra lo que la cooperativa ya tiene: el expediente, la cedula
 * y el telefono tienen que ser los del socio. Los mensajes de error no dicen
 * cual de los tres fallo, para no convertir esto en una forma de averiguar
 * datos de otros socios.
 */
export const registrarSocio = async (datos: {
  codigo_socio: string;
  cedula: string;
  telefono: string;
  clave: string;
}): Promise<SesionSocio> => {
  if (datos.clave.length < 8) {
    throw new BadRequestError('La clave debe tener al menos 8 caracteres');
  }

  const { cedula, error } = revisarCedula(datos.cedula);
  if (error) throw new BadRequestError(error);

  const socio = await prisma.socio.findUnique({
    where: { codigo_socio: datos.codigo_socio.trim() },
    select: {
      id: true,
      codigo_socio: true,
      cedula: true,
      nombre: true,
      apellido: true,
      telefono: true,
      estado: true,
      usuario_digital: { select: { id: true } },
    },
  });

  // Un solo mensaje para los tres fallos: si dijera cual no coincide, esto
  // serviria para averiguar la cedula o el telefono de cualquier socio
  const noCuadra = () =>
    new BadRequestError('Los datos no coinciden con los que tenemos registrados');

  if (!socio) throw noCuadra();
  if (socio.cedula !== cedula) throw noCuadra();

  const telefonoSocio = soloDigitos(socio.telefono ?? '');
  const telefonoDado = soloDigitos(datos.telefono);
  // El socio puede tener dos numeros anotados en el mismo campo, asi que basta
  // con que el que da aparezca entre ellos
  if (telefonoDado.length < 7 || !telefonoSocio.includes(telefonoDado)) throw noCuadra();

  if (socio.estado === 'retirado') {
    throw new BadRequestError('El expediente está retirado. Acérquese a la oficina.');
  }
  if (socio.usuario_digital) {
    throw new ConflictError('Este expediente ya tiene acceso. Use "olvidé mi clave".');
  }

  const usuario = await prisma.usuarioDigital.create({
    data: {
      socio_id: socio.id,
      username: socio.codigo_socio,
      password_hash: await bcrypt.hash(datos.clave, config.bcryptSaltRounds),
      telefono: datos.telefono.trim(),
    },
    select: { id: true },
  });

  logger.info(`Cajero digital: alta del socio ${socio.codigo_socio}`);
  return { token: emitirToken(usuario.id, socio.id), socio: datosDeSesion(usuario.id, socio) };
};

/** Entrada del socio. Se identifica con su expediente. */
export const accederSocio = async (datos: {
  codigo_socio: string;
  clave: string;
}): Promise<SesionSocio> => {
  const usuario = await prisma.usuarioDigital.findUnique({
    where: { username: datos.codigo_socio.trim() },
    select: {
      id: true,
      password_hash: true,
      estado: true,
      socio: { select: { id: true, codigo_socio: true, nombre: true, apellido: true, estado: true } },
    },
  });

  // Mismo mensaje exista o no el usuario: no se confirma quien tiene acceso
  const invalidas = () => new UnauthorizedError('Expediente o clave incorrectos');

  if (!usuario) {
    // Se compara igual contra un hash ficticio para que fallar por usuario
    // inexistente tarde lo mismo que fallar por clave: si no, el tiempo de
    // respuesta delata que expedientes tienen acceso
    await bcrypt.compare(datos.clave, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid');
    throw invalidas();
  }

  if (!(await bcrypt.compare(datos.clave, usuario.password_hash))) throw invalidas();
  if (!usuario.estado) throw new UnauthorizedError('Su acceso está desactivado');
  if (usuario.socio.estado === 'retirado') {
    throw new UnauthorizedError('El expediente está retirado. Acérquese a la oficina.');
  }

  await prisma.usuarioDigital.update({
    where: { id: usuario.id },
    data: { ultimo_acceso: new Date() },
  });

  return {
    token: emitirToken(usuario.id, usuario.socio.id),
    socio: datosDeSesion(usuario.id, usuario.socio),
  };
};

/** Comprueba un token de SOCIO. Rechaza los del personal. */
export const verificarTokenSocio = async (
  token: string
): Promise<{ usuarioDigitalId: number; socioId: number }> => {
  let decodificado: { usuarioDigitalId?: number; socioId?: number; tipo?: string };
  try {
    decodificado = jwt.verify(token, config.jwtSecret) as typeof decodificado;
  } catch {
    throw new UnauthorizedError('Sesión inválida o vencida');
  }

  // El secreto de firma es el mismo, asi que lo que separa los dos mundos es
  // esta comprobacion: sin ella, un token del personal valdria aqui
  if (decodificado.tipo !== TIPO_TOKEN_SOCIO || !decodificado.usuarioDigitalId) {
    throw new UnauthorizedError('Sesión inválida');
  }

  const usuario = await prisma.usuarioDigital.findUnique({
    where: { id: decodificado.usuarioDigitalId },
    select: { id: true, socio_id: true, estado: true, socio: { select: { estado: true } } },
  });

  if (!usuario || !usuario.estado || usuario.socio.estado === 'retirado') {
    throw new UnauthorizedError('Su acceso ya no está disponible');
  }

  return { usuarioDigitalId: usuario.id, socioId: usuario.socio_id };
};
