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
  getHolidaysForCalendar,
  getUserVacationsForCalendar,
  getTeamVacationsForCalendar,
  getAllUsersVacationDays,
  getUnavailableDatesForCalendar,
} from '../controllers/vacationController.js';
import { validateDateRange, validateDateParams } from '../middleware/validation.js';

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

// si se rechaza, exigir rejectReason 3–500
const validateStatusChange = (req, res, next) => {
  const { status, rejectReason } = req.body || {};
  if (!status) {
    return res.status(400).json({ success: false, error: 'Debes indicar el estado' });
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

router.get(
  '/calendar/holidays',
  authenticate,
  validateDateParams,
  getHolidaysForCalendar
);

// alias de compatibilidad
router.get(
  '/holidays',
  authenticate,
  validateDateParams,
  getHolidaysForCalendar
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

/* --------------------------------- Admin ---------------------------------- */

router.route('/users/:userId/days')
  .put(authenticate, authorize('admin'), manageVacationDays);

router.get('/users/days',
  authenticate,
  authorize('admin'),
  getAllUsersVacationDays
);

router.patch('/requests/:id/status',
  authenticate,
  authorize('admin'),
  validateStatusChange,          // <- exige rejectReason si status = rejected
  updateVacationRequestStatus
);

router.get('/requests/pending',
  authenticate,
  authorize('admin'),
  getPendingVacationRequests
);

export default router;
