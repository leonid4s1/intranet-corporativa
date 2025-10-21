// server/src/middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { body, validationResult } from 'express-validator';

/* =========================
 *  AUTHENTICATE (JWT guard)
 * ========================= */
export const authenticate = async (req, res, next) => {
  try {
    const header = req.header('Authorization') || req.header('authorization') || '';
    const parts = header.split(' ');
    const isBearer = parts.length === 2 && parts[0].toLowerCase() === 'bearer';
    const token = isBearer ? parts[1] : null;

    if (!token) return res.status(401).json({ error: 'Acceso no autorizado' });

    if (!process.env.JWT_SECRET) {
      console.error('[AUTH] JWT_SECRET ausente en variables de entorno');
      return res.status(500).json({ error: 'Configuración de autenticación incompleta' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expirado' });
      return res.status(401).json({ error: 'Token inválido' });
    }

    const user = await User.findById(decoded.userId).select('role isActive name email');
    if (!user) return res.status(401).json({ error: 'Usuario no autorizado' });

    if (!user.isActive) return res.status(403).json({ error: 'Cuenta inactiva' });

    req.user = user; // {_id, role, isActive, name, email}
    next();
  } catch (error) {
    console.error('[AUTH] Error inesperado en authenticate:', error);
    return res.status(401).json({ error: 'No autorizado' });
  }
};

/* =========================
 *  AUTHORIZE (role guard)
 * ========================= */
export const authorize = (roles = []) => {
  const list = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (list.length && !list.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Acceso prohibido' });
    }
    next();
  };
};

/* =========================
 *  VALIDACIONES BÁSICAS
 * ========================= */
export const validateRegister = [
  body('name')
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .trim()
    .escape(),
  body('email').isEmail().withMessage('Email invalido').normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/(?=.*[a-z])/).withMessage('Debe contener al menos una letra minúscula')
    .matches(/(?=.*[A-Z])/).withMessage('Debe contener al menos una letra mayúscula')
    .matches(/(?=.*\d)/).withMessage('Debe contener al menos un número')
    .matches(/(?=.*[\W_])/).withMessage('Debe contener al menos un carácter especial'),
  body('password_confirmation')
    .custom((value, { req }) => {
      if (value !== req.body.password) throw new Error('Las contraseñas no coinciden');
      return true;
    }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

export const validateLogin = [
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').notEmpty().withMessage('Contraseña es requerida'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

export default authenticate;