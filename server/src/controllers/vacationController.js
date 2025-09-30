// server/src/controllers/vacationController.js
import dayjs from 'dayjs';
import mongoose from 'mongoose';
import VacationRequest from '../models/VacationRequest.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import VacationData from '../models/VacationData.js';
import {
  sendVacationApprovedEmail,
  sendVacationRejectedEmail,
} from '../services/emailService.js';


/* ===========================
   Helpers de fechas (UTC)
=========================== */
const toDateUTC = (input) => {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const toYMDUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

const eachDayYMDUTC = (startUTC, endUTC) => {
  const out = [];
  const cur = new Date(startUTC);
  const end = new Date(endUTC);
  cur.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    out.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
};

const getHolidayDatesInRange = async (startUTC, endUTC) => {
  const holidays = await Holiday.find({ date: { $gte: startUTC, $lte: endUTC } }).lean();
  return holidays.map(h => toYMDUTC(h.date));
};

const isBusinessDay = (ymd, holidaySet) => {
  const d = toDateUTC(ymd);
  const dow = d.getUTCDay(); // 0=Dom, 6=Sáb
  return dow !== 0 && dow !== 6 && !holidaySet.has(toYMDUTC(d));
};

const calculateBusinessDaysUTC = (startUTC, endUTC, holidayList) => {
  const set = new Set(holidayList || []);
  let count = 0;
  for (const ymd of eachDayYMDUTC(startUTC, endUTC)) {
    if (isBusinessDay(ymd, set)) count++;
  }
  return count;
};

// ===========================
//   Validación de rango de fechas
// ===========================
const validateVacationRequestDates = (startDateStr, endDateStr) => {
  const errors = [];
  const startUTC = toDateUTC(startDateStr);
  const endUTC = toDateUTC(endDateStr);

  if (Number.isNaN(startUTC.getTime())) errors.push('Fecha de inicio inválida');
  if (Number.isNaN(endUTC.getTime())) errors.push('Fecha de fin inválida');

  if (!Number.isNaN(startUTC.getTime()) && !Number.isNaN(endUTC.getTime()) && startUTC > endUTC) {
    errors.push('La fecha de inicio debe ser menor o igual a la de fin');
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (!Number.isNaN(startUTC.getTime()) && startUTC.getTime() <= today.getTime()) {
    errors.push('La fecha de inicio debe ser posterior a hoy');
  }

  return { isValid: errors.length === 0, errors, startUTC, endUTC };
};


/* ===========================
   Disponibilidad concurrente
=========================== */
const MAX_CONCURRENT_VACATIONS = 3;

const checkConcurrentAvailabilityCore = async (startUTC, endUTC) => {
  const reqs = await VacationRequest.find({
    status: { $in: ['approved', 'pending'] },
    startDate: { $lte: endUTC },
    endDate: { $gte: startUTC },
  })
    .populate('user', 'name')
    .lean();

  const perDay = new Map(); // ymd -> Set(userId)
  for (const r of reqs) {
    const s = toDateUTC(r.startDate);
    const e = toDateUTC(r.endDate);
    for (const ymd of eachDayYMDUTC(s, e)) {
      if (!perDay.has(ymd)) perDay.set(ymd, new Set());
      perDay.get(ymd).add(String(r.user?._id || r.user));
    }
  }

  for (const ymd of eachDayYMDUTC(startUTC, endUTC)) {
    const set = perDay.get(ymd);
    if (set && set.size >= MAX_CONCURRENT_VACATIONS) {
      return { isAvailable: false };
    }
  }
  return { isAvailable: true };
};

/* ===========================
   Sincronización de usados
=========================== */

/**
 * Suma los días aprobados de un usuario y sincroniza:
 *  - User.vacationDays (total/used/lastUpdate)
 *  - VacationData (total/used/remaining/lastUpdate)
 */
const recomputeUserVacationUsed = async (userId) => {
  const approved = await VacationRequest.find({ user: userId, status: 'approved' }).lean();

  let used = 0;
  for (const r of approved) {
    let n = Number(r.daysRequested);
    if (!Number.isFinite(n) || n <= 0) {
      // fallback: calcula días hábiles por fechas, excluyendo festivos
      const s = toDateUTC(r.startDate);
      const e = toDateUTC(r.endDate);
      const hol = await getHolidayDatesInRange(s, e);
      n = calculateBusinessDaysUTC(s, e, hol);
    }
    used += n;
  }

  const user = await User.findById(userId).lean();
  if (!user) return { total: 0, used: 0, remaining: 0 };

  const total = Number(user?.vacationDays?.total ?? user?.totalAnnualDays ?? 0) || 0;
  const remaining = Math.max(0, total - used);

  // Actualiza User
  await User.findByIdAndUpdate(
    userId,
    {
      'vacationDays.total': total,
      'vacationDays.used': used,
      'vacationDays.lastUpdate': new Date()
    },
    { new: true }
  );

  // Actualiza/crea VacationData
  await VacationData.findOneAndUpdate(
    { user: userId },
    { total, used, remaining, lastUpdate: new Date() },
    { upsert: true, new: true, runValidators: true }
  );

  return { total, used, remaining };
};

/* ===========================
   Handlers HTTP
=========================== */

// GET /vacations/balance
export const getVacationBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    const yearStart = dayjs().startOf('year').toDate();
    const yearEnd = dayjs().endOf('year').toDate();

    const approved = await VacationRequest.find({
      user: req.user.id,
      status: 'approved',
      startDate: { $lte: yearEnd },
      endDate: { $gte: yearStart },
    }).lean();

    let used = 0;
    for (const r of approved) {
      const s = toDateUTC(r.startDate);
      const e = toDateUTC(r.endDate);
      const hol = await getHolidayDatesInRange(s, e);
      used += calculateBusinessDaysUTC(s, e, hol);
    }

    const total =
      user?.vacationDays?.total ??
      user?.totalAnnualDays ??
      0;

    const current = {
      total,
      used,
      remaining: Math.max(total - used, 0),
    };

    const historical = { ...current };

    return res.json({ success: true, data: { current, historical } });
  } catch (e) {
    next(e);
  }
};

