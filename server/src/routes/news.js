// server/src/routes/news.js
import { Router } from 'express';
// OJO: usa la forma de export real de tu middleware.
// Si en middleware/auth.js exportas named => { auth }, si es default => auth
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';

import {
  getHomeNews,
  createAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
} from '../controllers/newsController.js';

import News from '../models/News.js';
import { upload } from '../services/uploadService.js'; // ← usa el servicio central

const router = Router();

/* =========================
 * HOME FEED
 * ========================= */
router.get('/home', auth, getHomeNews);

/* =========================
 * ADMIN: Comunicados (CRUD)
 * ========================= */

// Crear comunicado (con imagen opcional)
router.post(
  '/announcements',
  auth,
  admin,
  upload.single('image'), // ← campo DEBE ser 'image'
  createAnnouncement
);

// Listar comunicados para el admin
// Puedes usar query ?all=true para ver TODOS, o sin query para solo visibles
router.get('/announcements', auth, admin, listAnnouncements);

// Actualizar comunicado existente
router.put(
  '/announcements/:id',
  auth,
  admin,
  upload.single('image'), // también permite cambiar imagen
  updateAnnouncement
);

// Eliminar (quitar) comunicado
router.delete('/announcements/:id', auth, admin, deleteAnnouncement);

/* =========================
 * Rutas legacy existentes
 * ========================= */

// Listar todas las noticias "crudas" (legacy)
router.get('/', async (_req, res) => {
  try {
    const newsList = await News.find().sort({ date: -1 });
    res.json(newsList);
  } catch (error) {
    console.error('Error al obtener noticias:', error);
    res.status(500).json({ error: 'Error al obtener noticias' });
  }
});

// Crear noticia "cruda" (legacy)
router.post('/', async (req, res) => {
  try {
    const newNews = new News(req.body);
    const saved = await newNews.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error al crear noticia:', error);
    res.status(500).json({ error: 'Error al crear noticia' });
  }
});

export default router;
