// server/src/routes/auth.js
import express from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  resendVerificationEmail,
  verifyEmail,
  getProfile,
} from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  validateRegister,
  validateLogin,
  // validateRefreshToken, // (no se usa: refresh va por cookie HttpOnly)
  validateResendVerification,
} from '../middleware/validation.js';
import mongoose from 'mongoose';

const router = express.Router();

/* ===================== Rutas públicas ===================== */

// Login
router.post('/login', validateLogin, login);

// Verificación de email (GET para enlace en correo)
router.get(
  '/verify-email/:token',
  (req, res, next) => {
    // Evita cachear respuestas de verificación
    res.set('Cache-Control', 'no-store');
    next();
  },
  verifyEmail
);

/**
 * Refresh Token
 * - Preferido:  POST /auth/refresh
 * - Alias:      POST /auth/refresh-token
 * Ambos leen la cookie HttpOnly 'refreshToken' (no body).
 */
router.post('/refresh', refreshToken);
router.post('/refresh-token', refreshToken);

// Reenviar verificación
router.post('/resend-verification', validateResendVerification, resendVerificationEmail);

/* ===================== Rutas protegidas ===================== */

// Registro ➜ SOLO ADMIN
router.post('/register', authenticate, authorize(['admin']), validateRegister, register);

// Perfil (y alias /me para compatibilidad con el cliente)
router.get('/profile', authenticate, getProfile);
router.get('/me', authenticate, getProfile);

// Logout (protegido para limpiar refresh del usuario autenticado)
router.post('/logout', authenticate, logout);

// Solo admin (ejemplo)
router.get('/admin', authenticate, authorize(['admin']), (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenido administrador',
    user: req.user.profile, // definido como virtual en el modelo
  });
});

/* ===================== Healthcheck ===================== */

router.get('/healthcheck', (_req, res) => {
  const health = {
    status: 'OK',
    message: 'El servicio de autenticación está funcionando',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    env: process.env.NODE_ENV || 'development',
  };
  res.status(200).json(health);
});

export default router;