// GET /vacations/requests (para el usuario)
export const getUserVacations = async (req, res, next) => {
  try {
    const [approved, pending, rejected] = await Promise.all([
      VacationRequest.find({ user: req.user.id, status: 'approved' })
        .populate('user', 'name email')
        .sort({ startDate: 1 })
        .lean(),
      VacationRequest.find({ user: req.user.id, status: 'pending' })
        .populate('user', 'name email')
        .sort({ startDate: 1 })
        .lean(),
      VacationRequest.find({ user: req.user.id, status: 'rejected' })
        .populate('user', 'name email')
        .sort({ startDate: -1 })
        .lean(),
    ]);

    const map = (v) => ({
      _id: String(v._id),
      id: String(v._id),
      user: { id: String(v.user?._id || req.user.id), name: v.user?.name || '', email: v.user?.email || '' },
      startDate: toYMDUTC(v.startDate),
      endDate: toYMDUTC(v.endDate),
      daysRequested: v.daysRequested,
      status: v.status,
      reason: v.reason || '',
      rejectReason: v.rejectReason || '',
      createdAt: v.createdAt?.toISOString?.() || new Date().toISOString(),
      updatedAt: v.updatedAt?.toISOString?.() || new Date().toISOString(),
    });

    return res.json({
      success: true,
      data: {
        approved: approved.map(map),
        pending: pending.map(map),
        rejected: rejected.map(map),
      },
    });
  } catch (e) {
    next(e);
  }
};

