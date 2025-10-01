import { body, validationResult } from 'express-validator';

/* ------------- Helpers reutilizables ------------- */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

// Normaliza una fecha a UTC 00:00, si es válida
const toUTCDate = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return d;
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/* ------------- Validación de Fechas ------------- */
export const validateDateRange = [
  body('startDate')
    .notEmpty().withMessage('La fecha de inicio es requerida')
    .isISO8601().withMessage('Formato de fecha inválido. Use YYYY-MM-DD')
    .customSanitizer(toUTCDate),

  body('endDate')
    .notEmpty().withMessage('La fecha de fin es requerida')
    .isISO8601().withMessage('Formato de fecha inválido. Use YYYY-MM-DD')
    .customSanitizer(toUTCDate)
    .custom((endDate, { req }) => {
      if (endDate < req.body.startDate) {
        throw new Error('La fecha de fin debe ser posterior a la de inicio');
      }
      return true;
    }),

  handleValidation,
];

/* ------------- Validación de Días Festivos ------------- */
export const validateHoliday = [
  body('date')
    .notEmpty().withMessage('La fecha es requerida')
    .isISO8601().withMessage('Formato de fecha inválido. Use YYYY-MM-DD')
    .customSanitizer(toUTCDate),

  body('name')
    .trim()
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 }).withMessage('Debe tener entre 2 y 100 caracteres'),

  handleValidation,
];

/* ------------- Registro ------------- */
export const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 50 }).withMessage('Debe tener entre 2 y 50 caracteres'),

  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 }).withMessage('Mínimo 8 caracteres')
    .matches(/[A-Z]/).withMessage('Debe incluir mayúscula')
    .matches(/[a-z]/).withMessage('Debe incluir minúscula')
    .matches(/\d/).withMessage('Debe incluir número')
    .matches(/[\W_]/).withMessage('Debe incluir carácter especial'),

  body('password_confirmation')
    .custom((v, { req }) => v === req.body.password)
    .withMessage('Las contraseñas no coinciden'),

  // 👇 NUEVOS CAMPOS (opcionales)
  body('position')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('El puesto debe tener entre 2 y 120 caracteres'),

  body('birthDate')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Fecha de nacimiento inválida (use YYYY-MM-DD)')
    .customSanitizer(toUTCDate)
    .custom((d) => {
      if (isNaN(d.getTime())) return true; // ya fue capturado por isISO8601
      const today = new Date(); today.setUTCHours(0,0,0,0);
      if (d > today) throw new Error('La fecha de nacimiento no puede ser futura');
      return true;
    }),

  body('hireDate')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Fecha de ingreso inválida (use YYYY-MM-DD)')
    .customSanitizer(toUTCDate)
    .custom((d, { req }) => {
      if (isNaN(d.getTime())) return true;
      const today = new Date(); today.setUTCHours(0,0,0,0);
      if (d > today) throw new Error('La fecha de ingreso no puede ser futura');
      // si también viene birthDate, opcionalmente validar que sea razonable (ej. ≥ 14 años)
      if (req.body.birthDate) {
        const b = toUTCDate(req.body.birthDate);
        if (!isNaN(b.getTime())) {
          const fourteenYearsMs = 14 * 365.25 * 24 * 60 * 60 * 1000;
          if (d.getTime() - b.getTime() < fourteenYearsMs) {
            throw new Error('La fecha de ingreso es inconsistente con la fecha de nacimiento');
          }
        }
      }
      return true;
    }),

  handleValidation,
];

/* ------------- Login ------------- */
export const validateLogin = [
  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida'),

  handleValidation,
];

/* ------------- Reenvío de Verificación ------------- */
export const validateResendVerification = [
  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  handleValidation,
];

/* ------------- Refresh Token ------------- */
export const validateRefreshToken = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token requerido'),
  handleValidation,
];

/* ------------- Validación de Parámetros de Fecha (Query) ------------- */
export const validateDateParams = (req, res, next) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'Se requieren los parámetros startDate y endDate'
    });
  }

  try {
    const start = toUTCDate(startDate);
    const end = toUTCDate(endDate);

    if (isNaN(start.getTime())) throw new Error('Fecha de inicio inválida');
    if (isNaN(end.getTime())) throw new Error('Fecha de fin inválida');

    if (start > end) {
      throw new Error('La fecha de inicio debe ser anterior a la fecha final');
    }

    req.validDates = {
      startDate: start,
      endDate: end,
      startDateStr: start.toISOString().split('T')[0],
      endDateStr: end.toISOString().split('T')[0]
    };

    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message || 'Error al validar las fechas'
    });
  }
};
