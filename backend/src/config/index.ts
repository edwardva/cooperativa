import 'dotenv/config';

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptSaltRounds: number;
  corsOrigin: string;
  exponerErrores: boolean;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-this',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  // Devolver la traza del error al cliente. Va aparte de NODE_ENV a proposito:
  // el servidor arranca con NODE_ENV=development —no se puede cambiar mientras
  // el sitio siga sin HTTPS, porque la cookie de sesion se marca Secure y el
  // navegador dejaria de enviarla—, asi que atar la traza a ese valor era
  // publicar las rutas internas del servidor en cada error. Hay que pedirla
  // explicitamente, y en produccion no se define.
  exponerErrores: process.env.EXPONER_ERRORES === 'true',
};

// Validar variables críticas
if (!process.env.DATABASE_URL && config.nodeEnv === 'production') {
  throw new Error('DATABASE_URL es requerida en producción');
}

if (config.jwtSecret === 'default-secret-change-this' && config.nodeEnv === 'production') {
  throw new Error('JWT_SECRET debe ser configurado en producción');
}
