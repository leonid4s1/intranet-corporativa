import express from 'express';
import {
  getUsers,
  deleteUser,
  updateUserRole,
  updateUserPassword,
  toggleUserLock,
  updateUserData
} from '../controllers/userController.js';

import { authenticate } from '../middleware/auth.js';      // middleware de autenticación
import { adminMiddleware } from '../middleware/admin.js';  // middleware para admin

const router = express.Router();

// Obtener todos los usuarios (solo admin)
router.get('/', authenticate, adminMiddleware, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();  
},
getUsers
);

// Eliminar usuario (solo admin)
router.delete('/:id', authenticate, adminMiddleware, deleteUser);

// Cambiar rol (solo admin)
router.patch('/:id/role', authenticate, adminMiddleware, updateUserRole);

// Cambiar contraseña (solo admin)
router.patch('/:id/password', authenticate, adminMiddleware, updateUserPassword);

// Bloquear/desbloquear usuario (solo admin)
router.patch('/:id/lock', authenticate, adminMiddleware, toggleUserLock);

// Editar nombre y email (solo admin)
router.patch('/:id/name', authenticate, adminMiddleware, updateUserData);

export default router;
