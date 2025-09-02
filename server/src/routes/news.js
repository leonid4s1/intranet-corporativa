import express from 'express';
import News from '../models/News.js';

const router = express.Router();

// Obtener todas las noticias
router.get('/', async (req, res) => {
  try {
    const newsList = await News.find().sort({ date: -1 });
    res.json(newsList);
  } catch (error) {
    console.error('Error al obtener noticias:', error);
    res.status(500).json({ error: 'Error al obtener noticias' });
  }
});

// Crear noticia nueva (opcional)
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
