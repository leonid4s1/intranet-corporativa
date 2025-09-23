// server/src/index.js
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import morgan from 'morgan'
import { connectDB } from './config/db.js'
import errorHandler from './middleware/errorHandler.js'
import authRoutes from './routes/auth.js'
import newsRoutes from './routes/news.js'
import tasksRoutes from './routes/tasks.js'
import userRoutes from './routes/users.js'
import vacationRoutes from './routes/vacations.js'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const app = express()

/** Detrás de proxies (Render/Vercel) para que cookies `secure` funcionen */
app.set('trust proxy', 1)

/** Cookies NO firmadas (controlamos firma/validación con JWT en el valor) */
app.use(cookieParser()) // ⬅️ sin secreto

/* ====================== CORS (ANTES DE HELMET) ====================== */
const allowedList = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const originRegex = process.env.CORS_ORIGIN_REGEX
  ? new RegExp(process.env.CORS_ORIGIN_REGEX)
  : null

const allowedLower = allowedList.map((o) => o.toLowerCase())
const CORS_DEBUG = process.env.CORS_DEBUG === 'true'

const corsOptions = {
  origin(origin, cb) {
    // Permitir curl/Postman/SSR (sin cabecera Origin)
    if (!origin) {
      CORS_DEBUG && console.log('[CORS] sin Origin -> OK')
      return cb(null, true)
    }

    const low = origin.toLowerCase()

    // 1) Vercel (subdominios variables por preview/prod)
    if (low.endsWith('.vercel.app')) {
      CORS_DEBUG && console.log('[CORS] vercel match:', origin)
      return cb(null, true)
    }

    // 2) Whitelist exacta
    if (allowedLower.includes(low)) {
      CORS_DEBUG && console.log('[CORS] whitelist match:', origin)
      return cb(null, true)
    }

    // 3) Regex opcional
    if (originRegex && originRegex.test(low)) {
      CORS_DEBUG && console.log('[CORS] regex match:', origin)
      return cb(null, true)
    }

    console.warn(
      '[CORS] NO permitido:',
      origin,
      '| allowed:',
      allowedList.join(', ') || '(vacío)',
      '| regex:',
      originRegex ? originRegex.source : 'N/A'
    )
    return cb(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // ⬇️ Añadimos los headers que causaban el preflight bloqueado
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
    'Expires',
  ],
  optionsSuccessStatus: 204,
  preflightContinue: false,
  maxAge: 86400, // cachea el preflight 24h cuando sea posible
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions)) // preflight global

// Evita problemas de cache/CDN con CORS
app.use((req, res, next) => {
  res.header('V vary', 'Origin') // mantiene Vary: Origin para caches intermedios
  res.header('Vary', 'Origin')   // (deja ambas líneas por si algún proxy es estricto)
  next()
})
/* ==================================================================== */

/** Helmet (después de CORS) */
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
)

// Logs
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'))

// Body parser
app.use(express.json({ limit: '10kb' }))

/** Health */
app.get('/api/health', async (_req, res) => {
  const status = {
    ok: true,
    dbStatus:
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ts: Date.now(),
    env: process.env.NODE_ENV || 'development',
  }
  res.json(status)
})

/** DB */
connectDB()
mongoose.connection.on('connected', () => console.log('✅ Conectado a MongoDB'))
mongoose.connection.on('error', (err) => console.error('❌ Error MongoDB:', err))

/** Rutas API */
app.use('/api/auth', authRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/users', userRoutes)
app.use('/api/vacations', vacationRoutes)

/**
 * (Opcional) Servir frontend build local sólo si quieres monolito.
 * Para Render + Vercel, déjalo apagado (SERVE_STATIC != 'true').
 * Carpeta: `cliente/dist`
 */
if (process.env.SERVE_STATIC === 'true') {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  app.use(express.static(path.join(__dirname, '../../cliente/dist')))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../cliente/dist/index.html'))
  })
}

/** Errores (al final) */
app.use(errorHandler)

/** Listen */
const port = process.env.PORT || 3000
const server = app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en modo ${process.env.NODE_ENV || 'development'}`)
  console.log(`📡 URL: http://localhost:${port}`)
  console.log(
    `🌍 CORS whitelist: ${allowedList.join(', ') || '(vacío)'} | regex: ${
      originRegex ? originRegex.source : 'N/A'
    }`
  )
})

process.on('unhandledRejection', (err) => {
  console.error('⚠️ Error no capturado:', err)
  server.close(() => process.exit(1))
})

export default app
