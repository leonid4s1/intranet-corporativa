// server/src/routes/news.js
import { Router } from 'express'
// OJO: usa la forma de export real de tu middleware.
// Si en middleware/auth.js exportas named => { auth }, si es default => auth
import { auth } from '../middleware/auth.js'
import admin from '../middleware/admin.js'

import {
  getHomeNews,
  createAnnouncement,
  listAnnouncements,
} from '../controllers/newsController.js'

import News from '../models/News.js'
import { upload } from '../services/uploadService.js' // ← usa el servicio central

const router = Router()

/* =========================
 * HOME FEED
 * ========================= */
router.get('/home', auth, getHomeNews)

/* =========================
 * ADMIN: Comunicados
 * ========================= */
router.post(
  '/announcements',
  auth,
  admin,
  upload.single('image'),   // ← campo DEBE ser 'image'
  createAnnouncement
)

router.get('/announcements', auth, admin, listAnnouncements)

/* =========================
 * Rutas legacy existentes
 * ========================= */
router.get('/', async (_req, res) => {
  try {
    const newsList = await News.find().sort({ date: -1 })
    res.json(newsList)
  } catch (error) {
    console.error('Error al obtener noticias:', error)
    res.status(500).json({ error: 'Error al obtener noticias' })
  }
})

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
