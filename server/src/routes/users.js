// server/src/routes/users.js
import express from 'express';
import mongoose from 'mongoose';
import {
  getUsers,
  createUser,
  deleteUser,
  updateUserRole,
  updateUserPassword,
  toggleUserLock,
  updateUserData,
  setVacationTotal,
  addVacationDays,
  setVacationUsed,
  // setVacationAvailable, // ← habilita si quieres editar "disponibles" directo
} from '../controllers/userController.js';

import { authenticate } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';

// Opcional: wrapper para completar email si el front solo envía { name }
import User from '../models/User.js';

const router = express.Router();

/* =============================
   Helpers
   ============================= */

// Todas estas rutas requieren admin
const adminOnly = [authenticate, adminMiddleware];

// Valida que :id sea un ObjectId válido
const validateId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'ID inválido' });
  }
  next();
};

/* =============================
   Usuarios
   ============================= */

// GET /api/users
router.get(
  '/',
  ...adminOnly,
  (req, res, next) => {
    // Evita cache en listados de admin
    res.set('Cache-Control', 'no-store');
    next();
  },
  getUsers
);

// POST /api/users  -> crear usuario
router.post('/', ...adminOnly, createUser);

// DELETE /api/users/:id
router.delete('/:id', ...adminOnly, validateId, deleteUser);

// PATCH /api/users/:id/role
router.patch('/:id/role', ...adminOnly, validateId, updateUserRole);

// PATCH /api/users/:id/password
router.patch('/:id/password', ...adminOnly, validateId, updateUserPassword);

// PATCH /api/users/:id/lock
router.patch('/:id/lock', ...adminOnly, validateId, toggleUserLock);

/**
 * PATCH /api/users/:id/name
 * El controller updateUserData permite { name?, email? }.
 * Si el front solo manda { name }, aquí completamos el email actual del usuario.
 */
router.patch('/:id/name', ...adminOnly, validateId, async (req, res, next) => {
  try {
    if (!req.body?.email) {
      const u = await User.findById(req.params.id).select('email').lean();
      if (!u) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }
      req.body.email = u.email;
    }
    return updateUserData(req, res);
  } catch (err) {
    next(err);
  }
});

/* =============================
   Vacaciones
   ============================= */

// PATCH /api/users/:id/vacation/total  { total }
router.patch('/:id/vacation/total', ...adminOnly, validateId, setVacationTotal);

// POST /api/users/:id/vacation/add    { days }
router.post('/:id/vacation/add', ...adminOnly, validateId, addVacationDays);

// PATCH /api/users/:id/vacation/used  { used }
router.patch('/:id/vacation/used', ...adminOnly, validateId, setVacationUsed);

// (OPCIONAL) PATCH /api/users/:id/vacation/available { available }
// router.patch('/:id/vacation/available', ...adminOnly, validateId, setVacationAvailable);

export default router;
