// server/src/routes/vacations.js
import { Router } from 'express';
import mongoose from 'mongoose';
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
  getUserVacationsForCalendar,
  getTeamVacationsForCalendar,
  getAllUsersVacationDays,
  getUnavailableDatesForCalendar,
  getApprovedVacationsAdmin,
  // ⬇️ NUEVOS handlers (derecho vigente LFT)
  getMyCurrentEntitlement,
  getUserCurrentEntitlementAdmin,
} from '../controllers/vacationController.js';
import { validateDateRange, validateDateParams } from '../middleware/validation.js';
import * as holidayController from '../controllers/holidayController.js';

const router = Router();

/* -------------------- Helpers -------------------- */

const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };

const validateId = (param = 'id') => (req, res, next) => {
  const val = req.params[param];
  if (!mongoose.isValidObjectId(val)) {
    return res.status(400).json({ success: false, message: `ID inválido (${param})` });
  }
  next();
};

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

router.get('/balance', authenticate, noStore, getVacationBalance);

// Derecho vigente (LFT) del usuario autenticado
router.get('/my/entitlement', authenticate, noStore, getMyCurrentEntitlement);

router.route('/requests')
  .post(
    authenticate,
    validateDateRange,        // valida startDate / endDate
    validateOptionalReason,   // valida reason opcional
    requestVacation
  )
  .get(authenticate, noStore, getUserVacations);

router.patch('/requests/:id/cancel',
  authenticate,
  validateId('id'),
  cancelVacationRequest
);

router.post('/check-availability',
  authenticate,
  checkVacationAvailability
);

/* -------------------------------- Calendario ------------------------------- */

// Festivos (unificado)
router.get(
  '/calendar/holidays',
  authenticate,
  validateDateParams,
  noStore,
  holidayController.getHolidays
);

// Alias de compatibilidad
router.get(
  '/holidays',
  authenticate,
  validateDateParams,
  noStore,
  holidayController.getHolidays
);

router.get('/calendar/user-vacations',
  authenticate,
  noStore,
  getUserVacationsForCalendar
);

router.get('/calendar/team-vacations',
  authenticate,
  validateDateParams,
  noStore,
  getTeamVacationsForCalendar
);

router.get('/calendar/unavailable-dates',
  authenticate,
  validateDateParams,
  noStore,
  getUnavailableDatesForCalendar
);

/* ---------------------------- Festivos (ADMIN) ---------------------------- */

router.post(
  '/holidays',
  authenticate,
  authorize('admin'),
  holidayController.createHoliday
);

router.patch(
  '/holidays/:id',
  authenticate,
  authorize('admin'),
  validateId('id'),
  holidayController.updateHoliday
);

router.delete(
  '/holidays/:id',
  authenticate,
  authorize('admin'),
  validateId('id'),
  holidayController.deleteHoliday
);

/* --------------------------------- Admin ---------------------------------- */

// (Admin) Derecho vigente por usuario
router.get(
  '/users/:userId/entitlement',
  authenticate,
  authorize('admin'),
  validateId('userId'),
  noStore,
  getUserCurrentEntitlementAdmin
);

// Gestionar días (legacy)
router.put(
  '/users/:userId/days',
  authenticate,
  authorize('admin'),
  validateId('userId'),
  manageVacationDays
);

// Listado de días por usuario
router.get(
  '/users/days',
  authenticate,
  authorize('admin'),
  noStore,
  getAllUsersVacationDays
);

// Cambio de estado (aprobado/rechazado)
router.patch(
  '/requests/:id/status',
  authenticate,
  authorize(['admin', 'manager', 'hr']),
  validateId('id'),
  validateStatusChange,
  updateVacationRequestStatus
);

// Alias ergonómicos (opcionales):
router.post(
  '/requests/:id/approve',
  authenticate,
  authorize(['admin', 'manager', 'hr']),
  validateId('id'),
  (req, _res, next) => { req.body = { status: 'approved' }; next(); },
  validateStatusChange,
  updateVacationRequestStatus
);

router.post(
  '/requests/:id/reject',
  authenticate,
  authorize(['admin', 'manager', 'hr']),
  validateId('id'),
  (req, _res, next) => {
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
router.get(
  '/requests/pending',
  authenticate,
  authorize(['admin', 'manager', 'hr']),
  noStore,
  getPendingVacationRequests
);

// Reporte admin de TODAS las vacaciones aprobadas
router.get(
  '/admin/approved',
  authenticate,
  authorize('admin'),
  noStore,
  getApprovedVacationsAdmin
);

export default router;