// GET /vacations/requests/pending (admin)
export const getPendingVacationRequests = async (_req, res, next) => {
  try {
    const pending = await VacationRequest.find({ status: 'pending' })
      .populate('user', 'name email')
      .sort({ startDate: 1 })
      .lean();

    const data = pending.map(v => ({
      id: String(v._id),
      user: {
        id: String(v.user?._id || v.user),
        name: v.user?.name || '',
        email: v.user?.email || '',
      },
      startDate: toYMDUTC(v.startDate),
      endDate: toYMDUTC(v.endDate),
      daysRequested: v.daysRequested,
      status: v.status,
      reason: v.reason || '',
      rejectReason: v.rejectReason || '',
      createdAt: v.createdAt?.toISOString?.() || new Date().toISOString(),
      updatedAt: v.updatedAt?.toISOString?.() || new Date().toISOString(),
    }));

    return res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

// GET /vacations/calendar/user-vacations
export const getUserVacationsForCalendar = getUserVacations;

// GET /vacations/calendar/team-vacations
export const getTeamVacationsForCalendar = async (req, res) => {
  try {
    const { startDate, endDate } = req.validDates || req.query;
    const startUTC = toDateUTC(startDate);
    const endUTC   = toDateUTC(endDate);

    if (Number.isNaN(startUTC.getTime()) || Number.isNaN(endUTC.getTime()) || startUTC > endUTC) {
      return res.status(400).json({ success: false, error: 'Rango de fechas inválido' });
    }

    const vacations = await VacationRequest.find({
      status: 'approved',
      startDate: { $lte: endUTC },
      endDate: { $gte: startUTC },
    })
      // Traemos isActive por si lo quieres mostrar en UI, pero NO filtramos por él.
      .populate('user', 'name email isActive')
      .lean();

    // ⬇️ Mostramos inactivos también; ocultamos solo si el usuario fue eliminado (populate => null)
    const data = vacations
      .filter(v => !!v.user)
      .map(v => ({
        id: String(v._id),
        userId: String(v.user?._id || v.user),
        startDate: toYMDUTC(v.startDate),
        endDate: toYMDUTC(v.endDate),
        user: {
          id: String(v.user?._id || v.user),
          name: v.user?.name || '',
          email: v.user?.email || '',
          // isActive disponible si quieres diferenciar en la UI
          isActive: v.user?.isActive
        },
      }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getTeamVacationsForCalendar:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener vacaciones del equipo' });
  }
};

// GET /vacations/calendar/holidays (con nombre)
export const getHolidaysForCalendar = async (req, res, next) => {
  try {
    const { startDate, endDate } = (req.validDates || req.query);
    const startUTC = toDateUTC(String(startDate));
    const endUTC = toDateUTC(String(endDate));

    const holidays = await Holiday
      .find({ date: { $gte: startUTC, $lte: endUTC } })
      .select('date name')
      .lean();

    const data = holidays.map(h => ({
      date: toYMDUTC(h.date),
      name: h.name || 'Día festivo',
    }));

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Función pura para unavailable  ➜  SOLO días con cupo lleno (≥ MAX_CONCURRENT_VACATIONS)
export const getUnavailableDates = async (startDate, endDate) => {
  const startUTC = toDateUTC(String(startDate));
  const endUTC   = toDateUTC(String(endDate));
  if (Number.isNaN(startUTC.getTime()) || Number.isNaN(endUTC.getTime())) {
    throw new Error('Fechas inválidas');
  }

  // Solicitudes que traslapan (approved + pending)
  const overlapping = await VacationRequest.find({
    status: { $in: ['approved', 'pending'] },
    startDate: { $lte: endUTC },
    endDate:   { $gte: startUTC },
  })
    .select('startDate endDate user')
    .lean();

  // ymd -> Set(userId) (evitar contar duplicado el mismo usuario en un día)
  const perDay = new Map();
  for (const r of overlapping) {
    const s = new Date(Math.max(toDateUTC(r.startDate).getTime(), startUTC.getTime()));
    const e = new Date(Math.min(toDateUTC(r.endDate).getTime(),   endUTC.getTime()));
    for (const ymd of eachDayYMDUTC(s, e)) {
      if (!perDay.has(ymd)) perDay.set(ymd, new Set());
      perDay.get(ymd).add(String(r.user?._id || r.user));
    }
  }

  // Festivos del rango (para no marcarlos como unavailable)
  const holidayDocs = await Holiday
    .find({ date: { $gte: startUTC, $lte: endUTC } })
    .select('date')
    .lean();
  const holidaySet = new Set(holidayDocs.map(h => toYMDUTC(h.date)));

  // Días con cupo lleno (excluyendo festivos)
  const fullDays = [];
  for (const [ymd, users] of perDay.entries()) {
    if (!holidaySet.has(ymd) && users.size >= MAX_CONCURRENT_VACATIONS) {
      fullDays.push(ymd);
    }
  }

  return fullDays;
};

// GET /vacations/calendar/unavailable-dates
export const getUnavailableDatesForCalendar = async (req, res) => {
  try {
    const { startDate, endDate } = req.validDates || req.query;
    const data = await getUnavailableDates(startDate, endDate);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getUnavailableDatesForCalendar:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener fechas no disponibles' });
  }
};

// POST /vacations/requests
export const requestVacation = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { startDate, endDate, reason } = req.body;
    const { isValid, errors, startUTC, endUTC } = validateVacationRequestDates(startDate, endDate);
    if (!isValid) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: errors.join(', ') });
    }

    const { isAvailable } = await checkConcurrentAvailabilityCore(startUTC, endUTC);
    if (!isAvailable) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: 'No hay disponibilidad para ese rango' });
    }

    const hol = await getHolidayDatesInRange(startUTC, endUTC);
    const business = calculateBusinessDaysUTC(startUTC, endUTC, hol);
    if (business < 1) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: 'El rango no contiene días hábiles' });
    }

    // Lee total anual y días usados en el año en curso (aprobados)
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const yearStart = dayjs().startOf('year').toDate();
    const yearEnd = dayjs().endOf('year').toDate();
    const approved = await VacationRequest.find({
      user: req.user.id,
      status: 'approved',
      startDate: { $lte: yearEnd },
      endDate: { $gte: yearStart },
    }).lean();
    let used = 0;
    for (const r of approved) {
      const s = toDateUTC(r.startDate);
      const e = toDateUTC(r.endDate);
      const hol2 = await getHolidayDatesInRange(s, e);
      used += calculateBusinessDaysUTC(s, e, hol2);
    }
    const total = (user?.vacationDays?.total ?? user?.totalAnnualDays ?? 0);
    const remaining = Math.max(total - used, 0);
    if (business > remaining) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({
        success: false,
        message: `No tienes días suficientes. Solicitaste ${business} hábiles y te quedan ${remaining}.`,
        meta: { requestedBusinessDays: business, remainingDays: remaining, totalAnnualDays: total, usedDays: used }
      });
    }

    const reqDoc = await VacationRequest.create([{
      user: req.user.id,
      startDate: startUTC,
      endDate: endUTC,
      daysRequested: business,
      reason: reason || ''
    }], { session });

    await session.commitTransaction(); session.endSession();

    const v = reqDoc[0];
    return res.status(201).json({
      success: true,
      data: {
        id: String(v._id),
        user: { id: String(req.user.id), name: req.user.name || '', email: req.user.email || '' },
        startDate: toYMDUTC(v.startDate),
        endDate: toYMDUTC(v.endDate),
        daysRequested: v.daysRequested,
        status: v.status,
        reason: v.reason || '',
        rejectReason: v.rejectReason || '',
        createdAt: v.createdAt?.toISOString?.() || new Date().toISOString(),
        updatedAt: v.updatedAt?.toISOString?.() || new Date().toISOString(),
      }
    });
  } catch (e) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    next(e);
  }
};

