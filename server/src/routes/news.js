// server/src/routes/news.js
import express from 'express'
import { startOfDay, addDays, isBefore, isAfter } from 'date-fns'
import News from '../models/News.js'
import Holiday from '../models/Holiday.js'
import User from '../models/User.js'
import auth from '../middleware/auth.js'
import { sendBirthdayEmailsIfNeeded } from '../services/notificationService.js'

const router = express.Router()

/* =========================
 * Helpers
 * ========================= */
const toISO = (d) => new Date(d).toISOString()
const TZ = 'America/Mexico_City'
const mmddTZ = (date) => {
  const d = (typeof date === 'string' || typeof date === 'number') ? new Date(date) : date
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: '2-digit', day: '2-digit' })
    .format(d) // "MM-DD"
}
const nextOccurrence = (holidayDate, isRecurring) => {
  const base = new Date(holidayDate)
  const today = new Date()
  let occ = new Date(today.getFullYear(), base.getMonth(), base.getDate())
  if (!isRecurring) return occ
  // si ya pasó este año, usa el siguiente
  if (isAfter(startOfDay(today), startOfDay(occ))) {
    occ = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate())
  }
  return occ
}

/* =========================
 * GET /news/home  (feed Home)
 * - Noticias publicadas
 * - Aviso de feriados (T-2 a T-1, desaparece el día T)
 * - Felicitación de cumpleaños (solo hoy para el usuario)
 * - Digest de cumpleañeros + envío de correo (una vez por día)
 * ========================= */
router.get('/home', auth, async (req, res) => {
  try {
    const user = req.user
    const today = startOfDay(new Date())

    // 1) Noticias publicadas (estáticas)
    const published = await News.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    const items = (published || []).map((n) => ({
      id: String(n._id),
      type: 'static',
      title: n.title,
      body: n.body || '',
      visibleFrom: n.visibleFrom ? toISO(n.visibleFrom) : undefined,
      visibleUntil: n.visibleUntil ? toISO(n.visibleUntil) : undefined
    }))

    // 2) Aviso de feriado (T-2 a T-1; el día T no se muestra)
    const holidays = await Holiday.find({}).lean()
    for (const h of holidays) {
      const isRecurring = h.recurring === true || h.type === 'recurring'
      const occ = nextOccurrence(h.date, isRecurring)
      const startShow = addDays(occ, -2)
      const endHide = startOfDay(occ)

      if (isAfter(today, startOfDay(startShow)) && isBefore(today, endHide)) {
        items.unshift({
          id: `holiday-${h._id}`,
          type: 'holiday_notice',
          title: 'Nueva política de vacaciones',
          body: `Se acerca el feriado "${h.name}" el ${occ.toLocaleDateString()}. Planifica tus solicitudes con anticipación.`,
          visibleFrom: toISO(startShow),
          visibleUntil: toISO(endHide)
        })
      }
    }

    // 3) Cumple del usuario (solo hoy)
    if (user?.id) {
      const me = await User.findById(user.id).lean()
      if (me?.birthDate && mmddTZ(me.birthDate) === mmddTZ(today)) {
        const firstName = (me.name || '').split(' ')[0] || 'colaborador'
        items.unshift({
          id: `birthday-self-${me._id}-${mmddTZ(today)}`,
          type: 'birthday_self',
          title: `¡Feliz cumpleaños, ${firstName}!`,
          body: 'Te deseamos un día increíble. 🎉',
          visibleFrom: toISO(today),
          visibleUntil: toISO(addDays(today, 1))
        })
      }
    }

    // 4) Digest de cumpleañeros + correo a todos (una vez por día)
    let birthdayTodayUsers = await User.find(
      { birthDate: { $ne: null } },
      { name: 1, email: 1, birthDate: 1 }
    ).lean()

    birthdayTodayUsers = birthdayTodayUsers.filter((u) => mmddTZ(u.birthDate) === mmddTZ(today))

    if (birthdayTodayUsers.length > 0) {
      await sendBirthdayEmailsIfNeeded(today, birthdayTodayUsers) // idempotente por día

      const names = birthdayTodayUsers.map((u) => u.name || u.email).join(', ')
      items.unshift({
        id: `birthday-digest-${mmddTZ(today)}`,
        type: 'birthday_digest_info',
        title: 'Cumpleaños de hoy',
        body: `Hoy celebramos a: ${names}. ¡Felicítenl@s! 🎂`,
        visibleFrom: toISO(today),
        visibleUntil: toISO(addDays(today, 1))
      })
    }

    res.json({ items })
  } catch (err) {
    console.error('Error en /news/home:', err)
    res.status(500).json({ error: 'Error al construir el feed de noticias' })
  }
})

/* =========================
 * Rutas existentes
 * ========================= */

// Obtener todas las noticias
router.get('/', async (req, res) => {
  try {
    const newsList = await News.find().sort({ date: -1 })
    res.json(newsList)
  } catch (error) {
    console.error('Error al obtener noticias:', error)
    res.status(500).json({ error: 'Error al obtener noticias' })
  }
})

// Crear noticia nueva (opcional)
router.post('/', async (req, res) => {
  try {
    const newNews = new News(req.body)
    const saved = await newNews.save()
    res.status(201).json(saved)
  } catch (error) {
    console.error('Error al crear noticia:', error)
    res.status(500).json({ error: 'Error al crear noticia' })
  }
})

export default router
