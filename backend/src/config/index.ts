import 'dotenv/config';

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptSaltRounds: number;
  corsOrigin: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-this',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};

// Validar variables críticas
if (!process.env.DATABASE_URL && config.nodeEnv === 'production') {
  throw new Error('DATABASE_URL es requerida en producción');
}

if (config.jwtSecret === 'default-secret-change-this' && config.nodeEnv === 'production') {
  throw new Error('JWT_SECRET debe ser configurado en producción');
}