// PATCH /vacations/requests/:id/status (admin)
export const updateVacationRequestStatus = async (req, res, next) => {
  try {
    const { status, rejectReason } = req.body; // 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Estado inválido' });
    }

    const update = {
      status,
      processedBy: req.user.id,
      processedAt: new Date(),
    };

    if (status === 'rejected') {
      const reason = (rejectReason || '').trim();
      if (reason.length < 3) {
        return res.status(400).json({ success: false, error: 'Debes indicar un motivo de rechazo (mín. 3 caracteres)' });
      }
      if (reason.length > 500) {
        return res.status(400).json({ success: false, error: 'El motivo de rechazo no puede exceder 500 caracteres' });
      }
      update.rejectReason = reason;
    } else {
      // Si se aprueba, limpiar posible motivo previo
      update.rejectReason = '';
    }

    // 1) Actualiza y obtiene el doc con user (para responder al cliente)
    const doc = await VacationRequest
      .findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('user', 'name email isActive');

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    const uid = String(doc.user?._id || doc.user);

    // 👇 si se aprueba y falta snapshot, guardarlo (no bloquea la respuesta)
    if (status === 'approved') {
      const shouldFillSnapshot = !doc.userSnapshot?.name;
      if (shouldFillSnapshot) {
        process.nextTick(async () => {
          try {
            await VacationRequest.findByIdAndUpdate(doc._id, {
              $set: {
                userSnapshot: {
                  name:  doc.user?.name  ?? null,
                  email: doc.user?.email ?? null
                }
              }
            });
          } catch (err) {
            console.error('[vacations] Error guardando userSnapshot:', err?.message || err);
          }
        });
      }
    }

    // 2) RESPONDER PRIMERO
    res.json({
      success: true,
      data: {
        id: String(doc._id),
        user: { id: uid, name: doc.user?.name || '', email: doc.user?.email || '' },
        startDate: toYMDUTC(doc.startDate),
        endDate: toYMDUTC(doc.endDate),
        daysRequested: doc.daysRequested,
        status: doc.status,
        reason: doc.reason || '',
        rejectReason: doc.rejectReason || '',
        processedAt: doc.processedAt?.toISOString?.() || null,
      }
    });

    // 3) EFECTOS EN SEGUNDO PLANO
    process.nextTick(async () => {
      // Recalcular usados
      try {
        await recomputeUserVacationUsed(uid);
      } catch (err) {
        console.error('[vacations] Error en recomputeUserVacationUsed:', err?.message || err);
      }

      // Envío de correo al usuario
      try {
        const to = doc.user?.email;
        const name = doc.user?.name || doc.userSnapshot?.name || '';
        const approverName = req.user?.name || req.user?.email || 'Recursos Humanos';

        if (to) {
          if (status === 'approved') {
            await sendVacationApprovedEmail({
              to,
              name,
              startDate: doc.startDate,
              endDate: doc.endDate,
              approverName,
            });
            console.log('[vacations] Email de aprobación enviado a', to);
          } else if (status === 'rejected') {
            await sendVacationRejectedEmail({
              to,
              name,
              startDate: doc.startDate,
              endDate: doc.endDate,
              reason: doc.rejectReason || '',
              approverName,
            });
            console.log('[vacations] Email de rechazo enviado a', to);
          }
        } else {
          console.warn('[vacations] Usuario sin email; no se envía notificación.');
        }
      } catch (err) {
        // No romper flujo: ya respondimos al cliente
        console.error('[vacations] Error enviando correo:', err?.message || err);
      }
    });
  } catch (e) {
    next(e);
  }
};

