import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Routers
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';
import parametrosRouter from './routes/parametros';
import ubicacionesRouter from './routes/ubicaciones';
import tiposCuentaRouter from './routes/tiposCuenta';
import tiposPrestamoRouter from './routes/tiposPrestamo';
import reportesRouter from './routes/reportes';
import semanasColectaRouter from './routes/semanasColecta';
import impresionRouter from './routes/impresion';
import sociosRouter from './routes/socios';
import asambleasRouter from './routes/asambleas';
import colectaRouter from './routes/colecta';
import prestamosRouter from './routes/prestamos';
import { iniciarSincronizacionAutomatica } from './services/tasaCambioService';
import ahorroRouter from './routes/ahorro';
import funerariaRouter from './routes/funeraria';
import saludRouter from './routes/salud';
import { iniciarJobSemanalSalud } from './jobs/saludSuspension';
import { sembrarParametrosColecta } from './services/tarifasService';
import { mantenerCalendario } from './services/semanasColectaService';
import { iniciarJobCalendarioColecta } from './jobs/calendarioColecta';

const app: Application = express();

// ============================================
// PROXY
// ============================================
//
// En produccion nginx hace de proxy y pasa la IP real en `X-Forwarded-For`.
// Sin esto Express ve siempre 127.0.0.1, y el rate limit cuenta a TODOS los
// cajeros como una sola IP: los 100 req/15min quedan compartidos por toda la
// oficina y un dia movido los bloquea a todos a la vez.
//
// El valor es 1 (un unico proxy delante), no `true`: confiar en toda la cadena
// permitiria a cualquiera falsear su IP mandando su propio X-Forwarded-For.
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARE DE SEGURIDAD
// ============================================
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 requests por ventana
  message: 'Demasiadas peticiones desde esta IP, intente de nuevo más tarde',
});
app.use('/api/', limiter);

// ============================================
// MIDDLEWARE DE PARSEO
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============================================
// LOGGER DE REQUESTS
// ============================================
app.use((req: Request, _res: Response, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// ============================================
// API ROUTES
// ============================================
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'API Cooperativa el Triunfo',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      dashboard: '/api/dashboard',
      parametros: '/api/parametros',
      ubicaciones: '/api/ubicaciones',
      tipos_cuenta: '/api/tipos-cuenta',
      tipos_prestamo: '/api/tipos-prestamo',
      semanas_colecta: '/api/semanas-colecta',
      reportes: '/api/reportes',
      impresion: '/api/impresion',
      socios: '/api/socios',
      ahorro: '/api/ahorro',
      funeraria: '/api/funeraria',
      salud: '/api/salud',
      prestamos: '/api/prestamos',
      colecta: '/api/colecta',
    },
  });
});

// Rutas de API
app.use('/api/dashboard', dashboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/parametros', parametrosRouter);
app.use('/api/ubicaciones', ubicacionesRouter);
app.use('/api/tipos-cuenta', tiposCuentaRouter);
app.use('/api/tipos-prestamo', tiposPrestamoRouter);
app.use('/api/semanas-colecta', semanasColectaRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/impresion', impresionRouter);
app.use('/api/socios', sociosRouter);
app.use('/api/ahorro', ahorroRouter);
app.use('/api/funeraria', funerariaRouter);
app.use('/api/salud', saludRouter);
app.use('/api/asambleas', asambleasRouter);
app.use('/api/colecta', colectaRouter);
app.use('/api/prestamos', prestamosRouter);

// ============================================
// 404 HANDLER
// ============================================
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Ruta no encontrada',
    },
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================
const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`🚀 Servidor iniciado en puerto ${PORT}`);
  logger.info(`📝 Ambiente: ${config.nodeEnv}`);
  logger.info(`🌐 CORS habilitado para: ${config.corsOrigin}`);

  iniciarJobSemanalSalud();
  // Tasa BCV al día sin intervención. Se puede desactivar con
  // SINCRONIZAR_TASA=false si se prefiere cargarla a mano.
  if (process.env.SINCRONIZAR_TASA !== 'false') {
    iniciarSincronizacionAutomatica(Number(process.env.TASA_INTERVALO_HORAS ?? 6));
  }

  // El calendario de colecta se mantiene solo: las semanas del año siguiente
  // se crean con meses de antelación, así que en diciembre ya están y nadie
  // tiene que llamar al proveedor para poder seguir cobrando.
  void sembrarParametrosColecta();
  void mantenerCalendario();
  iniciarJobCalendarioColecta();
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
