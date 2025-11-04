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

// LFT MX 2023 — utilidades y servicio de cómputo por ciclo
import {
  currentEntitlementDays,
  isWithinCurrentWindow,
  currentAnniversaryWindow,
  yearsOfService,
} from '../utils/vacationLawMX.js';

// Ventanas (current/next) con vigencia 18m
import {
  getVacationSummary as getWindowsSummary,
  ensureWindowsAndCompute,
} from '../services/vacationService.js';

import { getUsedDaysInCurrentCycle } from '../services/vacationService.js';

// ⬇️ Nuevo: notificación a administradores cuando se crea una solicitud
import { notifyAdminsAboutNewRequest } from '../services/notificationService.js';

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
//   Validación de rango
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
 * Suma días aprobados y sincroniza:
 *  - User.vacationDays (total/used/lastUpdate)
 *  - VacationData (total/used/remaining/lastUpdate)
 * Nota: total aquí es el compat (subdoc). adminExtra lo usa el cómputo del balance.
 */
const recomputeUserVacationUsed = async (userId) => {
  const approved = await VacationRequest.find({ user: userId, status: 'approved' }).lean();

  let used = 0;
  for (const r of approved) {
    let n = Number(r.daysRequested);
    if (!Number.isFinite(n) || n <= 0) {
      const s = toDateUTC(r.startDate);
      const e = toDateUTC(r.endDate);
      const hol = await getHolidayDatesInRange(s, e);
      n = calculateBusinessDaysUTC(s, e, hol);
    }
    used += n;
  }

  const user = await User.findById(userId).lean();
  if (!user) return { total: 0, used: 0, remaining: 0 };

  const totalCompat = Number(user?.vacationDays?.total ?? user?.totalAnnualDays ?? 0) || 0;
  const remainingCompat = Math.max(0, totalCompat - used);

  // Actualiza User
  await User.findByIdAndUpdate(
    userId,
    {
      'vacationDays.total': totalCompat,
      'vacationDays.used': used,
      'vacationDays.lastUpdate': new Date()
    },
    { new: true }
  );

  // Actualiza VacationData (legacy)
  await VacationData.findOneAndUpdate(
    { user: userId },
    { total: totalCompat, used, remaining: remainingCompat, lastUpdate: new Date() },
    { upsert: true, new: true, runValidators: true }
  );

  return { total: totalCompat, used, remaining: remainingCompat };
};

/* ===========================
   Handlers HTTP — Ventanas
=========================== */

// GET /vacations/users/me/summary  (self)
export const getVacationSummarySelf = async (req, res, next) => {
  try {
    const me = await User.findById(req.user.id).select('hireDate').lean();
    if (!me) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    if (!me.hireDate) return res.status(400).json({ success: false, error: 'Falta fecha de ingreso (hireDate)' });

    // 1) Asegura/realinea ventanas y sincroniza bonusAdmin → VacationData
    try {
      await ensureWindowsAndCompute(req.user.id, me.hireDate);
    } catch (syncErr) {
      console.warn('[getVacationSummarySelf] ensureWindowsAndCompute:', syncErr?.message || syncErr);
    }

    // 2) Lee el summary ya fresco (con bonusAdmin y ventanas vigentes)
    const summary = await getWindowsSummary(req.user.id, me.hireDate);

    res.set('Cache-Control', 'no-store'); // doble anti-cache por si acaso
    return res.json({ success: true, data: summary });
  } catch (e) {
    next(e);
  }
};

// GET /vacations/users/:userId/summary  (admin/otros)
export const getVacationSummaryByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const u = await User.findById(userId).select('hireDate').lean();
    if (!u) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    if (!u.hireDate) return res.status(400).json({ success: false, error: 'Falta fecha de ingreso (hireDate)' });

    // 1) Asegura/realinea ventanas y sincroniza bonusAdmin → VacationData
    try {
      await ensureWindowsAndCompute(userId, u.hireDate);
    } catch (syncErr) {
      console.warn('[getVacationSummaryByUserId] ensureWindowsAndCompute:', syncErr?.message || syncErr);
    }

    // 2) Lee el summary ya fresco (con bonusAdmin y ventanas vigentes)
    const summary = await getWindowsSummary(userId, u.hireDate);

    res.set('Cache-Control', 'no-store'); // doble anti-cache por si acaso
    return res.json({ success: true, data: summary });
  } catch (e) {
    next(e);
  }
};