// PATCH /vacations/requests/:id/cancel
export const cancelVacationRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, error: 'Parámetro id inválido' });
    }

    const userId = req.user?._id || req.user?.id;

    const request = await VacationRequest
      .findOne({ _id: id, user: userId })
      .session(session);

    if (!request) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    if (request.status === 'cancelled' || request.status === 'rejected') {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, error: 'La solicitud ya no puede cancelarse' });
    }

    // Regla: permitir cancelar aprobadas siempre que falte al menos 1 día (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const startUTC = toDateUTC(
      typeof request.startDate === 'string'
        ? request.startDate
        : request.startDate.toISOString().slice(0, 10)
    );

    if (request.status === 'approved' && startUTC.getTime() <= today.getTime()) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Solo puedes cancelar aprobadas con al menos 1 día de anticipación',
      });
    }

    // Marcar como cancelada
    request.status = 'cancelled';
    request.updatedAt = new Date();
    await request.save({ session });

    await session.commitTransaction();
    session.endSession();

    // 👉 Responder primero
    res.json({
      success: true,
      data: { id: String(request._id), status: request.status }
    });

    // 👉 Efectos en background
    process.nextTick(async () => {
      try {
        await recomputeUserVacationUsed(userId);
      } catch (err) {
        console.error('[vacations] Error al recomputar usados tras cancelar:', err?.message || err);
      }
    });

  } catch (e) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    console.error('Error cancelVacationRequest:', e);
    return res.status(500).json({ success: false, error: 'Error al cancelar solicitud' });
  }
};

