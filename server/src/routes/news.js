// server/src/routes/news.js - VERSIÓN ACTUALIZADA
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
const mmdd = (date) => {
  const d = new Date(date)
  return `${d.getMonth() + 1}-${d.getDate()}`
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
 * ========================= */
router.get('/home', auth, async (req, res) => {
  try {
    const user = req.user
    const today = startOfDay(new Date())

    // 1) Noticias publicadas (estáticas) + NOTIFICACIONES DE FESTIVOS
    const published = await News.find({ 
      $or: [
        { status: 'published' },
        { type: 'holiday_notification', isActive: true } // ⬅️ INCLUIR NOTIFICACIONES DE FESTIVOS
      ]
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    const items = (published || []).map((n) => ({
      id: String(n._id),
      type: n.type || 'static', // ⬅️ RESPETAR EL TIPO
      title: n.title,
      body: n.body || '',
      excerpt: n.excerpt || '', // ⬅️ AGREGAR EXCERPT
      visibleFrom: n.visibleFrom ? toISO(n.visibleFrom) : undefined,
      visibleUntil: n.visibleUntil ? toISO(n.visibleUntil) : undefined
    }))

    console.log('[routes/news] Noticias desde BD:', items.map(i => ({ type: i.type, title: i.title })))

    // 2) Aviso de feriado (T-2 a T-1; el día T no se muestra) - SOLO SI NO EXISTE NOTIFICACIÓN
    const holidays = await Holiday.find({}).lean()
    for (const h of holidays) {
      const isRecurring = h.recurring === true || h.type === 'recurring'
      const occ = nextOccurrence(h.date, isRecurring)
      const startShow = addDays(occ, -2)
      const endHide = startOfDay(occ)

      // Verificar si ya existe una notificación para este festivo
      const existingHolidayNotification = items.find(item => 
        item.type === 'holiday_notice' || 
        (item.type === 'holiday_notification' && item.title.includes(h.name))
      )

      if (!existingHolidayNotification && isAfter(today, startOfDay(startShow)) && isBefore(today, endHide)) {
        items.unshift({
          id: `holiday-${h._id}`,
          type: 'holiday_notice',
          title: `Próximo día festivo: ${h.name}`, // ⬅️ TÍTULO MÁS DESCRIPTIVO
          body: `Se acerca ${h.name} el ${occ.toLocaleDateString('es-MX')}. Considera este descanso en tu planificación.`,
          visibleFrom: toISO(startShow),
          visibleUntil: toISO(endHide)
        })
      }
    }

    // 3) Cumple del usuario (solo hoy)
    if (user?.id) {
      const me = await User.findById(user.id).lean()
      if (me?.birthDate && mmdd(me.birthDate) === mmdd(today)) {
        const firstName = (me.name || '').split(' ')[0] || 'colaborador'
        items.unshift({
          id: `birthday-self-${me._id}-${mmdd(today)}`,
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

    birthdayTodayUsers = birthdayTodayUsers.filter((u) => mmdd(u.birthDate) === mmdd(today))

    if (birthdayTodayUsers.length > 0) {
      await sendBirthdayEmailsIfNeeded(today, birthdayTodayUsers)

      const names = birthdayTodayUsers.map((u) => u.name || u.email).join(', ')
      items.unshift({
        id: `birthday-digest-${mmdd(today)}`,
        type: 'birthday_digest_info',
        title: 'Cumpleaños de hoy',
        body: `Hoy celebramos a: ${names}. ¡Felicítenl@s! 🎂`,
        visibleFrom: toISO(today),
        visibleUntil: toISO(addDays(today, 1))
      })
    }

    console.log('[routes/news] Items finales:', items.length)
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

// Crear noticia nueva
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