// server/src/index.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB } from './config/db.js';
import errorHandler from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import newsRoutes from './routes/news.js';
import tasksRoutes from './routes/tasks.js';
import userRoutes from './routes/users.js';
import vacationRoutes from './routes/vacations.js';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();

/** Detrás de proxies (Render/Vercel) para que cookies `secure` funcionen */
app.set('trust proxy', 1);

/** Cookies firmadas */
app.use(cookieParser(process.env.COOKIE_SECRET));

/* ============================================================================
   C O R S  (debe ir antes de helmet)
   - ALLOWED_ORIGINS: lista blanca separada por comas.
   - CORS_ORIGIN_REGEX: opcional (regex como string, ej: ^https://.*mi-dominio\.com$).
   - VERCEL_PROJECT_HINT: opcional; si lo pones, solo aceptará previews cuyo
     hostname incluya ese identificador (p.ej. "leonardos-projects-cbfe09bc").
   - CORS_DEBUG=true para log de decisiones.
============================================================================ */
const allowedList = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const originRegex = process.env.CORS_ORIGIN_REGEX
  ? new RegExp(process.env.CORS_ORIGIN_REGEX)
  : null;

const projectHint = process.env.VERCEL_PROJECT_HINT || ''; // ej: "leonardos-projects-cbfe09bc"
const CORS_DEBUG = process.env.CORS_DEBUG === 'true';

const vercelPreviewOk = (origin) => {
  if (!origin) return false;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:') return false;
    if (!hostname.endsWith('.vercel.app')) return false;
    // Si hay hint, exigir que el hostname lo contenga
    if (projectHint && !hostname.includes(projectHint)) return false;
    return true;
  } catch {
    return false;
  }
};

const allowedLower = allowedList.map(o => o.toLowerCase());

const corsOptions = {
  origin(origin, cb) {
    // Permite curl/Postman/SSR (sin cabecera Origin)
    if (!origin) {
      CORS_DEBUG && console.log('[CORS] sin Origin -> OK');
      return cb(null, true);
    }

    const low = origin.toLowerCase();

    // 1) Previews de Vercel (acota por hint si se configuró)
    if (vercelPreviewOk(origin)) {
      CORS_DEBUG && console.log('[CORS] vercel preview OK:', origin);
      return cb(null, true);
    }

    // 2) Lista blanca exacta
    if (allowedLower.includes(low)) {
      CORS_DEBUG && console.log('[CORS] whitelist OK:', origin);
      return cb(null, true);
    }

    // 3) Regex opcional desde ENV
    if (originRegex && originRegex.test(low)) {
      CORS_DEBUG && console.log('[CORS] regex OK:', origin);
      return cb(null, true);
    }

    // No permitido
    console.warn(
      '[CORS] BLOQUEADO:',
      origin,
      '| whitelist:',
      allowedList.join(', ') || '(vacío)',
      '| regex:',
      originRegex ? originRegex.source : 'N/A',
      '| vercel-hint:',
      projectHint || '(no configurado)'
    );
    // Devolver false NO lanza 500; responde 200/204 al preflight sin exponer
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight global

// Evita problemas de cache/CDN con CORS
app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});
/* ========================================================================== */

/** Helmet (después de CORS) */
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10kb' }));

/** Health */
app.get('/api/health', async (_req, res) => {
  const status = {
    ok: true,
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ts: Date.now(),
    env: process.env.NODE_ENV || 'development',
  };
  res.json(status);
});

/** DB */
connectDB();
mongoose.connection.on('connected', () => console.log('✅ Conectado a MongoDB'));
mongoose.connection.on('error', (err) => console.error('❌ Error MongoDB:', err));

/** Rutas API */
app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vacations', vacationRoutes);

/**
 * (Opcional) Servir frontend build local sólo si quieres monolito.
 * Para Render + Vercel, déjalo apagado (SERVE_STATIC != 'true').
 * OJO: la carpeta correcta en tu repo es `cliente/dist`
 */
if (process.env.SERVE_STATIC === 'true') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  app.use(express.static(path.join(__dirname, '../../cliente/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../cliente/dist/index.html'));
  });
}

/** Errores (al final) */
app.use(errorHandler);

/** Listen */
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en modo ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 URL: http://localhost:${port}`);
  console.log(
    `🌍 CORS whitelist: ${allowedList.join(', ') || '(vacío)'} | regex: ${
      originRegex ? originRegex.source : 'N/A'
    } | vercel-hint: ${projectHint || '(no configurado)'}`
  );
});

process.on('unhandledRejection', (err) => {
  console.error('⚠️ Error no capturado:', err);
  server.close(() => process.exit(1));
});

export default app;
