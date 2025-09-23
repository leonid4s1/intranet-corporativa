// server/src/routes/vacations.js
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  requestVacation,
  getUserVacations,
  getPendingVacationRequests,
  updateVacationRequestStatus,
  cancelVacationRequest,
  getVacationBalance,
  manageVacationDays,
  checkVacationAvailability,
  // getHolidaysForCalendar, // <- ya no lo usamos; unificamos con holidayController.getHolidays
  getUserVacationsForCalendar,
  getTeamVacationsForCalendar,
  getAllUsersVacationDays,
  getUnavailableDatesForCalendar,
} from '../controllers/vacationController.js';
import { validateDateRange, validateDateParams } from '../middleware/validation.js';

// 👇 CRUD de días festivos
import * as holidayController from '../controllers/holidayController.js';

const router = Router();

/* -------------------- Validaciones ligeras de payload -------------------- */

// reason opcional al crear solicitud: string máx 500
const validateOptionalReason = (req, res, next) => {
  const { reason } = req.body || {};
  if (reason == null) return next();
  if (typeof reason !== 'string') {
    return res.status(400).json({ success: false, error: 'El motivo debe ser texto' });
  }
  const trimmed = reason.trim();
  if (trimmed.length > 500) {
    return res.status(400).json({ success: false, error: 'El motivo no puede exceder 500 caracteres' });
  }
  req.body.reason = trimmed;
  next();
};

// si se cambia estado, exigir consistencia. Para rejected: rejectReason 3–500
const validateStatusChange = (req, res, next) => {
  let { status, rejectReason } = req.body || {};
  if (typeof status === 'string') status = status.trim();

  if (!status) {
    return res.status(400).json({ success: false, error: 'Debes indicar el estado' });
  }
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Estado inválido' });
  }

  if (status === 'rejected') {
    if (typeof rejectReason !== 'string') {
      return res.status(400).json({ success: false, error: 'Debes indicar un motivo de rechazo' });
    }
    const trimmed = rejectReason.trim();
    if (trimmed.length < 3) {
      return res.status(400).json({ success: false, error: 'El motivo de rechazo debe tener al menos 3 caracteres' });
    }
    if (trimmed.length > 500) {
      return res.status(400).json({ success: false, error: 'El motivo de rechazo no puede exceder 500 caracteres' });
    }
    req.body.rejectReason = trimmed;
  }

  req.body.status = status;
  next();
};

/* -------------------------------- Usuarios -------------------------------- */

router.get('/balance', authenticate, getVacationBalance);

router.route('/requests')
  .post(
    authenticate,
    validateDateRange,        // valida startDate / endDate
    validateOptionalReason,   // valida reason opcional
    requestVacation
  )
  .get(authenticate, getUserVacations);

router.patch('/requests/:id/cancel', authenticate, cancelVacationRequest);

router.post('/check-availability',
  authenticate,
  checkVacationAvailability
);

/* -------------------------------- Calendario ------------------------------- */

// Unificamos en holidayController.getHolidays para ambos endpoints
router.get(
  '/calendar/holidays',
  authenticate,
  validateDateParams,
  holidayController.getHolidays
);

// alias de compatibilidad (usado por el front)
router.get(
  '/holidays',
  authenticate,
  validateDateParams,
  holidayController.getHolidays
);

router.get('/calendar/user-vacations',
  authenticate,
  getUserVacationsForCalendar
);

router.get('/calendar/team-vacations',
  authenticate,
  validateDateParams,
  getTeamVacationsForCalendar
);

router.get('/calendar/unavailable-dates',
  authenticate,
  validateDateParams,
  getUnavailableDatesForCalendar
);

/* ---------------------------- Festivos (ADMIN) ---------------------------- */

// Crear festivo
router.post(
  '/holidays',
  authenticate,
  authorize('admin'),
  holidayController.createHoliday
);

// Actualizar festivo por ID
router.patch(
  '/holidays/:id',
  authenticate,
  authorize('admin'),
  holidayController.updateHoliday
);

// Eliminar festivo por ID
router.delete(
  '/holidays/:id',
  authenticate,
  authorize('admin'),
  holidayController.deleteHoliday
);

/* --------------------------------- Admin ---------------------------------- */

// Gestionar días (legacy)
router.route('/users/:userId/days')
  .put(authenticate, authorize('admin'), manageVacationDays);

// Listado de días por usuario
router.get('/users/days',
  authenticate,
  authorize('admin'),
  getAllUsersVacationDays
);

// Cambio de estado (aprobado/rechazado)
router.patch('/requests/:id/status',
  authenticate,
  authorize(['admin', 'manager', 'hr']), // ← agrega roles que pueden aprobar
  validateStatusChange,
  updateVacationRequestStatus
);

// Alias ergonómicos (opcionales):
router.post(
  '/requests/:id/approve',
  authenticate,
  authorize(['admin', 'manager', 'hr']),
  (req, _res, next) => { req.body = { status: 'approved' }; next(); },
  validateStatusChange,
  updateVacationRequestStatus
);

router.post(
  '/requests/:id/reject',
  authenticate,
  authorize(['admin', 'manager', 'hr']),
  (req, _res, next) => {
    // Mantener compatibilidad: aceptar rejectReason vía body o query ?reason=
    const reason = typeof req.body?.rejectReason === 'string'
      ? req.body.rejectReason
      : (req.query?.reason ?? '');
    req.body = { status: 'rejected', rejectReason: reason };
    next();
  },
  validateStatusChange,
  updateVacationRequestStatus
);

// Pendientes para revisión
router.get('/requests/pending',
  authenticate,
  authorize(['admin', 'manager', 'hr']),
  getPendingVacationRequests
);

export default router;
