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

/** Usuarios */
router.get('/balance', authenticate, getVacationBalance);

router.route('/requests')
  .post(authenticate, validateDateRange, requestVacation)
  .get(authenticate, getUserVacations);

router.patch('/requests/:id/cancel', authenticate, cancelVacationRequest);

router.post('/check-availability',
  authenticate,
  checkVacationAvailability
);

/** Calendario */
router.get(
  '/calendar/holidays',
  authenticate,
  validateDateParams,
  getHolidaysForCalendar
);

// alias para compatibilidad con el front (si usa /vacations/holidays)
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

/** Admin */
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
  updateVacationRequestStatus
);

router.get('/requests/pending',
  authenticate,
  authorize('admin'),
  getPendingVacationRequests
);

export default router;