// PUT /vacations/users/:userId/days (admin)  **(legacy; mejor usar /users/:id/vacation/total)**
export const manageVacationDays = async (req, res, next) => {
  try {
    const t = Number(req.body?.total) || 0;
    const u = Number(req.body?.used) || 0;

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: { totalAnnualDays: t, usedDays: u, 'vacationDays.total': t, 'vacationDays.used': u, 'vacationDays.lastUpdate': new Date() } },
      { new: true, runValidators: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    // Sincroniza VacationData también
    await VacationData.findOneAndUpdate(
      { user: user._id },
      { total: t, used: u, remaining: Math.max(t - u, 0), lastUpdate: new Date() },
      { upsert: true, new: true, runValidators: true }
    );

    const remaining = Math.max(t - u, 0);
    return res.json({
      success: true,
      data: {
        current:   { total: t, used: u, remaining },
        historical:{ total: t, used: u, remaining },
      }
    });
  } catch (e) { next(e); }
};

// GET /vacations/users/days (admin)
export const getAllUsersVacationDays = async (_req, res, next) => {
  try {
    const users = await User
      .find()
      .select('name email role isActive vacationDays totalAnnualDays usedDays')
      .lean();

    const data = users.map(u => {
      const total = (u.vacationDays?.total ?? u.totalAnnualDays ?? 0);
      const used  = (u.vacationDays?.used  ?? u.usedDays       ?? 0);
      const remaining = Math.max(total - used, 0);
      return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive ?? true,
        vacationDays: { total, used, remaining },
      };
    });

    return res.json({ success: true, data });
  } catch (e) { next(e); }
};

// POST /vacations/check-availability
export const checkVacationAvailability = async (req, res) => {
  const { startDate, endDate } = req.body || {};
  const { isValid, errors, startUTC, endUTC } = validateVacationRequestDates(startDate, endDate);
  if (!isValid) return res.status(400).json({ success: false, error: errors.join(', ') });

  const { isAvailable } = await checkConcurrentAvailabilityCore(startUTC, endUTC);
  return res.json({ success: true, data: { isAvailable } });
};

/* ===========================
   Admin: Reporte de aprobadas
   (activos, inactivos o eliminados)
=========================== */
// GET /vacations/admin/approved
export const getApprovedVacationsAdmin = async (req, res) => {
  try {
    const { q, from, to, userStatus } = req.query;

    const query = { status: 'approved' };
    if (from || to) {
      const f = from ? toDateUTC(from) : null;
      const t = to ? toDateUTC(to)     : null;
      if (f && t && f > t) {
        return res.status(400).json({ success: false, error: 'Rango de fechas inválido' });
      }
      if (f) query.startDate = { ...(query.startDate || {}), $gte: f };
      if (t) query.startDate = { ...(query.startDate || {}), $lte: t };
    }

    const rows = await VacationRequest.find(query)
      .populate('user', 'name email isActive')
      .sort({ startDate: -1 })
      .lean();

    let data = rows.map(v => {
      const exists = !!v.user;
      const status =
        exists ? (v.user.isActive ? 'Activo' : 'Inactivo') : 'Eliminado';

      const displayName  = exists
        ? (v.user.name  ?? v.userSnapshot?.name  ?? '[usuario eliminado]')
        : (v.userSnapshot?.name ?? '[usuario eliminado]');

      const displayEmail = exists
        ? (v.user.email ?? v.userSnapshot?.email ?? null)
        : (v.userSnapshot?.email ?? null);

      return {
        id: String(v._id),
        startDate: toYMDUTC(v.startDate),
        endDate: toYMDUTC(v.endDate),
        totalDays: v.daysRequested,
        displayName,
        displayEmail,
        userStatus: status,
        createdAt: v.createdAt?.toISOString?.() || null
      };
    });

    // Filtro por texto (nombre/email)
    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), 'i');
      data = data.filter(row => rx.test(row.displayName) || rx.test(row.displayEmail || ''));
    }

    // Filtro por estado de usuario
    if (userStatus && ['Activo', 'Inactivo', 'Eliminado'].includes(userStatus)) {
      data = data.filter(row => row.userStatus === userStatus);
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('[getApprovedVacationsAdmin] error:', error);
    return res.status(500).json({ success: false, error: 'Error obteniendo reporte admin' });
  }
};