/* ===========================
   Handlers HTTP — Legacy/UX
=========================== */

// GET /vacations/balance  -> LFT + adminExtra
export const getVacationBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    if (!user.hireDate) {
      return res.status(400).json({ success: false, error: 'Falta fecha de ingreso (hireDate)' });
    }

    const win = currentAnniversaryWindow(user.hireDate);
    const right = currentEntitlementDays(user.hireDate);                 // DERECHO por ley
    const used  = await getUsedDaysInCurrentCycle(user._id, user.hireDate);
    const adminExtra = Number(user?.vacationDays?.adminExtra ?? 0) || 0; // BONO admin (≥0)

    const total = right + adminExtra;
    const remaining = Math.max(total - used, 0);

    const today = new Date(); today.setUTCHours(0,0,0,0);
    const daysLeft = Math.max(0, Math.ceil((win.end.getTime() - today.getTime()) / (24*60*60*1000)));

    return res.json({
      success: true,
      data: {
        current: {
          right,
          adminExtra,
          total,
          used,
          remaining,
          window: {
            start: win.start.toISOString().slice(0,10),
            end:   win.end.toISOString().slice(0,10),
            daysLeft,
          },
          policy: 'LFT MX 2023',
        }
      }
    });
  } catch (e) { next(e); }
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
  } catch (e) { next(e); }
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
      .populate('user', 'name email isActive')
      .lean();

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

