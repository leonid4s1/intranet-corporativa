// server/src/routes/auth.js
import express from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  resendVerificationEmail,
  verifyEmail
} from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  validateRegister,
  validateLogin,
  // ⬇️ quitamos validateRefreshToken porque el refresh usa cookie httpOnly
  // validateRefreshToken
  validateResendVerification
} from '../middleware/validation.js';
import mongoose from 'mongoose';

const router = express.Router();

/* ===================== Auth públicas ===================== */

// Registro
router.post('/register', validateRegister, register);

// Login
router.post('/login', validateLogin, login);

// Verificación de email (GET para enlace en correo)
router.get('/verify-email/:token', verifyEmail);

/**
 * Refresh Token
 * - Nuevo endpoint preferido:  POST /auth/refresh
 * - Alias de compatibilidad:  POST /auth/refresh-token
 *   (ambos leen la cookie httpOnly 'refreshToken'; no se requiere body)
 */
router.post('/refresh', refreshToken);
router.post('/refresh-token', refreshToken);

// Logout (protegido)
router.post('/logout', authenticate, logout);

// Reenviar verificación
router.post('/resend-verification', validateResendVerification, resendVerificationEmail);

/* ===================== Rutas protegidas ===================== */

// Perfil simple de ejemplo (mantengo el shape actual)
router.get('/profile', authenticate, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      isActive: req.user.isActive,
      isVerified: req.user.isVerified
    }
  });
});

// Solo admin
router.get('/admin', authenticate, authorize(['admin']), (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenido administrador',
    user: req.user.profile
  });
});

/* ===================== Healthcheck ===================== */

router.get('/healthcheck', (_req, res) => {
  const health = {
    status: 'OK',
    message: 'El servicio de autenticacion esta funcionando',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  res.status(200).json(health);
});

export default router;
