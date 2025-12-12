// server/src/routes/news.js
import { Router } from 'express';
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
import { upload } from '../services/uploadService.js'; // 👈 servicio central de uploads

const router = Router();

/* =========================
 * HOME FEED (usuario)
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
  upload.single('image'),   // 👈 el campo del form debe llamarse 'image'
  createAnnouncement
);

// Listar comunicados para el admin
// ?all=true => todos, sin filtrar por ventana de visibilidad
router.get('/announcements', auth, admin, listAnnouncements);

// Actualizar comunicado existente (también puede cambiar imagen)
router.put(
  '/announcements/:id',
  auth,
  admin,
  upload.single('image'),   // 👈 permite reemplazar la imagen
  updateAnnouncement
);

// Eliminar comunicado
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
