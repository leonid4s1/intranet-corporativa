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
// 👇 NUEVO: importa el router de usuarios
import usersRoutes from './routes/users.js';

dotenv.config();
const app = express();

// Seguridad básica
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  })
);

// Logs y body parser
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10kb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Servidor funcionando',
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// DB
connectDB();

// Rutas principales
app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/tasks', tasksRoutes);
// 👇 NUEVO: monta /api/users (incluye setVacationTotal, addVacationDays, etc.)
app.use('/api/users', usersRoutes);

// 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.originalUrl}`
  });
});

// Manejo centralizado de errores (al final)
app.use(errorHandler);

// Start
const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en modo ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 URL: http://localhost:${port}`);
});

// Unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('⚠️ Error no capturado:', err);
  server.close(() => process.exit(1));
});
