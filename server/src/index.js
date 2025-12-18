// server/src/index.js
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import fs from 'fs'                      // ✅ ADD
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
import { verifyEmailTransport } from './services/emailService.js'
import cron from 'node-cron'

// ⬇️ IMPORTS ACTUALIZADOS (correos de cumpleaños y festivos)
import {
  sendBirthdayEmailsIfDue,
  sendBirthdayDigestToAllIfDue,
  checkAllUpcomingHolidays,
} from './services/notificationService.js'

import schedule from 'node-schedule' // job de festivos

dotenv.config()

const app = express()

// === util de ruta absoluta para este archivo ===
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Detrás de proxies (Render/Vercel) para que cookies `secure` funcionen */
app.set('trust proxy', 1)
app.disable('x-powered-by')

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
    if (!origin) {
      CORS_DEBUG && console.log('[CORS] sin Origin -> OK')
      return cb(null, true)
    }

    const low = origin.toLowerCase()

    if (low.endsWith('.vercel.app')) {
      CORS_DEBUG && console.log('[CORS] vercel match:', origin)
      return cb(null, true)
    }

    if (allowedLower.includes(low)) {
      CORS_DEBUG && console.log('[CORS] whitelist match:', origin)
      return cb(null, true)
    }

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
  maxAge: 86400,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

app.use((req, res, next) => {
  res.header('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers')
  next()
})
/* ==================================================================== */

/** Helmet (después de CORS) — HSTS solo en prod */
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: process.env.NODE_ENV === 'production' ? undefined : false,
  })
)

// Logs
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'))

// Body parsers
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: false }))

// Compresión HTTP
app.use(compression())

/* ===== /uploads estático (ÚNICO y alineado con uploadService) ===== */
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/data/uploads'   // ✅ CHANGE (antes /tmp/uploads)
console.log('📂 UPLOAD_DIR estático:', UPLOAD_DIR)

// ✅ asegúrate que exista (por si disk está montado pero carpeta no creada)
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

app.use('/uploads', express.static(UPLOAD_DIR))

/** Health */
app.get('/api/health', async (_req, res) => {
  const status = {
    ok: true,
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ts: Date.now(),
    env: process.env.NODE_ENV || 'development',
  }
  res.json(status)
})

/** DB */
connectDB()
mongoose.connection.on('connected', () => console.log('✅ Conectado a MongoDB'))
mongoose.connection.on('error', (err) => console.error('❌ Error MongoDB:', err))

/** Verificar transporte de email al arrancar (logs claros) */
verifyEmailTransport().catch(() => {})

/** ==================== JOBS PROGRAMADOS ==================== */

/** Cron: correos de cumpleaños diario (08:00 MX por defecto) */
const CRON_ENABLED = process.env.CRON_ENABLED !== 'false'            // default: true
const CRON_SPEC    = process.env.CRON_BDAY_SPEC || '0 8 * * *'       // 08:00 todos los días
const CRON_TZ      = 'America/Mexico_City'

if (CRON_ENABLED) {
  cron.schedule(
    CRON_SPEC,
    async () => {
      try {
        console.log('[cron] Ejecutando correos de cumpleaños…')
        await Promise.all([
          sendBirthdayEmailsIfDue(),        // correo personal a cada cumpleañero
          sendBirthdayDigestToAllIfDue(),   // digest a toda la empresa
        ])
        console.log('[cron] Cumpleaños OK')
      } catch (err) {
        console.error('[cron] Error en correos de cumpleaños:', err)
      }
    },
    { timezone: CRON_TZ }
  )

  console.log(`[cron] Programado cumpleaños: "${CRON_SPEC}" TZ=${CRON_TZ}`)
}

/** Job: Verificación de festivos próximos (09:00 MX por defecto) */
const HOLIDAY_JOB_ENABLED = process.env.HOLIDAY_JOB_ENABLED !== 'false' // default: true
const HOLIDAY_JOB_SPEC    = process.env.HOLIDAY_JOB_SPEC || '0 9 * * *'  // 09:00 todos los días

const startHolidayNotificationJob = () => {
  if (HOLIDAY_JOB_ENABLED) {
    // Job programado diario
    schedule.scheduleJob(HOLIDAY_JOB_SPEC, async () => {
      try {
        console.log('🕘 [job] Ejecutando verificación diaria de festivos...')
        const notificationsSent = await checkAllUpcomingHolidays()
        console.log(`📨 [job] Verificación completada. Notificaciones enviadas: ${notificationsSent}`)
      } catch (error) {
        console.error('❌ [job] Error en verificación de festivos:', error)
      }
    })

    // Ejecutar inmediatamente al iniciar (útil en pruebas)
    setTimeout(async () => {
      try {
        console.log('🚀 [job] Verificación inicial de festivos al iniciar...')
        const notificationsSent = await checkAllUpcomingHolidays()
        console.log(`📨 [job] Verificación inicial completada. Notificaciones enviadas: ${notificationsSent}`)
      } catch (error) {
        console.error('❌ [job] Error en verificación inicial de festivos:', error)
      }
    }, 10000)

    console.log(`[job] Programada verificación de festivos: "${HOLIDAY_JOB_SPEC}"`)
  } else {
    console.log('[job] Verificación de festivos deshabilitada (HOLIDAY_JOB_ENABLED=false)')
  }
}

/** ==================== FIN JOBS PROGRAMADOS ==================== */

/** Rutas API */
app.use('/api/auth', authRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/users', userRoutes)
app.use('/api/vacations', vacationRoutes)

/** 404 para endpoints API no existentes (antes del error handler) */
app.use('/api/*', (_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint no encontrado' })
})

/**
 * (Opcional) Servir frontend build local sólo si quieres monolito.
 * Para Render + Vercel, déjalo apagado (SERVE_STATIC != 'true').
 */
if (process.env.SERVE_STATIC === 'true') {
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
  console.log(`🌐 PUBLIC_BASE_URL (para correos): ${process.env.PUBLIC_BASE_URL || '(no definido)'}`)

  // Iniciar job de festivos una vez que el server está listo
  startHolidayNotificationJob()
})

process.on('unhandledRejection', (err) => {
  console.error('⚠️ Error no capturado:', err)
  server.close(() => process.exit(1))
})

export default app