/* ===========================
   Fechas no disponibles (cupo lleno)
=========================== */
export const getUnavailableDates = async (startDate, endDate) => {
  const startUTC = toDateUTC(String(startDate));
  const endUTC   = toDateUTC(String(endDate));
  if (Number.isNaN(startUTC.getTime()) || Number.isNaN(endUTC.getTime())) {
    throw new Error('Fechas inválidas');
  }

  // Solicitudes traslapadas (approved + pending)
  const overlapping = await VacationRequest.find({
    status: { $in: ['approved', 'pending'] },
    startDate: { $lte: endUTC },
    endDate:   { $gte: startUTC },
  })
    .select('startDate endDate user')
    .lean();

  // ymd -> Set(userId)
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

/* ===========================
   Crear / Aprobar / Cancelar
=========================== */

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

    // === LFT: pre-validación al crear ===
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    if (!user.hireDate) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: 'Falta fecha de ingreso (hireDate) para aplicar LFT' });
    }

    const within = isWithinCurrentWindow(user.hireDate, startUTC, endUTC);
    if (!within) {
      await session.abortTransaction(); session.endSession();
      return res.status(422).json({
        success: false,
        message: 'La solicitud está fuera de la ventana de 6 meses posterior al aniversario (LFT).',
        code: 'OUTSIDE_WINDOW',
      });
    }

    const right = currentEntitlementDays(user.hireDate);
    const adminExtra = Number(user?.vacationDays?.adminExtra ?? 0) || 0;
    const total = right + adminExtra;
    const used = await getUsedDaysInCurrentCycle(user._id, user.hireDate);
    const remaining = Math.max(total - used, 0);

    if (business > remaining) {
      await session.abortTransaction(); session.endSession();
      return res.status(422).json({
        success: false,
        message: `No tienes saldo suficiente del ciclo vigente. Derecho: ${right} (+${adminExtra} extra), Usados: ${used}, Restantes: ${remaining}, Solicitados: ${business}.`,
        code: 'INSUFFICIENT_BALANCE',
        meta: { requestedBusinessDays: business, remainingDays: remaining, totalEntitlement: total, usedInCycle: used }
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

    // 📣 Dispara correo a administradores en segundo plano (no bloquea la respuesta HTTP)
    process.nextTick(async () => {
      try {
        // Asegura name/email del solicitante (por si req.user viene parcial)
        const me = (req.user?.email)
          ? { name: req.user?.name, email: req.user?.email }
          : await User.findById(req.user.id).select('name email').lean();

        await notifyAdminsAboutNewRequest(v, me);
        console.log('[vacations] notifyAdminsAboutNewRequest enviado para', me?.email || req.user?.id);
      } catch (err) {
        console.error('[vacations] notifyAdminsAboutNewRequest error:', err?.message || err);
      }
    });

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

    // Cargar la solicitud con usuario (incluye hireDate)
    const existing = await VacationRequest
      .findById(req.params.id)
      .populate('user', 'name email isActive hireDate vacationDays.adminExtra')
      .lean();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    const uid = String(existing.user?._id || existing.user);

    if (status === 'approved') {
      if (!existing.user?.hireDate) {
        return res.status(400).json({
          success: false,
          error: 'El usuario no tiene fecha de ingreso (hireDate) configurada',
        });
      }

      const within = isWithinCurrentWindow(
        existing.user.hireDate,
        existing.startDate,
        existing.endDate
      );

      const allowOverride = Boolean(req.body?.overrideWindow === true);
      if (!within && !allowOverride) {
        return res.status(422).json({
          success: false,
          error: 'La solicitud está fuera de la ventana de 6 meses posterior al aniversario (LFT).',
          code: 'OUTSIDE_WINDOW',
        });
      }

      const right = currentEntitlementDays(existing.user.hireDate);
      const adminExtra = Number(existing.user?.vacationDays?.adminExtra ?? 0) || 0;
      const total = right + adminExtra;
      const used = await getUsedDaysInCurrentCycle(existing.user._id, existing.user.hireDate);

      const startN = toDateUTC(existing.startDate);
      const endN = toDateUTC(existing.endDate);
      const natural = dayjs(endN).diff(dayjs(startN), 'day') + 1;
      const requestDays = Number.isFinite(existing.daysRequested) && existing.daysRequested > 0
        ? existing.daysRequested
        : Math.max(natural, 1);

      if (used + requestDays > total) {
        return res.status(422).json({
          success: false,
          error: `No hay saldo suficiente en el ciclo vigente. Derecho: ${right} (+${adminExtra} extra), Usados: ${used}, Solicitud: ${requestDays}.`,
          code: 'INSUFFICIENT_BALANCE',
        });
      }
    }

    const update = {
      status,
      processedBy: req.user.id,
      processedAt: new Date(),
      rejectReason: status === 'approved' ? '' : undefined,
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
    }

    const doc = await VacationRequest
      .findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('user', 'name email isActive');

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    const uidFinal = String(doc.user?._id || doc.user);

    res.json({
      success: true,
      data: {
        id: String(doc._id),
        user: { id: uidFinal, name: doc.user?.name || '', email: doc.user?.email || '' },
        startDate: toYMDUTC(doc.startDate),
        endDate: toYMDUTC(doc.endDate),
        daysRequested: doc.daysRequested,
        status: doc.status,
        reason: doc.reason || '',
        rejectReason: doc.rejectReason || '',
        processedAt: doc.processedAt?.toISOString?.() || null,
      }
    });

    // Background
    process.nextTick(async () => {
      // Completar snapshot si falta (solo aprobadas)
      if (status === 'approved' && !doc.userSnapshot?.name) {
        try {
          await VacationRequest.findByIdAndUpdate(doc._id, {
            $set: { userSnapshot: { name: doc.user?.name ?? null, email: doc.user?.email ?? null } }
          });
        } catch (err) {
          console.error('[vacations] Error guardando userSnapshot:', err?.message || err);
        }
      }

      // Recalcular usados (legacy) y sincronizar ventanas
      try {
        await recomputeUserVacationUsed(uidFinal);
      } catch (err) {
        console.error('[vacations] Error en recomputeUserVacationUsed:', err?.message || err);
      }
      try {
        const u = await User.findById(uidFinal).select('hireDate').lean();
        if (u?.hireDate) await ensureWindowsAndCompute(uidFinal, u.hireDate);
      } catch (err) {
        console.error('[vacations] Error sincronizando ventanas:', err?.message || err);
      }

      // Emails
      try {
        const to = doc.user?.email;
        const name = doc.user?.name || doc.userSnapshot?.name || '';
        const approverName = req.user?.name || req.user?.email || 'Recursos Humanos';

        if (to) {
          if (status === 'approved') {
            await sendVacationApprovedEmail({ to, name, startDate: doc.startDate, endDate: doc.endDate, approverName });
            console.log('[vacations] Email de aprobación enviado a', to);
          } else if (status === 'rejected') {
            await sendVacationRejectedEmail({ to, name, startDate: doc.startDate, endDate: doc.endDate, reason: doc.rejectReason || '', approverName });
            console.log('[vacations] Email de rechazo enviado a', to);
          }
        } else {
          console.warn('[vacations] Usuario sin email; no se envía notificación.');
        }
      } catch (err) {
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

    // permitir cancelar aprobadas si falta al menos 1 día (UTC)
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

    request.status = 'cancelled';
    request.updatedAt = new Date();
    await request.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      data: { id: String(request._id), status: request.status }
    });

    // background: recompute + ventanas
    process.nextTick(async () => {
      try {
        await recomputeUserVacationUsed(userId);
      } catch (err) {
        console.error('[vacations] Error al recomputar usados tras cancelar:', err?.message || err);
      }
      try {
        const u = await User.findById(userId).select('hireDate').lean();
        if (u?.hireDate) await ensureWindowsAndCompute(userId, u.hireDate);
      } catch (err) {
        console.error('[vacations] Error sincronizando ventanas tras cancelar:', err?.message || err);
      }
    });

  } catch (e) {
    try { await session.abortTransaction(); } catch {}
    session.endSession();
    console.error('Error cancelVacationRequest:', e);
    return res.status(500).json({ success: false, error: 'Error al cancelar solicitud' });
  }
};

/* ===========================
   Admin (compat / listados)
=========================== */

// PUT /vacations/users/:userId/days (legacy; usa mejor /users/:id/vacation/total desde usersController)
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

    await VacationData.findOneAndUpdate(
      { user: user._id },
      { total: t, used: u, remaining: Math.max(t - u, 0), lastUpdate: new Date() },
      { upsert: true, new: true, runValidators: true }
    );

    // mantener ventanas al día por si t/u cambian políticas de vista (no afecta el cálculo real de ventanas)
    try {
      if (user?.hireDate) await ensureWindowsAndCompute(user._id, user.hireDate);
    } catch (err) {
      console.error('[vacations] manageVacationDays → ensureWindowsAndCompute:', err?.message || err);
    }

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

// GET /vacations/users/days (admin) — listado con derecho LFT + adminExtra
export const getAllUsersVacationDays = async (_req, res, next) => {
  try {
    const users = await User
      .find()
      .select('name email role isActive hireDate position birthDate vacationDays')
      .lean();

    const usedByUser = await Promise.all(
      users.map(u => u.hireDate ? getUsedDaysInCurrentCycle(u._id, u.hireDate) : Promise.resolve(0))
    );

    const data = users.map((u, idx) => {
      const hireOk = !!u.hireDate;
      const right  = hireOk ? currentEntitlementDays(u.hireDate) : 0;
      const adminExtra = Number(u?.vacationDays?.adminExtra ?? 0) || 0;
      const total = right + adminExtra;
      const used  = hireOk ? usedByUser[idx] : 0;
      const remaining = Math.max(total - used, 0);

      return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive ?? true,
        position: u.position ?? '',
        hireDate: u.hireDate ?? null,
        birthDate: u.birthDate ?? null,
        vacationDays: { right, adminExtra, total, used, remaining },
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

    // filtro texto
    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), 'i');
      data = data.filter(row => rx.test(row.displayName) || rx.test(row.displayEmail || ''));
    }

    // filtro estado usuario
    if (userStatus && ['Activo', 'Inactivo', 'Eliminado'].includes(userStatus)) {
      data = data.filter(row => row.userStatus === userStatus);
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('[getApprovedVacationsAdmin] error:', error);
    return res.status(500).json({ success: false, error: 'Error obteniendo reporte admin' });
  }
};

/* ===========================
   Derecho vigente (LFT) — UX
=========================== */
// GET /vacations/my/entitlement
export const getMyCurrentEntitlement = async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('name email hireDate vacationDays.adminExtra').lean();
    if (!me) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    if (!me.hireDate) {
      return res.status(400).json({ success: false, message: 'Falta fecha de ingreso (hireDate)' });
    }

    const yos = yearsOfService(me.hireDate);
    const right = currentEntitlementDays(me.hireDate);
    const adminExtra = Number(me?.vacationDays?.adminExtra ?? 0) || 0;
    const total = right + adminExtra;

    const win = currentAnniversaryWindow(me.hireDate);
    const used = await getUsedDaysInCurrentCycle(me._id, me.hireDate);
    const remaining = Math.max(0, total - used);

    const today = new Date(); today.setUTCHours(0,0,0,0);
    const startYMD = win.start.toISOString().slice(0,10);
    const endYMD   = win.end.toISOString().slice(0,10);
    const nextAnniversary = (() => {
      const base = new Date(win.start);
      const next = new Date(Date.UTC(base.getUTCFullYear()+1, base.getUTCMonth(), base.getUTCDate()));
      return next.toISOString().slice(0,10);
    })();
    const daysUntilWindowEnds = Math.max(0, Math.ceil((win.end.getTime() - today.getTime()) / (24*60*60*1000)));

    return res.json({
      success: true,
      data: {
        user: { id: String(me._id), name: me.name, email: me.email, hireDate: me.hireDate },
        cycle: {
          yearsOfService: yos,
          entitlementDays: right,
          adminExtra,
          totalEntitlement: total,
          usedDays: used,
          remainingDays: remaining,
          window: { start: startYMD, end: endYMD },
          daysUntilWindowEnds,
          nextAnniversary,
          policy: 'LFT MX 2023',
        }
      }
    });
  } catch (err) {
    console.error('[getMyCurrentEntitlement] error:', err);
    return res.status(500).json({ success: false, message: 'Error obteniendo derecho vigente', error: err?.message });
  }
};

