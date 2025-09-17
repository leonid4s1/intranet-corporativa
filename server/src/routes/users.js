// server/src/routes/users.js
import express from 'express';
import {
  getUsers,
  createUser,            // 👈 NUEVO: exportado desde userController.js
  deleteUser,
  updateUserRole,
  updateUserPassword,
  toggleUserLock,
  updateUserData,
  setVacationTotal,
  addVacationDays,
  setVacationUsed,
  // setVacationAvailable, // 👈 opcional si quieres editar "disponibles" directo
} from '../controllers/userController.js';

import { authenticate } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';

// (Opcional) para el wrapper de /:id/name si no mandas email desde el front
import User from '../models/User.js';

const router = express.Router();

// Helper: todas requieren admin
const adminOnly = [authenticate, adminMiddleware];

// GET /api/users
router.get('/', ...adminOnly, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, getUsers);

// POST /api/users  -> crear usuario
router.post('/', ...adminOnly, createUser);

// DELETE /api/users/:id
router.delete('/:id', ...adminOnly, deleteUser);

// PATCH /api/users/:id/role
router.patch('/:id/role', ...adminOnly, updateUserRole);

// PATCH /api/users/:id/password
router.patch('/:id/password', ...adminOnly, updateUserPassword);

// PATCH /api/users/:id/lock
router.patch('/:id/lock', ...adminOnly, toggleUserLock);

/**
 * PATCH /api/users/:id/name
 * Tu controller updateUserData requiere { name, email }.
 * Si el front solo manda { name }, aquí completamos el email actual del usuario.
 */
router.patch('/:id/name', ...adminOnly, async (req, res, next) => {
  try {
    if (!req.body?.email) {
      const u = await User.findById(req.params.id).select('email').lean();
      if (!u) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      req.body.email = u.email;
    }
    return updateUserData(req, res);
  } catch (err) {
    next(err);
  }
});

/* =============================
   Vacaciones (días disponibles)
   ============================= */

// PATCH /api/users/:id/vacation/total
router.patch('/:id/vacation/total', ...adminOnly, setVacationTotal);

// POST /api/users/:id/vacation/add
router.post('/:id/vacation/add', ...adminOnly, addVacationDays);

// PATCH /api/users/:id/vacation/used
router.patch('/:id/vacation/used', ...adminOnly, setVacationUsed);

// (OPCIONAL) PATCH /api/users/:id/vacation/available
// router.patch('/:id/vacation/available', ...adminOnly, setVacationAvailable);

export default router;
