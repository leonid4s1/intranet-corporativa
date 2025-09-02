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
  validateResendVerification,
  validateRefreshToken
} from '../middleware/validation.js';
import mongoose from 'mongoose';

const router = express.Router();

// Ruta de registro con validaciones
router.post('/register',
  validateRegister, 
  register
);

// Ruta de login con validaciones
router.post('/login',
  validateLogin,
  login
);

// Ruta para verificación de email (GET para enlace en correo)
router.get('/verify-email/:token',
  verifyEmail
);

// Ruta para refrescar token
router.post('/refresh-token',
  validateRefreshToken,
  refreshToken
);

// Ruta de logout (protegida)
router.post('/logout',
  authenticate,
  logout
);

// Ruta protegida de ejemplo
router.get('/profile',
  authenticate,
  (req, res) => {
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
  }
);

// Ruta solo para admin
router.get('/admin',
  authenticate,
  authorize(['admin']),
  (req, res) => {
    res.json({
      success: true,
      message: 'Bienvenido administrador',
      user: req.user.profile
    });
  }
);

// Health Check mejorado
router.get('/healthcheck',
  (req, res) => {
    const health = {
      status: 'OK',
      message: 'El servicio de autenticacion esta funcionando',
      timestamp: new Date(),
      uptime: process.uptime(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    };
    res.status(200).json(health);
  }
);

//resend-verification
router.post('/resend-verification',
  validateResendVerification,
  resendVerificationEmail
);

export default router;