// (Admin) GET /vacations/users/:userId/entitlement
export const getUserCurrentEntitlementAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const u = await User.findById(userId).select('name email hireDate vacationDays.adminExtra').lean();
    if (!u) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    if (!u.hireDate) {
      return res.status(400).json({ success: false, message: 'Falta fecha de ingreso (hireDate)' });
    }

    const yos = yearsOfService(u.hireDate);
    const right = currentEntitlementDays(u.hireDate);
    const adminExtra = Number(u?.vacationDays?.adminExtra ?? 0) || 0;
    const total = right + adminExtra;

    const win = currentAnniversaryWindow(u.hireDate);
    const used = await getUsedDaysInCurrentCycle(u._id, u.hireDate);
    const remaining = Math.max(0, total - used);

    const today = new Date(); today.setUTCHours(0,0,0,0);
    const startYMD = win.start.toISOString().slice(0,10);
    const endYMD   = win.end.toISOString().slice(0,10);
    const nextAnniversary = (() => {
      const base = new Date(win.start);
      const next = new Date(Date.UTC(base.getUTCFullYear()+1, base.getUTCMonth(), base.getUTCDate()));
      return next.toISOString().slice(0,10);
    })();
    const daysUntilWindowEnds = Math.max(0, Math.ceil((win.end.getTime() - today.getTime()) / (24*60*60*1000)));

    return res.json({
      success: true,
      data: {
        user: { id: String(u._id), name: u.name, email: u.email, hireDate: u.hireDate },
        cycle: {
          yearsOfService: yos,
          entitlementDays: right,
          adminExtra,
          totalEntitlement: total,
          usedDays: used,
          remainingDays: remaining,
          window: { start: startYMD, end: endYMD },
          daysUntilWindowEnds,
          nextAnniversary,
          policy: 'LFT MX 2023',
        }
      }
    });
  } catch (err) {
    console.error('[getUserCurrentEntitlementAdmin] error:', err);
    return res.status(500).json({ success: false, message: 'Error obteniendo derecho vigente (admin)', error: err?.message });
  }
};
