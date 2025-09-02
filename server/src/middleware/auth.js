import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { body, validationResult } from 'express-validator';

// Middleware de autenticacion
export const authenticate = async (req, res, next) => {
  try {
    // Obtener token del header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Acceso no autorizado' });
    }

    //Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    //Buscar usuario
    const user = await User.findById(decoded.userId);
    if(!user || !user.isActive) {
      return res.status(401).json({ error: 'Usuario no autorizado' });
    }

    //Añadir usuario al request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({error: 'Token expirado' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalido' });
    } else {
      return res.status(401).json({ error: 'No autorizado' });
    }
  }
};

// Middleware de autorizacion
export const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }
  return (req, res, next) => {
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({error: 'Acceso prohibido' });
    }
    next();
  };
};

// Middleware de validacion para registro (exportado para usarse en las rutas)
export const validateRegister = [
  body('name')
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .trim()
    .escape(),

  body('email')
    .isEmail().withMessage('Email invalido')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .matches(/(?=.*[a-z])/).withMessage('Debe contener al menos una letra minúscula')
    .matches(/(?=.*[A-Z])/).withMessage('Debe contener al menos una letra mayúscula')
    .matches(/(?=.*\d)/).withMessage('Debe contener al menos un número')
    .matches(/(?=.*[\W_])/).withMessage('Debe contener al menos un carácter especial'),

  body('password_confirmation')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];