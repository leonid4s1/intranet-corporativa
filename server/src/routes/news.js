// server/src/routes/news.js - ACTUALIZADO
import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import auth from '../middleware/auth.js'
import admin from '../middleware/admin.js'

import {
  getHomeNews,             // feed para el carrusel/home
  createAnnouncement,      // crear comunicado (con imagen)
  listAnnouncements        // listar comunicados (admin)
} from '../controllers/newsController.js'

import News from '../models/News.js' // rutas legacy existentes

const router = Router()

/* =========================
 * Subida de imágenes (multer)
 * ========================= */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Carpeta física: server/uploads  (ojo: este archivo vive en server/src/routes)
    cb(null, path.join(process.cwd(), 'server/uploads'))
  },
  filename: (_req, file, cb) => {
    const safeBase = file.originalname.replace(/[^\w.-]+/g, '_')
    const ts = Date.now()
    cb(null, `${ts}_${safeBase}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

/* =========================
 * HOME FEED
 * ========================= */
router.get('/home', auth, getHomeNews)

/* =========================
 * ADMIN: Comunicados
 * ========================= */
// Crear comunicado (con imagen opcional)
router.post('/announcements', auth, admin, upload.single('image'), createAnnouncement)

// Listar comunicados (vigentes por defecto; ?all=true para todos)
router.get('/announcements', auth, admin, listAnnouncements)

/* =========================
 * Rutas legacy existentes
 * ========================= */
// Obtener todas las noticias
router.get('/', async (_req, res) => {
  try {
    const newsList = await News.find().sort({ date: -1 })
    res.json(newsList)
  } catch (error) {
    console.error('Error al obtener noticias:', error)
    res.status(500).json({ error: 'Error al obtener noticias' })
  }
})

// Crear noticia simple (JSON, sin imagen)
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
